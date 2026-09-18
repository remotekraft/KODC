const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const store = new Map();
const context = {window:{},URL,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};
vm.createContext(context);
vm.runInContext(readFileSync('dist/content.js','utf8'),context);
const content = JSON.parse(readFileSync('dist/content.json','utf8'));
const k = context.KODC;
assert.equal(k.validate(content).classes.length,5);
assert.equal(k.safeUrl('javascript:alert(1)'), '');
assert.equal(k.safeUrl('https://user:password@example.com/'), '');
assert.equal(k.safeUrl('assets/../private.txt',true), '');
assert.equal(k.safeUrl('assets/team.jpg',true), 'assets/team.jpg');
assert.equal(k.escape('<img onerror="alert(1)">'), '&lt;img onerror=&quot;alert(1)&quot;&gt;');
const clone=()=>JSON.parse(JSON.stringify(content));
let bad=clone();bad.classes[0].instructorId='missing';assert.throws(()=>k.validate(bad));
bad=clone();bad.classes.push({...bad.classes[0]});assert.throws(()=>k.validate(bad));
bad=clone();bad.instructors[0].photo='javascript:alert(1)';assert.throws(()=>k.validate(bad));
bad=clone();bad.studio.rating=6;assert.throws(()=>k.validate(bad));
bad=clone();bad.testimonials[0].rating=0;assert.throws(()=>k.validate(bad));
bad=clone();bad.studio.phone='tel:+91';assert.throws(()=>k.validate(bad));
bad=clone();bad.classes[0].published='true';assert.throws(()=>k.validate(bad));
const draft=clone();draft.classes[0].schedule='Mon & Wed · 6–7 PM';k.saveDraft(draft);assert.equal(k.loadDraft().classes[0].schedule,draft.classes[0].schedule);
const extended=clone();extended.secret='not exported';assert.equal(k.validate(extended).secret,undefined);
context.localStorage.setItem=()=>{throw new Error('quota');};assert.throws(()=>k.saveDraft(content));
const {existsSync} = require('node:fs');
for (const entry of ['index.html','admin.html']) {
  const html=readFileSync('dist/'+entry,'utf8');
  for(const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const path=match[1];if(/^(https?:|tel:|mailto:|data:)/.test(path))continue;
    assert.ok(existsSync('dist/'+path),'Missing asset: '+path);
  }
  assert.ok(html.includes('assets/logo.jpeg'),'Missing logo/favicon');
  assert.ok(html.includes('rel="icon" type="image/jpeg" href="assets/favicon.jpeg"'),'Missing updated favicon');
}
JSON.parse(readFileSync('dist/index.html','utf8').match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
assert.ok(readFileSync('.github/workflows/pages.yml','utf8').includes('path: dist'),'Pages must publish dist, not the repository root');
assert.ok(!existsSync('.github/workflows/static.yml'),'Duplicate Pages workflow would overwrite the site');
assert.ok(existsSync('dist/assets/whatsapp.svg'),'Missing WhatsApp icon');
assert.ok(readFileSync('dist/styles.css','utf8').includes('a[href^="https://wa.me/"]:before'),'All WhatsApp links must receive the icon, including dynamically rendered classes');
console.log('Content validation, URL safety, escaping, draft persistence, and failure checks passed.');
