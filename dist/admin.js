/* Publishing authority comes only from the authenticated Cloudflare Worker. */
'use strict';
(() => {
  const {escape:e,validate} = KODC;
  const revisionKey='kodc-content-draft-revision-v1';
  let signedIn=false,csrf='',baseSha='',publishing=false;
  let data,section='classes',editingId=null,dirty=false;
  const labels={classes:'Classes & timings',instructors:'Instructors',testimonials:'Testimonials',studio:'Studio details'};
  const singular={classes:'class',instructors:'instructor',testimonials:'testimonial'};
  const status=(message,error=false)=>{const el=document.querySelector('#editor-status');el.textContent=message;el.classList.toggle('error',error);};
  const authenticated=()=>signedIn;
  async function api(route,body){
    const response=await fetch(new URL('api/'+route,location.href),{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000),headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
    let result;try{result=await response.json();}catch{throw new Error('Secure publishing is available only on the configured Cloudflare website. See CLOUDFLARE-SETUP.md.');}
    if(!response.ok){if(response.status===401)signedIn=false;throw new Error(result.error||'Publishing request failed.');}return result;
  }
  document.querySelector('#login-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=new FormData(event.target);const error=document.querySelector('#login-error');
    const button=event.target.querySelector('button');button.disabled=true;
    try {const result=await api('login',{username:form.get('username'),password:form.get('password')});signedIn=true;csrf=result.csrf;error.textContent='';event.target.reset();await openEditor();}catch(errorMessage){error.textContent=errorMessage.message;}finally{button.disabled=false;}
  });
  async function openEditor(){
    document.querySelector('#login-screen').hidden=true;document.querySelector('#editor-screen').hidden=false;
    try {const remote=await api('content');try{data=KODC.loadDraft();}catch{status('The stored draft could not be loaded. Using repository content; import a backup if needed.',true);}if(data){try{baseSha=localStorage.getItem(revisionKey)||'';}catch{}if(!baseSha)status('This older draft has no repository revision. Export a backup, reload latest content, then import your draft before publishing.',true);else if(baseSha!==remote.sha)status('GitHub has newer content than this draft. Export a backup and reload latest content before publishing.',true);}else{data=remote.content;baseSha=remote.sha;}document.querySelector('#add-button').disabled=false;render();}catch(error){status(error.message,true);document.querySelector('#add-button').disabled=true;document.querySelector('#editor-content').innerHTML='<p class="storage-error">Content unavailable. Check Worker secrets and GitHub access, then log in again.</p>';}
  }
  function confirmAction(title,text){return new Promise(resolve=>{const dialog=document.querySelector('#confirm-dialog');document.querySelector('#confirm-title').textContent=title;document.querySelector('#confirm-text').textContent=text;dialog.showModal();function finish(value){dialog.close();cleanup();resolve(value);}const yes=()=>finish(true),no=()=>finish(false);function cancel(event){event.preventDefault();finish(false);}function cleanup(){document.querySelector('#confirm-yes').removeEventListener('click',yes);document.querySelector('#confirm-cancel').removeEventListener('click',no);dialog.removeEventListener('cancel',cancel);}document.querySelector('#confirm-yes').addEventListener('click',yes);document.querySelector('#confirm-cancel').addEventListener('click',no);dialog.addEventListener('cancel',cancel);});}
  async function canLeave(){return !dirty || await confirmAction('Discard unsaved fields?','Your saved draft is kept. Fields not saved in this form will be discarded.');}
  function persist(next,message){if(!authenticated()){status('Your editor session expired. Log in again. Copy unsaved fields before refreshing.',true);return false;}try{const clean=KODC.saveDraft(next);data=clean;localStorage.setItem(revisionKey,baseSha);dirty=false;status(message || 'Draft saved in this browser. Click Publish to update the website.');return true;}catch(error){status('Not saved: '+error.message+'. Check browser storage or export a backup.',true);return false;}}
  function render(){
    if(!data)return;
    document.querySelector('#record-editor').hidden=true;document.querySelector('#editor-title').textContent=labels[section];
    document.querySelectorAll('[data-section]').forEach(b=>{b.classList.toggle('selected',b.dataset.section===section);b.setAttribute('aria-pressed',String(b.dataset.section===section));});
    for(const collection of ['classes','instructors','testimonials'])document.querySelector('#'+collection+'-count').textContent=data[collection].length;
    const add=document.querySelector('#add-button');add.hidden=section==='studio';add.textContent='+ Add '+singular[section];
    if(section==='studio'){renderStudio();return;}
    const list=data[section];
    document.querySelector('#editor-content').innerHTML=list.length?`<div class="editor-list">${list.map(item=>`<article class="editor-list-item"><div><h3>${e(item.name)}</h3><p>${e(section==='classes'?item.category+' · '+item.schedule:section==='instructors'?item.role:item.quote)}</p><span class="record-state ${item.published?'live':'draft'}">${item.published?'Included in export':'Hidden from website'}</span></div><div class="record-actions"><button data-edit="${e(item.id)}" aria-label="Edit ${e(item.name)}">Edit</button><button class="delete" data-delete="${e(item.id)}" aria-label="Delete ${e(item.name)}">Delete</button></div></article>`).join('')}</div>`:`<div class="empty-editor">No ${e(section)} yet. Add your first ${e(singular[section])}.</div>`;
    document.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>openForm(button.dataset.edit)));
    document.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',async()=>{
      const item=data[section].find(x=>x.id===button.dataset.delete);
      if(!await confirmAction('Delete '+item.name+'?','This removes the record from this local draft only. Click Publish to make the removal public. Classes assigned to a deleted instructor will be unassigned.'))return;
      const next=structuredClone(data);next[section]=next[section].filter(x=>x.id!==item.id);if(section==='instructors')next.classes.forEach(x=>{if(x.instructorId===item.id)x.instructorId='';});if(persist(next,'Record removed from the local draft.'))render();
    }));
  }
  const input=(label,name,value='',options={})=>`<label class="${options.wide?'wide':''}">${e(label)}<input name="${name}" value="${e(value)}" type="${options.type||'text'}" maxlength="${options.max||1000}" ${options.required?'required':''} ${options.type==='number'?`min="${options.min??0}" max="${options.maxNumber??1000000}" step="${options.step||1}"`:''}>${options.help?`<span class="field-help">${e(options.help)}</span>`:''}</label>`;
  const area=(label,name,value,required=false)=>`<label class="wide">${e(label)}<textarea name="${name}" maxlength="5000" ${required?'required':''}>${e(value)}</textarea></label>`;
  const checkbox=(label,name,checked)=>`<label class="checkbox-label"><input type="checkbox" name="${name}" ${checked?'checked':''}>${e(label)}</label>`;
  function recordFields(item){
    let fields=input('Name','name',item.name,{required:true});
    if(section==='classes'){
      fields+=`<label>Category<select name="category">${['Dance','Fitness','Kids'].map(x=>`<option ${item.category===x?'selected':''}>${x}</option>`).join('')}</select></label>`+area('Class description','description',item.description,true)+input('Suitable for','audience',item.audience,{required:true})+input('Days & timings','schedule',item.schedule,{required:true,help:'Example: Mon & Wed · 6:00–7:00 PM. Publish only studio-confirmed timings.'})+`<label>Instructor<select name="instructorId"><option value="">Not assigned</option>${data.instructors.map(x=>`<option value="${e(x.id)}" ${item.instructorId===x.id?'selected':''}>${e(x.name)}${!x.published?' (hidden)':''}</option>`).join('')}</select></label>`+input('Fee / enquiry text','fee',item.fee,{help:'Include the billing period if known; otherwise use “Ask for current fees”.'})+checkbox('Highlight this class','featured',item.featured);
    }else if(section==='instructors'){
      fields+=input('Role / speciality','role',item.role,{required:true})+area('Showcase biography','bio',item.bio,true)+input('Photo URL or assets/ path','photo',item.photo,{wide:true,help:'Use an approved HTTPS photo URL, or commit a photo to dist/assets/ and enter assets/filename.jpg.'})+input('Public profile / source URL','source',item.source,{wide:true,help:'Optional HTTPS link. Do not invent credentials or teaching assignments.'});
    }else{
      fields+=input('Platform / attribution','platform',item.platform,{required:true})+area('Review excerpt / testimonial','quote',item.quote,true)+input('Rating (1–5)','rating',item.rating,{type:'number',min:1,maxNumber:5,required:true})+input('Source URL','source',item.source,{help:'Use the original review URL. Publish only genuine, approved testimonials.'});
    }
    return fields+checkbox('Show on website after publishing','published',item.published);
  }
  async function openForm(id=null){
    if(!data || !await canLeave())return;
    dirty=false;editingId=id;
    const blank=section==='classes'?{name:'',category:'Dance',description:'',audience:'',schedule:'Contact the studio for current batches',instructorId:'',fee:'Ask for current fees',featured:false,published:true}:section==='instructors'?{name:'',role:'',bio:'',photo:'',source:'',published:true}:{name:'',quote:'',platform:'Google review excerpt',rating:5,source:'',published:true};
    const item=id?data[section].find(x=>x.id===id):blank;
    document.querySelector('#form-title').textContent=(id?'Edit ':'New ')+singular[section];
    document.querySelector('#editor-content').hidden=true;document.querySelector('#record-editor').hidden=false;
    document.querySelector('#record-form').innerHTML=`<div class="form-grid">${recordFields(item)}</div><div class="form-footer"><button type="submit" class="button">Save draft ✓</button><span>Then click Publish to update the website.</span></div>`;
    document.querySelector('#record-form').querySelector('input').focus();
  }
  document.querySelector('#record-form').addEventListener('input',()=>dirty=true);
  document.querySelector('#record-form').addEventListener('change',()=>dirty=true);
  document.querySelector('#record-form').addEventListener('submit',event=>{
    event.preventDefault();const form=new FormData(event.target);let record={id:editingId || singular[section]+'-'+crypto.randomUUID(),published:form.has('published')};
    const keys=section==='classes'?['name','category','description','audience','schedule','instructorId','fee']:section==='instructors'?['name','role','bio','photo','source']:['name','quote','platform','source'];
    keys.forEach(key=>record[key]=String(form.get(key)||'').trim());if(section==='classes')record.featured=form.has('featured');if(section==='testimonials')record.rating=Number(form.get('rating'));
    const next=structuredClone(data);if(editingId)next[section][next[section].findIndex(x=>x.id===editingId)]=record;else next[section].push(record);
    if(persist(next)){document.querySelector('#editor-content').hidden=false;render();}
  });
  document.querySelector('#cancel-edit').addEventListener('click',async()=>{if(await canLeave()){dirty=false;document.querySelector('#editor-content').hidden=false;render();}});
  document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',async()=>{if(!data || !await canLeave())return;dirty=false;section=button.dataset.section;document.querySelector('#editor-content').hidden=false;render();}));
  document.querySelector('#add-button').addEventListener('click',()=>openForm());
  function renderStudio(){
    const item=data.studio;
    const fields=input('Phone / WhatsApp number','phone',item.phone,{required:true,help:'Country code + digits only. Example: 917003414003'})+input('Contact email','email',item.email,{type:'email',required:true})+area('Studio address','address',item.address,true)+input('Studio hours / timing note','hours',item.hours,{wide:true})+input('Directions URL','map',item.map,{wide:true,type:'url',required:true})+input('Instagram URL','instagram',item.instagram,{type:'url',required:true})+input('Facebook URL','facebook',item.facebook,{type:'url',required:true})+input('Google rating','rating',item.rating,{type:'number',min:0,maxNumber:5,step:0.1,required:true})+input('Google review count','reviewCount',item.reviewCount,{type:'number',required:true})+input('Review snapshot date','reviewDate',item.reviewDate,{required:true,help:'Update numbers only after checking the actual Google listing.'});
    document.querySelector('#editor-content').innerHTML=`<form id="studio-form" class="studio-form"><div class="form-grid">${fields}</div><div class="form-footer"><button class="button" type="submit">Save studio draft ✓</button><span>Then click Publish to update the website.</span></div></form>`;
    const form=document.querySelector('#studio-form');form.addEventListener('input',()=>dirty=true);form.addEventListener('submit',event=>{event.preventDefault();const fields=new FormData(form);const next=structuredClone(data);Object.keys(item).forEach(key=>next.studio[key]=['rating','reviewCount'].includes(key)?Number(fields.get(key)):String(fields.get(key)||'').trim());persist(next);});
  }
  document.querySelector('#export-button').addEventListener('click',()=>{
    if(!data || !authenticated()){status('Log in and load content before exporting.',true);return;}
    try {const clean=validate(data);const blob=new Blob([JSON.stringify(clean,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='content.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status(dirty?'Saved draft exported. Unsaved form fields are NOT included.':'Backup exported. Click Publish to update the website.');}catch(error){status(error.message,true);}
  });
  document.querySelector('#import-button').addEventListener('click',()=>document.querySelector('#import-file').click());
  document.querySelector('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try {if(file.size>1024*1024)throw new Error('File is too large. Maximum size: 1 MB.');const next=validate(JSON.parse(await file.text()));if(!await confirmAction('Replace the local draft?','The imported file will replace your entire local draft, including saved classes and instructors. Export a backup first if needed.'))return;if(persist(next,'Imported and saved as a local draft.')){document.querySelector('#editor-content').hidden=false;render();}}catch(error){status('Import rejected: '+error.message,true);}
  });
  document.querySelector('#restore-button').addEventListener('click',async()=>{if(!await confirmAction('Reload latest repository content?','This replaces the local draft and unsaved fields with the latest GitHub version, which may still be deploying. Export a backup first if needed.'))return;try{const remote=await api('content');const previous=baseSha;baseSha=remote.sha;if(persist(remote.content,'Local draft replaced with latest repository content.')){document.querySelector('#editor-content').hidden=false;render();}else baseSha=previous;}catch(error){status(error.message,true);}});
  document.querySelector('#publish-button').addEventListener('click',async()=>{
    if(publishing || !data)return;
    if(!authenticated()){status('Log in again before publishing. Your local draft is kept.',true);return;}
    if(dirty){status('Save or cancel unsaved form fields before publishing.',true);return;}
    if(!baseSha){status('Export a backup, reload latest repository content, then import your draft to establish a publishing revision.',true);return;}
    if(!await confirmAction('Publish this saved draft?','This replaces the entire website content file on GitHub and starts a Cloudflare deployment. Visitors will see these changes after deployment completes.'))return;
    const button=document.querySelector('#publish-button');publishing=true;button.disabled=true;button.textContent='Publishing…';
    try {const result=await api('publish',{sha:baseSha,content:validate(data)});baseSha=result.sha;try{localStorage.setItem(revisionKey,baseSha);}catch{}status(result.message+' Commit: '+result.commit.slice(0,7));}catch(error){status(error.message,true);}finally{publishing=false;button.disabled=false;button.textContent='Publish website ↗';}
  });
  document.querySelector('#logout-button').addEventListener('click',async()=>{if(publishing || !await canLeave())return;try{await api('logout',{});}catch(error){status('Could not log out: '+error.message,true);return;}dirty=false;signedIn=false;csrf='';data=undefined;document.querySelector('#editor-screen').hidden=true;document.querySelector('#login-screen').hidden=false;document.querySelector('#login-form input').focus();});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  (async()=>{try{const result=await api('session');if(result.authenticated){signedIn=true;csrf=result.csrf;await openEditor();}}catch(error){document.querySelector('#login-error').textContent=error.message;}})();
  // Optional WebMCP readback mirrors the visible draft; never grants publishing rights.
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController();
    try{Promise.resolve(document.modelContext.registerTool({name:'read_studio_editor_draft',title:'Read KODC editor draft',description:'Read loaded local draft classes, instructors and testimonials after the editor convenience login. Does not save, export or publish.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No arguments accepted.');if(!authenticated()||!data)throw new Error('Editor is not open.');return structuredClone(data);}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
