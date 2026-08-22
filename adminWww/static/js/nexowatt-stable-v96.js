(() => {
    'use strict';
    const VERSION = 'v96-spacious-login-first-password-fix';
    const MANAGED_USERS = new Set(['installer', 'guest', 'user']);
    const ASSIST_TEXT = /EOS\s*Assist/i;
    const normalizeUser = value => String(value || '').trim().toLowerCase().replace(/^system\.user\./, '');
    const styleId = 'nexowatt-stable-v96-style';

    const ensureStyle = () => {
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            html.eos-login,html.eos-login body{margin:0!important;overflow-x:hidden!important;overflow-y:auto!important}
            html.eos-login main.MuiPaper-root{box-sizing:border-box!important}
            html.eos-login main.MuiPaper-root::before{width:min(520px,calc(100vw - 24px))!important;min-height:590px!important;height:min(640px,calc(100dvh - 24px))!important}
            html.eos-login .eos-login-card-modern,
            html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#username),
            html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#password),
            html.eos-login [data-nw-login-card="true"]{
                width:min(460px,calc(100vw - 56px))!important;
                min-height:540px!important;
                height:auto!important;
                max-width:460px!important;
                max-height:none!important;
                padding:34px 36px 32px!important;
                overflow:visible!important;
                box-sizing:border-box!important
            }
            html.eos-login .MuiAlert-root,html.eos-login [role="alert"]{position:static!important;width:100%!important;max-width:100%!important;max-height:none!important;overflow:visible!important;white-space:normal!important;overflow-wrap:anywhere!important;flex-shrink:0!important}
            html.eos-login .eos-login-card-modern *,html.eos-login [data-nw-login-card="true"] *{box-sizing:border-box;max-width:100%}
            html.eos-assist-disabled .eos-assist-root,html.eos-assist-disabled .eos-assist-header-root,[data-eos-assist-root]{display:none!important}
            @media(max-width:560px){html.eos-login .eos-login-card-modern,html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#username),html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#password),html.eos-login [data-nw-login-card="true"]{width:calc(100vw - 38px)!important;max-width:none!important;min-height:0!important;padding:26px 22px!important}}
            @media(max-height:690px){html.eos-login .eos-login-card-modern,html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#username),html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#password),html.eos-login [data-nw-login-card="true"]{min-height:0!important}}
        `;
        document.head.appendChild(style);
    };

    const findCard = (username, password) => username?.closest?.('.MuiPaper-root,form,main,section')
        || password?.closest?.('.MuiPaper-root,form,main,section');
    const findSubmit = card => card?.querySelector?.('button[type="submit"]')
        || Array.from(card?.querySelectorAll?.('button') || []).find(button => /anmelden|login|sign in|aanmelden/i.test(button.textContent || ''));

    const apply = () => {
        ensureStyle();
        document.documentElement.classList.add('eos-assist-disabled');
        document.querySelectorAll('.eos-assist-root,.eos-assist-header-root,[data-eos-assist-root],.eos-passwordless-launcher')
            .forEach(element => element.remove());
        const username = document.querySelector('input#username,input[name="username"]');
        const password = document.querySelector('input#password,input[name="password"]');
        const name = normalizeUser(username?.value);
        const pass = String(password?.value || '');
        const card = findCard(username, password);
        const submit = findSubmit(card);
        if (submit && MANAGED_USERS.has(name) && !pass) {
            submit.disabled = true;
            submit.classList.add('Mui-disabled');
            submit.setAttribute('aria-disabled', 'true');
        }
        document.querySelectorAll('body *').forEach(element => {
            if (element.children.length) return;
            const value = element.textContent || '';
            if (/\[iobroker\.eos-admin@[^\]]+\]/i.test(value)) element.textContent = value.replace(/\[iobroker\.eos-admin@[^\]]+\]/ig, '[NexoWatt]');
            if (ASSIST_TEXT.test(value) && element.closest?.('.eos-assist-root,.eos-assist-header-root')) element.closest('.eos-assist-root,.eos-assist-header-root')?.remove();
        });
    };

    let scheduled = false;
    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; apply(); });
    };
    const start = () => {
        apply();
        new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
        document.addEventListener('input', schedule, true);
        document.addEventListener('change', schedule, true);
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start, { once: true }) : start();
    window.NEXOWATT_EOS_STABLE_V96 = { version: VERSION, refresh: apply };
})();
