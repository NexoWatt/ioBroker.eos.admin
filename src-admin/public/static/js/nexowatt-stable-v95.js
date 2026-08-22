(() => {
    'use strict';
    const VERSION = 'v95-merge-safe-stable';
    const MANAGED_USERS = new Set(['installer', 'guest', 'user']);
    const ASSIST_TEXT = /EOS\s*Assist/i;
    const normalizeUser = value => String(value || '').trim().toLowerCase().replace(/^system\.user\./, '');
    const styleId = 'nexowatt-stable-v95-style';

    const ensureStyle = () => {
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            html.eos-login main.MuiPaper-root::before {
                width:min(410px,calc(100vw - 24px))!important;
                min-height:590px!important;
                height:auto!important;
            }
            html.eos-login .eos-login-card-modern,
            html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#username),
            html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#password) {
                width:min(354px,calc(100vw - 56px))!important;
                min-height:540px!important;
                height:auto!important;
                max-height:none!important;
                overflow:visible!important;
            }
            html.eos-login .MuiAlert-root { flex-shrink:0!important; }
            html.eos-assist-disabled .eos-assist-root,
            html.eos-assist-disabled .eos-assist-header-root,
            [data-eos-assist-root] { display:none!important; }
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
            const text = element.textContent || '';
            if (/\[iobroker\.eos-admin@[^\]]+\]/i.test(text)) {
                element.textContent = text.replace(/\[iobroker\.eos-admin@[^\]]+\]/ig, '[NexoWatt]');
            }
            if (ASSIST_TEXT.test(text) && element.closest?.('.eos-assist-root,.eos-assist-header-root')) {
                element.closest('.eos-assist-root,.eos-assist-header-root')?.remove();
            }
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
    window.NEXOWATT_EOS_STABLE_V95 = { version: VERSION, refresh: apply };
})();
