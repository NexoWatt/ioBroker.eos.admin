(() => {
    'use strict';
    const VERSION = 'v99-compact-login-ems-connection';
    const MANAGED_USERS = new Set(['installer', 'guest', 'user']);
    const normalizeUser = value => String(value || '').trim().toLowerCase().replace(/^system\.user\./, '');
    const apply = () => {
        document.documentElement.classList.add('eos-assist-disabled');
        document.querySelectorAll('.eos-assist-root,.eos-assist-header-root,[data-eos-assist-root],.eos-passwordless-launcher')
            .forEach(element => element.remove());
        const username = document.querySelector('input#username,input[name="username"]');
        const password = document.querySelector('input#password,input[name="password"]');
        const submit = document.querySelector('button[type="submit"],input[type="submit"]');
        if (submit && MANAGED_USERS.has(normalizeUser(username?.value)) && !String(password?.value || '')) {
            submit.disabled = true;
            submit.classList.add('Mui-disabled');
            submit.setAttribute('aria-disabled', 'true');
        }
    };
    let scheduled = false;
    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; apply(); });
    };
    const start = () => {
        apply();
        new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
        document.addEventListener('input', schedule, true);
        document.addEventListener('change', schedule, true);
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start, { once: true }) : start();
    window.NEXOWATT_EOS_STABLE_V99 = Object.freeze({ version: VERSION, refresh: apply });
})();
