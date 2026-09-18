'use strict';
(async () => {
  const {escape:e,safeUrl,initials} = KODC;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let motionPaused=reduced;
  try {motionPaused=motionPaused || localStorage.getItem('kodc-motion-paused')==='1';}catch{}
  const motionButton=document.querySelector('#motion-toggle');
  function syncMotion(){document.body.classList.toggle('motion-paused',motionPaused);motionButton.textContent=motionPaused?'Resume animations':'Pause animations';motionButton.setAttribute('aria-pressed',String(motionPaused));}
  syncMotion();
  motionButton.addEventListener('click',()=>{motionPaused=!motionPaused;syncMotion();try{localStorage.setItem('kodc-motion-paused',motionPaused?'1':'0');}catch{}});
  document.querySelector('#load-video').addEventListener('click',()=>{
    const iframe=document.createElement('iframe');
    iframe.src='https://www.youtube-nocookie.com/embed/PQfgnawx3qM?autoplay=1&playsinline=1&rel=0';
    iframe.title='Rock the Party | KODC student hip-hop performance';
    iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.tabIndex=0;
    document.querySelector('#video-container').replaceChildren(iframe);iframe.focus();
    document.querySelector('#video-status').textContent='YouTube player loaded. If playback is unavailable, use “Watch on YouTube”.';
  },{once:true});
  let scrollFrame=0;
  function updateScroll(){scrollFrame=0;const height=document.documentElement.scrollHeight-innerHeight;document.querySelector('.scroll-progress').style.transform='scaleX('+(height>0?scrollY/height:0)+')';}
  addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScroll);},{passive:true});addEventListener('resize',updateScroll);updateScroll();
  const nav = document.querySelector('#navigation');
  const toggle = document.querySelector('.menu-toggle');
  const closeMenu = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Open navigation'); };
  toggle.addEventListener('click', () => { const open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open)); toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation'); });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event=>{ if(event.key==='Escape') closeMenu(); });
  document.querySelector('#year').textContent = new Date().getFullYear();
  const privacy = document.querySelector('#privacy-dialog');
  document.querySelector('#privacy-button').addEventListener('click',()=>privacy.showModal());
  privacy.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>privacy.close()));
  let data;
  try {
    const preview = new URLSearchParams(location.search).get('preview')==='1';
    data = preview ? KODC.loadDraft() || await KODC.loadPublished() : await KODC.loadPublished();
    if(preview){document.querySelector('#preview-banner').hidden=false;document.querySelector('head').insertAdjacentHTML('beforeend','<meta name="robots" content="noindex,nofollow">');}
  } catch(error) {
    document.querySelector('#class-grid').innerHTML=`<p class="content-loading" role="alert">${e(error.message)} <a href="tel:+917003414003">Call the studio</a>.</p>`;
    return;
  }
  const studio = data.studio;
  const wa = name => 'https://wa.me/'+studio.phone+'?text='+encodeURIComponent('Hi KODC! I would like to enquire about '+(name || 'your classes')+'. Please share the current timings and fees.');
  document.querySelectorAll('.whatsapp-link').forEach(a=>a.href=wa());
  document.querySelectorAll('.phone-link').forEach(a=>a.href='tel:+'+studio.phone);
  document.querySelector('.contact-phone').textContent='+'+studio.phone.replace(/^(\d{2})(\d{5})(\d{5})$/,'$1 $2 $3');
  const email = document.querySelector('#email-link');email.textContent=studio.email;email.href='mailto:'+studio.email;
  document.querySelector('#studio-address').textContent=studio.address;
  document.querySelector('#business-hours').textContent=studio.hours;
  document.querySelector('#map-link').href=safeUrl(studio.map);
  document.querySelector('#instagram-link').href=safeUrl(studio.instagram);
  document.querySelector('#facebook-link').href=safeUrl(studio.facebook);
  document.querySelector('#hero-rating').textContent=studio.rating;
  document.querySelector('#hero-review-count').textContent=studio.reviewCount;
  document.querySelector('#review-rating').innerHTML=e(studio.rating)+' <span>/ 5</span>';
  document.querySelector('.review-summary .stars').setAttribute('aria-label',studio.rating+' out of 5 stars');
  document.querySelector('.review-summary small').textContent='Google · checked '+studio.reviewDate;
  document.querySelector('.counter[data-decimals]').dataset.number=studio.rating;
  document.querySelector('#review-counter').dataset.number=studio.reviewCount;
  const classes = data.classes.filter(x=>x.published);
  const instructors = data.instructors.filter(x=>x.published);
  document.querySelector('#class-counter').dataset.number=classes.length;
  const structured = document.querySelector('script[type="application/ld+json"]');
  const schema=JSON.parse(structured.textContent);schema.telephone='+'+studio.phone;schema.email=studio.email;schema.address={"@type":"PostalAddress","streetAddress":studio.address,"addressCountry":"IN"};schema.sameAs=[studio.instagram,studio.facebook];structured.textContent=JSON.stringify(schema);
  function renderClasses(filter='all',animate=false) {
    const list=classes.filter(x=>filter==='all'||x.category===filter);
    document.querySelector('#class-grid').innerHTML = list.length ? list.map(item=>{
      const instructor=instructors.find(x=>x.id===item.instructorId);
      const index=String(classes.indexOf(item)+1).padStart(2,'0');
      return `<article class="class-card ${item.featured?'featured':''} ${animate?'filter-enter':''}"><div class="card-top"><span class="class-number" aria-hidden="true">${index}</span><span class="pill">${e(item.category)}</span></div><h3>${e(item.name)}</h3><p>${e(item.description)}</p><div class="class-meta"><span>${e(item.audience)}</span><span>◷ ${e(item.schedule || 'Contact the studio for timings')}</span>${instructor?`<span>With ${e(instructor.name)}</span>`:''}<span>${e(item.fee || 'Ask for current fees')}</span></div><a class="text-link" href="${e(wa(item.name))}" target="_blank" rel="noopener noreferrer" aria-label="Enquire about ${e(item.name)} on WhatsApp">Let’s do this <span aria-hidden="true">↗</span></a></article>`;
    }).join('') : '<p class="content-loading">No classes listed in this category yet. Contact the studio for options.</p>';
  }
  renderClasses();
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderClasses(button.dataset.filter,true);
  }));
  document.querySelector('#instructor-grid').innerHTML=instructors.map(item=>`<article class="instructor-card"><div class="instructor-avatar">${item.photo?`<img src="${e(safeUrl(item.photo,true))}" alt="${e(item.name)}" loading="lazy">`:`<span aria-hidden="true">${e(initials(item.name))}</span>`}</div><h3>${e(item.name)}</h3><p class="instructor-role">${e(item.role)}</p><p>${e(item.bio)}</p>${item.source?`<a class="text-link" href="${e(safeUrl(item.source))}" target="_blank" rel="noopener noreferrer">Public profile <span aria-hidden="true">↗</span></a>`:''}</article>`).join('')+(instructors.length<3?`<div class="team-note" style="grid-column:span ${Math.max(1,3-instructors.length)}"><p class="eyebrow">GOOD ENERGY IS CONTAGIOUS</p><h3>A new class.<br>A new connection.</h3><p>Not sure which class is right for you? Talk to the studio about the current instructors, class levels and available batches.</p><a class="text-link" href="${e(wa())}" target="_blank" rel="noopener noreferrer">Find your fit <span aria-hidden="true">↗</span></a></div>`:'');
  document.querySelector('#review-grid').innerHTML=data.testimonials.filter(x=>x.published).map(item=>`<article class="review-card"><span class="stars" aria-label="${item.rating} out of 5 stars">${'★'.repeat(item.rating)}</span><blockquote>“${e(item.quote)}”</blockquote><div class="review-author"><span class="initials" aria-hidden="true">${e(initials(item.name))}</span><div><strong>${e(item.name)}</strong><small>${e(item.platform)}</small></div>${item.source?`<a href="${e(safeUrl(item.source))}" target="_blank" rel="noopener noreferrer" aria-label="Read ${e(item.name)}’s review at its source">Source ↗</a>`:''}</div></article>`).join('') || '<p>No testimonials published yet.</p>';
  const imageFallback=event=>{event.target.src='assets/logo.jpeg';event.target.alt='KODC Dance & Fitness Kolkata logo';event.target.classList.add('hero-logo');event.target.removeEventListener('error',imageFallback);};
  document.querySelectorAll('.hero-image-frame img,.studio-art img').forEach(img=>img.addEventListener('error',imageFallback));
  document.querySelectorAll('.instructor-avatar img').forEach(img=>img.addEventListener('error',()=>{img.parentElement.innerHTML=`<span aria-hidden="true">${e(initials(img.alt))}</span>`;},{once:true}));
  const revealTargets=document.querySelectorAll('.section-heading,.performance-intro,.performance-player,.class-card,.studio-layout,.numbers>div,.instructor-card,.team-note,.review-card,.contact-section');
  if(!reduced && 'IntersectionObserver' in window){
    document.body.classList.add('motion-ready');
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08});
    revealTargets.forEach((element,index)=>{element.classList.add('reveal');element.style.transitionDelay=(index%3)*70+'ms';observer.observe(element);});
  }
  function count(element){const target=Number(element.dataset.number);const decimals=Number(element.dataset.decimals || 0);if(reduced || motionPaused){element.textContent=target.toFixed(decimals);return;}const start=performance.now();function tick(now){const t=Math.min(1,(now-start)/1600);element.textContent=(target*(1-Math.pow(1-t,3))).toFixed(decimals);if(t<1)requestAnimationFrame(tick);}requestAnimationFrame(tick);}
  const counters=document.querySelectorAll('.counter');
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){count(entry.target);observer.unobserve(entry.target);}}),{threshold:.5});counters.forEach(x=>observer.observe(x));}else counters.forEach(count);
  if(!reduced){
    const typewriter=document.querySelector('#typewriter');const words=['dancing.','energy.','rhythm.','you.'];let word=0,character=words[0].length,deleting=true;
    function type(){if(motionPaused || document.hidden){if(motionPaused)typewriter.textContent=words[word];setTimeout(type,600);return;}const text=words[word];if(deleting){character--;typewriter.textContent=text.slice(0,character);if(character===0){deleting=false;word=(word+1)%words.length;setTimeout(type,250);return;}}else{character++;typewriter.textContent=words[word].slice(0,character);if(character===words[word].length){deleting=true;setTimeout(type,2000);return;}}setTimeout(type,deleting?70:110);}
    setTimeout(type,2500);
  }
})();
