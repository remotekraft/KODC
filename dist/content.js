/* Static published content is authoritative; localStorage contains editor drafts only. */
window.KODC = (() => {
  'use strict';
  const draftKey = 'kodc-content-draft-v1';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = (value, image = false) => {
    if (image && /^assets\/[\w./-]+$/.test(value || '') && !value.includes('..')) return value;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  };
  function validate(data) {
    const fail = message => { throw new Error(message); };
    if (!data || data.version !== 1 || !data.studio || typeof data.studio !== 'object') fail('Not a supported KODC content file.');
    const studio = data.studio;
    for (const key of ['phone','email','address','hours','map','instagram','facebook','reviewDate']) if (typeof studio[key] !== 'string' || studio[key].length > 1000) fail('Invalid studio field: ' + key);
    if (!/^\d{10,15}$/.test(studio.phone)) fail('Phone must include country code and contain 10–15 digits.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studio.email)) fail('Enter a valid email address.');
    if (!studio.address.trim()) fail('Studio address is required.');
    for (const key of ['map','instagram','facebook']) if (!safeUrl(studio[key])) fail('Studio links must use https.');
    if (!Number.isFinite(studio.rating) || studio.rating < 0 || studio.rating > 5 || !Number.isInteger(studio.reviewCount) || studio.reviewCount < 0 || studio.reviewCount > 1000000) fail('Invalid review numbers.');
    const ids = {};
    for (const collection of ['classes','instructors','testimonials']) {
      if (!Array.isArray(data[collection]) || data[collection].length > 100) fail('Invalid content collection: ' + collection);
      ids[collection] = new Set();
      for (const item of data[collection]) {
        if (!item || typeof item.id !== 'string' || !/^[\w-]{1,100}$/.test(item.id) || ids[collection].has(item.id)) fail('Missing or duplicate record ID.');
        ids[collection].add(item.id);
        if (typeof item.published !== 'boolean') fail('Every record needs a publish status.');
        const fields = collection === 'classes' ? ['name','category','description','audience','schedule','instructorId','fee'] : collection === 'instructors' ? ['name','role','bio','photo','source'] : ['name','quote','source','platform'];
        for (const field of fields) if (typeof item[field] !== 'string' || item[field].length > 5000) fail('Invalid record field: ' + field);
        if (!item.name.trim()) fail('Every record needs a name.');
        if (collection === 'classes' && (!['Dance','Fitness','Kids'].includes(item.category) || typeof item.featured !== 'boolean')) fail('Invalid class category or featured status.');
        if (collection === 'instructors' && item.photo && !safeUrl(item.photo, true)) fail('Instructor photos must be an https URL or an assets/ path.');
        if ('source' in item && item.source && !safeUrl(item.source)) fail('Source links must use https.');
        if (collection === 'testimonials' && (!Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5 || !item.quote.trim())) fail('Reviews need text and a rating from 1 to 5.');
      }
    }
    for (const item of data.classes) if (item.instructorId && !ids.instructors.has(item.instructorId)) fail('A class refers to a missing instructor.');
    // Whitelist properties so imported content cannot smuggle unexpected records into exports.
    const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));
    return {version:1, studio:pick(studio,['phone','email','address','hours','map','instagram','facebook','rating','reviewCount','reviewDate']), classes:data.classes.map(x=>pick(x,['id','name','category','description','audience','schedule','instructorId','fee','featured','published'])), instructors:data.instructors.map(x=>pick(x,['id','name','role','bio','photo','source','published'])), testimonials:data.testimonials.map(x=>pick(x,['id','name','quote','rating','source','platform','published']))};
  }
  async function loadPublished() {
    const response = await fetch('content.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Could not load studio content. Please refresh or contact the studio.');
    return validate(await response.json());
  }
  function loadDraft() { const raw = localStorage.getItem(draftKey); return raw ? validate(JSON.parse(raw)) : null; }
  function saveDraft(data) { const clean = validate(data); localStorage.setItem(draftKey, JSON.stringify(clean)); return clean; }
  const initials = name => name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  return {draftKey,escape,safeUrl,validate,loadPublished,loadDraft,saveDraft,initials};
})();
