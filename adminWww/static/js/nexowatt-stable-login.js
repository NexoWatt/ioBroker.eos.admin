/* NexoWatt EOS stable runtime v94 */
(() => {
  'use strict';
  const MANAGED_USERS = new Set(['installer', 'guest', 'user']);
  const ASSIST_TEXT = /EOS\s*Assist/i;
  const PASSWORDLESS_TEXT = /Erstanmeldung\s+ohne\s+Passwort|first\s+sign-?in\s+without\s+password/i;
  const isLogin = () => /(?:\?|&)login(?:[=&]|$)/i.test(location.search) || /\/login(?:[/?#]|$)/i.test(location.pathname + location.hash);
  const visible = el => !!el && el.getClientRects().length > 0;
  const findInput = kind => {
    const inputs = [...document.querySelectorAll('input')].filter(visible);
    if (kind === 'password') return inputs.find(i => i.type === 'password');
    return inputs.find(i => i.type !== 'password' && /user|login|name/i.test(`${i.name} ${i.id} ${i.autocomplete} ${i.getAttribute('aria-label')||''}`)) || inputs.find(i => i.type !== 'password');
  };
  const findSubmit = () => [...document.querySelectorAll('button,input[type="submit"]')].find(el => visible(el) && (/anmelden|login|sign in/i.test((el.textContent||el.value||'').trim()) || el.type === 'submit'));
  const commonAncestor = (a,b) => {
    if (!a || !b) return null;
    const parents = new Set(); let n=a;
    while(n){parents.add(n);n=n.parentElement;}
    n=b; while(n&&!parents.has(n))n=n.parentElement;
    return n;
  };
  const markLogin = () => {
    if (!isLogin()) return;
    document.documentElement.classList.add('nw-eos-login-v94');
    document.body?.classList.add('nw-eos-login-v94');
    const u=findInput('user'), p=findInput('password'), submit=findSubmit();
    if (u && p) {
      let card=commonAncestor(u,p);
      while(card && card.parentElement && card.querySelectorAll('input').length < 2) card=card.parentElement;
      if (card) {
        card.setAttribute('data-nw-login-card','true');
        let outer=card.parentElement;
        for(let i=0;i<3 && outer?.parentElement;i++){
          if(outer.getBoundingClientRect().width > card.getBoundingClientRect().width+20) break;
          outer=outer.parentElement;
        }
        outer?.setAttribute('data-nw-login-shell','true');
      }
      const sync=()=>{
        const name=(u.value||'').trim().toLowerCase();
        const pass=p.value||'';
        if(submit && MANAGED_USERS.has(name) && !pass){
          submit.disabled=true;
          submit.setAttribute('aria-disabled','true');
        }
      };
      if(!u.dataset.nwV94){u.dataset.nwV94='1';u.addEventListener('input',sync);p.addEventListener('input',sync);sync();}
    }
  };
  const hideLegacyUi = () => {
    for (const el of document.querySelectorAll('button,a,[role="button"],div,span')) {
      const text=(el.textContent||'').trim();
      if(!text || text.length>100) continue;
      if(ASSIST_TEXT.test(text) || PASSWORDLESS_TEXT.test(text)){
        const target=el.closest('button,a,[role="button"],[data-eos-assist],.eos-assist') || el;
        target.style.setProperty('display','none','important');
        target.setAttribute('aria-hidden','true');
      }
    }
  };
  const apply=()=>{markLogin();hideLegacyUi();};
  const style=document.createElement('style');
  style.id='nw-eos-stable-v94-css';
  style.textContent=`
    html.nw-eos-login-v94,body.nw-eos-login-v94{min-height:100%;overflow-x:hidden!important;overflow-y:auto!important}
    .nw-eos-login-v94 [data-nw-login-shell="true"]{width:min(410px,calc(100vw - 28px))!important;min-height:540px!important;height:auto!important;max-height:none!important;overflow:visible!important;box-sizing:border-box!important;padding:22px!important}
    .nw-eos-login-v94 [data-nw-login-card="true"]{width:min(354px,calc(100vw - 56px))!important;min-height:474px!important;height:auto!important;max-height:none!important;overflow:visible!important;box-sizing:border-box!important;padding-bottom:26px!important}
    .nw-eos-login-v94 [data-nw-login-card="true"] *{scrollbar-width:none}
    .nw-eos-login-v94 [data-nw-login-card="true"] *::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
    .nw-eos-login-v94 [data-nw-login-card="true"] [role="alert"]{position:static!important;max-height:none!important;overflow:visible!important;white-space:normal!important}
    [data-eos-assist],.eos-assist,.nexowatt-eos-assist{display:none!important}
    @media(max-height:620px){.nw-eos-login-v94 [data-nw-login-shell="true"]{min-height:0!important;margin:16px auto!important}.nw-eos-login-v94 [data-nw-login-card="true"]{min-height:0!important}}
  `;
  (document.head||document.documentElement).appendChild(style);
  const observer=new MutationObserver(()=>requestAnimationFrame(apply));
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setInterval(apply,1500);
})();
