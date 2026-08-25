(() => {
    'use strict';
    const VERSION = 'v7107-scroll-standard-password';
    const ensureScroll = () => {
        const root = document.documentElement;
        const paper = document.getElementById('app-paper');
        if (!paper || !root.classList.contains('eos-app') || !root.classList.contains('eos-route-intro')) return;
        paper.dataset.nexowattScrollable = 'true';
        paper.style.setProperty('overflow-x','hidden','important');
        paper.style.setProperty('overflow-y','scroll','important');
        paper.style.setProperty('height','calc(100dvh - var(--nx-content-top) - 12px)','important');
        paper.style.setProperty('max-height','calc(100dvh - var(--nx-content-top) - 12px)','important');
        paper.style.setProperty('min-height','0','important');
    };
    const apply = () => {
        document.documentElement.classList.add('eos-assist-disabled');
        document.documentElement.classList.remove('eos-first-login-active');
        document.querySelectorAll('.eos-assist-root,.eos-assist-header-root,[data-eos-assist-root],.eos-passwordless-launcher,.eos-first-login-overlay')
            .forEach(element => element.remove());
        ensureScroll();
    };
    let scheduled=false;
    const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply();});};
    const start=()=>{apply();new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('hashchange',schedule);window.addEventListener('resize',schedule,{passive:true});};
    document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
    window.NEXOWATT_EOS_STABLE_V7107=Object.freeze({version:VERSION,refresh:apply,ensureScroll});
})();
