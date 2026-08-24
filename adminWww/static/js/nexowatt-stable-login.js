/* NexoWatt EOS stable login runtime 7.10.0 */
(() => {
    'use strict';
    const VERSION = 'v7100-clean-login';
    const MANAGED_USERS = new Set(['installer', 'guest', 'user']);
    const ASSIST_TEXT = /EOS\s*Assist/i;
    const PASSWORDLESS_TEXT = /Erstanmeldung\s+ohne\s+Passwort|first\s+sign-?in\s+without\s+password/i;
    const isLogin = () => /(?:\?|&)login(?:[=&]|$)/i.test(location.search) || /\/login(?:[/?#]|$)/i.test(location.pathname + location.hash);
    const visible = element => !!element && element.getClientRects().length > 0;
    const findInput = kind => {
        const inputs = [...document.querySelectorAll('input')].filter(visible);
        if (kind === 'password') return inputs.find(input => input.type === 'password');
        return inputs.find(input => input.type !== 'password' && /user|login|name/i.test(`${input.name} ${input.id} ${input.autocomplete} ${input.getAttribute('aria-label') || ''}`)) || inputs.find(input => input.type !== 'password');
    };
    const findSubmit = () => [...document.querySelectorAll('button,input[type="submit"]')].find(element => visible(element) && (/anmelden|login|sign in/i.test((element.textContent || element.value || '').trim()) || element.type === 'submit'));
    const normalizeUser = value => String(value || '').trim().toLowerCase().replace(/^system\.user\./, '');
    const normalizeGeometry = () => {
        document.querySelectorAll('[data-nw-login-card],[data-nw-login-shell]').forEach(element => {
            if (!element.classList.contains('MuiPaper-root') && !element.classList.contains('eos-login-card-modern')) {
                element.removeAttribute('data-nw-login-card');
                element.removeAttribute('data-nw-login-shell');
            }
        });
        for (const input of [findInput('user'), findInput('password')].filter(Boolean)) {
            const control = input.closest('.MuiFormControl-root');
            const label = control?.querySelector('.MuiInputLabel-root');
            if (control && label) {
                const localized = String(label.textContent || input.getAttribute('aria-label') || '').trim();
                if (localized) control.dataset.eosLoginLabel = localized;
                label.classList.add('MuiInputLabel-shrink');
                label.dataset.shrink = 'true';
                label.removeAttribute('aria-hidden');
            }
        }
    };
    const sync = () => {
        if (!isLogin() && !document.querySelector('input#username,input[name="username"]')) return;
        document.documentElement.classList.add('nw-eos-login-v7100');
        document.body?.classList.add('nw-eos-login-v7100');
        normalizeGeometry();
        const username = findInput('user');
        const password = findInput('password');
        const submit = findSubmit();
        if (submit && MANAGED_USERS.has(normalizeUser(username?.value)) && !String(password?.value || '')) {
            submit.disabled = true;
            submit.setAttribute('aria-disabled', 'true');
        }
    };
    const hideLegacyUi = () => {
        for (const element of document.querySelectorAll('button,a,[role="button"],div,span')) {
            const value = (element.textContent || '').trim();
            if (!value || value.length > 100) continue;
            if (ASSIST_TEXT.test(value) || PASSWORDLESS_TEXT.test(value)) {
                const target = element.closest('button,a,[role="button"],[data-eos-assist],.eos-assist') || element;
                target.style.setProperty('display', 'none', 'important');
                target.setAttribute('aria-hidden', 'true');
            }
        }
    };
    const apply = () => { sync(); hideLegacyUi(); };
    let scheduled = false;
    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; apply(); });
    };
    new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true }); else apply();
    window.NEXOWATT_EOS_STABLE_LOGIN = Object.freeze({ version: VERSION, refresh: apply });
})();
