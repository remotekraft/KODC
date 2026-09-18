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
  function friendlyError(error){
    const message=String(error?.message||'');
    if(error?.name==='SyntaxError')return 'Please choose a backup downloaded from this admin page.';
    if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'The request took too long. Check your website before trying again; your update may already have been sent.';
    if(error?.name==='QuotaExceededError')return 'This device has no space left for saved changes.';
    if(error?.name==='TypeError')return 'We couldn’t connect. Check your internet connection and try again.';
    if(/photo|links|https|URL/i.test(message))return 'Please check that each link opens the right page or photo.';
    if(/record|collection|supported KODC|Invalid studio|review numbers/i.test(message))return 'Please check all names, timings, contact details, links, and ratings. If you are restoring a backup, use one downloaded from this admin page.';
    if(/GitHub|Cloudflare|Worker|repository|JSON|CSRF|token|commit|storage|revision/i.test(message))return 'We couldn’t complete this action. Please try again or ask your website manager for help.';
    return message||'Something went wrong. Please try again.';
  }
  const authenticated=()=>signedIn;
  async function api(route,body){
    const response=await fetch(new URL('api/'+route,location.href),{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000),headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
    let result;try{result=await response.json();}catch{throw new Error('Please open the admin page on your main website. If it still won’t open, ask your website manager for help.');}
    if(!response.ok){if(response.status===401)signedIn=false;throw new Error(result.error||'We couldn’t update the website. Please try again.');}return result;
  }
  document.querySelector('#login-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=new FormData(event.target);const error=document.querySelector('#login-error');
    const button=event.target.querySelector('button');button.disabled=true;
    try {const result=await api('login',{username:form.get('username'),password:form.get('password')});signedIn=true;csrf=result.csrf;error.textContent='';event.target.reset();await openEditor();}catch(errorMessage){error.textContent=friendlyError(errorMessage);}finally{button.disabled=false;}
  });
  async function openEditor(){
    document.querySelector('#login-screen').hidden=true;document.querySelector('#editor-screen').hidden=false;
    try {const remote=await api('content');try{data=KODC.loadDraft();}catch{status('We couldn’t open your saved changes. The latest website content is shown instead. You can restore a backup if needed.',true);}if(data){try{baseSha=localStorage.getItem(revisionKey)||'';}catch{}if(!baseSha)status('These saved changes need to be refreshed. Download a backup, choose Get latest changes, then Restore backup and review your changes.',true);else if(baseSha!==remote.sha)status('The website has newer changes. Download a backup, choose Get latest changes, and add your edits again.',true);}else{data=remote.content;baseSha=remote.sha;}document.querySelector('#add-button').disabled=false;render();}catch(error){status(friendlyError(error),true);document.querySelector('#add-button').disabled=true;document.querySelector('#editor-content').innerHTML='<p class="storage-error">We couldn’t load your website details. Please try logging in again, or ask your website manager for help.</p>';}
  }
  function confirmAction(title,text){return new Promise(resolve=>{const dialog=document.querySelector('#confirm-dialog');document.querySelector('#confirm-title').textContent=title;document.querySelector('#confirm-text').textContent=text;dialog.showModal();function finish(value){dialog.close();cleanup();resolve(value);}const yes=()=>finish(true),no=()=>finish(false);function cancel(event){event.preventDefault();finish(false);}function cleanup(){document.querySelector('#confirm-yes').removeEventListener('click',yes);document.querySelector('#confirm-cancel').removeEventListener('click',no);dialog.removeEventListener('cancel',cancel);}document.querySelector('#confirm-yes').addEventListener('click',yes);document.querySelector('#confirm-cancel').addEventListener('click',no);dialog.addEventListener('cancel',cancel);});}
  async function canLeave(){return !dirty || await confirmAction('Leave without saving?','Changes you already saved are kept. Anything you haven’t saved on this form will be lost.');}
  function persist(next,message){if(!authenticated()){status('Please log in again. Copy any changes you haven’t saved before refreshing this page.',true);return false;}try{const clean=KODC.saveDraft(next);data=clean;localStorage.setItem(revisionKey,baseSha);dirty=false;status(message || 'Your changes are saved on this device. Click Update website to share them with visitors.');return true;}catch(error){status('We couldn’t save your changes. '+friendlyError(error)+' Download a backup before closing this page.',true);return false;}}
  function render(){
    if(!data)return;
    document.querySelector('#record-editor').hidden=true;document.querySelector('#editor-title').textContent=labels[section];
    document.querySelectorAll('[data-section]').forEach(b=>{b.classList.toggle('selected',b.dataset.section===section);b.setAttribute('aria-pressed',String(b.dataset.section===section));});
    for(const collection of ['classes','instructors','testimonials'])document.querySelector('#'+collection+'-count').textContent=data[collection].length;
    const add=document.querySelector('#add-button');add.hidden=section==='studio';add.textContent='+ Add '+singular[section];
    if(section==='studio'){renderStudio();return;}
    const list=data[section];
    document.querySelector('#editor-content').innerHTML=list.length?`<div class="editor-list">${list.map(item=>`<article class="editor-list-item"><div><h3>${e(item.name)}</h3><p>${e(section==='classes'?item.category+' · '+item.schedule:section==='instructors'?item.role:item.quote)}</p><span class="record-state ${item.published?'live':'draft'}">${item.published?'Show after updating':'Hidden from website'}</span></div><div class="record-actions"><button data-edit="${e(item.id)}" aria-label="Edit ${e(item.name)}">Edit</button><button class="delete" data-delete="${e(item.id)}" aria-label="Delete ${e(item.name)}">Delete</button></div></article>`).join('')}</div>`:`<div class="empty-editor">No ${e(section)} yet. Add your first ${e(singular[section])}.</div>`;
    document.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>openForm(button.dataset.edit)));
    document.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',async()=>{
      const item=data[section].find(x=>x.id===button.dataset.delete);
      if(!await confirmAction('Delete '+item.name+'?','This removes the entry from your saved changes. Click Update website to remove it from the live website too. If you remove an instructor, choose a new instructor for their classes.'))return;
      const next=structuredClone(data);next[section]=next[section].filter(x=>x.id!==item.id);if(section==='instructors')next.classes.forEach(x=>{if(x.instructorId===item.id)x.instructorId='';});if(persist(next,'Entry removed. Click Update website when you’re ready.'))render();
    }));
  }
  const input=(label,name,value='',options={})=>`<label class="${options.wide?'wide':''}">${e(label)}<input name="${name}" value="${e(value)}" type="${options.type||'text'}" maxlength="${options.max||1000}" ${options.required?'required':''} ${options.type==='number'?`min="${options.min??0}" max="${options.maxNumber??1000000}" step="${options.step||1}"`:''}>${options.help?`<span class="field-help">${e(options.help)}</span>`:''}</label>`;
  const area=(label,name,value,required=false)=>`<label class="wide">${e(label)}<textarea name="${name}" maxlength="5000" ${required?'required':''}>${e(value)}</textarea></label>`;
  const checkbox=(label,name,checked)=>`<label class="checkbox-label"><input type="checkbox" name="${name}" ${checked?'checked':''}>${e(label)}</label>`;
  function recordFields(item){
    let fields=input('Name','name',item.name,{required:true});
    if(section==='classes'){
      fields+=`<label>Category<select name="category">${['Dance','Fitness','Kids'].map(x=>`<option ${item.category===x?'selected':''}>${x}</option>`).join('')}</select></label>`+area('Class description','description',item.description,true)+input('Suitable for','audience',item.audience,{required:true})+input('Days & timings','schedule',item.schedule,{required:true,help:'Example: Mon & Wed · 6:00–7:00 PM. Only add timings confirmed by the studio.'})+`<label>Instructor<select name="instructorId"><option value="">Not assigned</option>${data.instructors.map(x=>`<option value="${e(x.id)}" ${item.instructorId===x.id?'selected':''}>${e(x.name)}${!x.published?' (hidden)':''}</option>`).join('')}</select></label>`+input('Fee / enquiry text','fee',item.fee,{help:'Include the billing period if known; otherwise use “Ask for current fees”.'})+checkbox('Highlight this class','featured',item.featured);
    }else if(section==='instructors'){
      fields+=input('Role / speciality','role',item.role,{required:true})+area('About the instructor','bio',item.bio,true)+input('Photo link','photo',item.photo,{wide:true,help:'Paste a link to an approved instructor photo. Ask your website manager if you need to add a new photo.'})+input('Profile link','source',item.source,{wide:true,help:'Optional link to their public profile. Only include confirmed qualifications and classes.'});
    }else{
      fields+=input('Where the review is from','platform',item.platform,{required:true})+area('Review text','quote',item.quote,true)+input('Rating (1–5)','rating',item.rating,{type:'number',min:1,maxNumber:5,required:true})+input('Original review link','source',item.source,{help:'Paste a link to the original review. Only add genuine reviews you have permission to share.'});
    }
    return fields+checkbox('Show on website after updating','published',item.published);
  }
  async function openForm(id=null){
    if(!data || !await canLeave())return;
    dirty=false;editingId=id;
    const blank=section==='classes'?{name:'',category:'Dance',description:'',audience:'',schedule:'Contact the studio for current batches',instructorId:'',fee:'Ask for current fees',featured:false,published:true}:section==='instructors'?{name:'',role:'',bio:'',photo:'',source:'',published:true}:{name:'',quote:'',platform:'Google review excerpt',rating:5,source:'',published:true};
    const item=id?data[section].find(x=>x.id===id):blank;
    document.querySelector('#form-title').textContent=(id?'Edit ':'New ')+singular[section];
    document.querySelector('#editor-content').hidden=true;document.querySelector('#record-editor').hidden=false;
    document.querySelector('#record-form').innerHTML=`<div class="form-grid">${recordFields(item)}</div><div class="form-footer"><button type="submit" class="button">Save changes ✓</button><span>Then click Update website to share your changes.</span></div>`;
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
    const fields=input('Phone / WhatsApp number','phone',item.phone,{required:true,help:'Country code + digits only. Example: 917003414003'})+input('Contact email','email',item.email,{type:'email',required:true})+area('Studio address','address',item.address,true)+input('Studio hours / timing note','hours',item.hours,{wide:true})+input('Directions link','map',item.map,{wide:true,type:'url',required:true})+input('Instagram link','instagram',item.instagram,{type:'url',required:true})+input('Facebook link','facebook',item.facebook,{type:'url',required:true})+input('Google rating','rating',item.rating,{type:'number',min:0,maxNumber:5,step:0.1,required:true})+input('Google review count','reviewCount',item.reviewCount,{type:'number',required:true})+input('Date reviews were checked','reviewDate',item.reviewDate,{required:true,help:'Update numbers only after checking the actual Google listing.'});
    document.querySelector('#editor-content').innerHTML=`<form id="studio-form" class="studio-form"><div class="form-grid">${fields}</div><div class="form-footer"><button class="button" type="submit">Save changes ✓</button><span>Then click Update website to share your changes.</span></div></form>`;
    const form=document.querySelector('#studio-form');form.addEventListener('input',()=>dirty=true);form.addEventListener('submit',event=>{event.preventDefault();const fields=new FormData(form);const next=structuredClone(data);Object.keys(item).forEach(key=>next.studio[key]=['rating','reviewCount'].includes(key)?Number(fields.get(key)):String(fields.get(key)||'').trim());persist(next);});
  }
  document.querySelector('#export-button').addEventListener('click',()=>{
    if(!data || !authenticated()){status('Please log in before downloading a backup.',true);return;}
    try {const clean=validate(data);const blob=new Blob([JSON.stringify(clean,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='content.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status(dirty?'Backup downloaded. Changes you haven’t saved are not included.':'Backup downloaded. Click Update website to share your saved changes.');}catch(error){status(friendlyError(error),true);}
  });
  document.querySelector('#import-button').addEventListener('click',()=>document.querySelector('#import-file').click());
  document.querySelector('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try {if(file.size>1024*1024)throw new Error('File is too large. Maximum size: 1 MB.');const next=validate(JSON.parse(await file.text()));if(!await confirmAction('Restore this backup?','This backup will replace all your saved changes, including classes and instructors. Download a copy of your current changes first if you want to keep them.'))return;if(persist(next,'Backup restored. Review the details before updating your website.')){document.querySelector('#editor-content').hidden=false;render();}}catch(error){status('We couldn’t restore that backup. '+friendlyError(error),true);}
  });
  document.querySelector('#restore-button').addEventListener('click',async()=>{if(!await confirmAction('Get the latest website changes?','This replaces your saved and unsaved changes with the latest website details. Recent updates may still be appearing on the live website. Download a backup first if you want to keep your edits.'))return;try{const remote=await api('content');const previous=baseSha;baseSha=remote.sha;if(persist(remote.content,'The latest website details are ready to edit.')){document.querySelector('#editor-content').hidden=false;render();}else baseSha=previous;}catch(error){status(friendlyError(error),true);}});
  document.querySelector('#publish-button').addEventListener('click',async()=>{
    if(publishing || !data)return;
    if(!authenticated()){status('Please log in again before updating the website. Your saved changes are kept.',true);return;}
    if(dirty){status('Please save or cancel the changes on this form before updating your website.',true);return;}
    if(!baseSha){status('Download a backup, choose Get latest changes, then Restore backup and review your changes before updating.',true);return;}
    if(!await confirmAction('Update your website?','All saved changes will be sent to your website, including any entries you removed. Please allow a few minutes for the update to appear.'))return;
    const button=document.querySelector('#publish-button');publishing=true;button.disabled=true;button.textContent='Updating…';
    try {const result=await api('publish',{sha:baseSha,content:validate(data)});baseSha=result.sha;try{localStorage.setItem(revisionKey,baseSha);}catch{}status(result.message);}catch(error){status(friendlyError(error),true);}finally{publishing=false;button.disabled=false;button.textContent='Update website ↗';}
  });
  document.querySelector('#logout-button').addEventListener('click',async()=>{if(publishing || !await canLeave())return;try{await api('logout',{});}catch(error){status('We couldn’t log you out. '+friendlyError(error),true);return;}dirty=false;signedIn=false;csrf='';data=undefined;document.querySelector('#editor-screen').hidden=true;document.querySelector('#login-screen').hidden=false;document.querySelector('#login-form input').focus();});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  (async()=>{try{const result=await api('session');if(result.authenticated){signedIn=true;csrf=result.csrf;await openEditor();}}catch(error){document.querySelector('#login-error').textContent=friendlyError(error);}})();
  // Optional WebMCP readback mirrors the visible draft; never grants publishing rights.
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController();
    try{Promise.resolve(document.modelContext.registerTool({name:'read_studio_editor_draft',title:'Read KODC editor draft',description:'Read saved classes, instructors and reviews after login. Does not change the website.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No arguments accepted.');if(!authenticated()||!data)throw new Error('Editor is not open.');return structuredClone(data);}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
