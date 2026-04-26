(function(){
  const btn=document.querySelector('.eh-nav-toggle');
  const nav=document.querySelector('.eh-side-nav');
  if(!btn||!nav)return;
  document.body.classList.add('eh-has-sidebar');
  const mq=window.matchMedia('(max-width: 900px)');
  const storageKey='eh_sidebar_collapsed';

  function isMobile(){return mq.matches}
  function sync(){
    const open=document.body.classList.contains('eh-nav-open');
    const collapsed=document.body.classList.contains('eh-nav-collapsed');
    btn.setAttribute('aria-expanded', isMobile()?String(open):String(!collapsed));
    btn.textContent=isMobile()?(open?'×':'☰'):(collapsed?'☰':'‹');
  }
  function setActive(){
    const path=decodeURIComponent(location.pathname);
    nav.querySelectorAll('.eh-nav-link[data-area]').forEach(a=>{
      const area=a.dataset.area;
      const active=(area==='home'&&/\/ehliyet-pratik\/(?:index\.html)?$/.test(path))||
        (area!=='home'&&path.includes('/'+area+'/'));
      a.classList.toggle('active', active);
    });
  }
  btn.addEventListener('click',()=>{
    if(isMobile()){
      document.body.classList.toggle('eh-nav-open');
    }else{
      document.body.classList.toggle('eh-nav-collapsed');
      localStorage.setItem(storageKey, document.body.classList.contains('eh-nav-collapsed')?'1':'0');
    }
    sync();
  });
  document.querySelector('.eh-nav-scrim')?.addEventListener('click',()=>{
    document.body.classList.remove('eh-nav-open');
    sync();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&document.body.classList.contains('eh-nav-open')){
      document.body.classList.remove('eh-nav-open');
      sync();
    }
  });
  mq.addEventListener?.('change',()=>{document.body.classList.remove('eh-nav-open');sync()});
  if(localStorage.getItem(storageKey)==='1')document.body.classList.add('eh-nav-collapsed');
  setActive();
  sync();

  // Apply UI language from localStorage (set by main app's UI toggle)
  function applyLang(){
    const L=localStorage.getItem('eh_uilang')||'tr';
    nav.querySelectorAll('[data-tr]').forEach(el=>{
      const v=el.dataset[L];
      if(v!==undefined)el.textContent=v;
    });
    const langBtn=document.getElementById('eh-nav-lang-btn');
    if(langBtn){
      langBtn.textContent='UI: '+L.toUpperCase();
      langBtn.className='eh-nav-lang'+(L==='en'?' en':'');
    }
  }
  applyLang();
  document.getElementById('eh-nav-lang-btn')?.addEventListener('click',()=>{
    const cur=localStorage.getItem('eh_uilang')||'tr';
    localStorage.setItem('eh_uilang',cur==='tr'?'en':'tr');
    applyLang();
  });
  window.addEventListener('storage',e=>{if(e.key==='eh_uilang')applyLang();});
})();
