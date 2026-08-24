(() => {
    'use strict';
    const VERSION = 'v7100-scroll-login-auto-update';
    const MANAGED_USERS = new Set(['installer', 'guest', 'user']);
    const normalizeUser = value => String(value || '').trim().toLowerCase().replace(/^system\.user\./, '');
    const INTRO_STYLE_PROPERTIES = [
        'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-height', 'max-height',
        'margin', 'overflow-x', 'overflow-y', 'overscroll-behavior', 'scrollbar-gutter',
    ];
    const isIntroRoute = () => {
        const hash = decodeURIComponent(window.location.hash || '').toLowerCase();
        const explicitTab = hash.match(/(?:^|[#/])(tab-[a-z0-9_-]+)(?:[/?&]|$)/)?.[1] || '';
        if (explicitTab) return explicitTab === 'tab-intro';
        return document.documentElement.classList.contains('eos-route-intro')
            || !hash
            || hash === '#'
            || hash === '#/';
    };
    const bindScrollInput = paper => {
        if (paper.dataset.nexowattScrollBound === 'true') return;
        paper.dataset.nexowattScrollBound = 'true';
        paper.addEventListener('wheel', event => {
            if (!event.deltaY || paper.scrollHeight <= paper.clientHeight + 1) return;
            const before = paper.scrollTop;
            paper.scrollTop += event.deltaY;
            if (paper.scrollTop !== before) event.preventDefault();
        }, { passive: false });
        paper.addEventListener('keydown', event => {
            if (paper.scrollHeight <= paper.clientHeight + 1) return;
            const step = Math.max(120, Math.round(paper.clientHeight * .78));
            if (event.key === 'PageDown') paper.scrollTop += step;
            else if (event.key === 'PageUp') paper.scrollTop -= step;
            else if (event.key === 'Home' && event.ctrlKey) paper.scrollTop = 0;
            else if (event.key === 'End' && event.ctrlKey) paper.scrollTop = paper.scrollHeight;
            else return;
            event.preventDefault();
        });
    };
    const disableCockpitScroll = () => {
        const root = document.documentElement;
        root.classList.remove('eos-intro-scroll-enabled');
        const paper = document.getElementById('app-paper');
        if (!paper || paper.dataset.nexowattScrollable !== 'true') return;
        delete paper.dataset.nexowattScrollable;
        for (const property of INTRO_STYLE_PROPERTIES) paper.style.removeProperty(property);
    };
    const ensureCockpitScroll = () => {
        const root = document.documentElement;
        const paper = document.getElementById('app-paper');
        if (!paper || !root.classList.contains('eos-app')) return;
        if (!isIntroRoute()) {
            disableCockpitScroll();
            return;
        }
        // eos-route-* is owned by the native shell; only add our dedicated scroll flag.
        root.classList.add('eos-intro-scroll-enabled');
        paper.dataset.nexowattScrollable = 'true';
        if (paper.tabIndex < 0) paper.tabIndex = 0;
        const styles = {
            position: 'fixed',
            top: 'var(--nx-content-top, 154px)',
            right: 'var(--nx-page-x, 12px)',
            bottom: '8px',
            left: 'var(--nx-page-x, 12px)',
            width: 'auto',
            height: 'auto',
            minHeight: '0',
            maxHeight: 'none',
            margin: '0',
            overflowX: 'hidden',
            overflowY: 'scroll',
            overscrollBehavior: 'contain',
            scrollbarGutter: 'stable',
        };
        for (const [name, value] of Object.entries(styles)) {
            paper.style.setProperty(name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`), value, 'important');
        }
        bindScrollInput(paper);
    };
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
        ensureCockpitScroll();
    };
    let scheduled = false;
    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; apply(); });
    };
    const start = () => {
        apply();
        new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
        document.addEventListener('input', schedule, true);
        document.addEventListener('change', schedule, true);
        window.addEventListener('hashchange', schedule);
        window.addEventListener('resize', schedule, { passive: true });
        window.setInterval(ensureCockpitScroll, 750);
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start, { once: true }) : start();
    window.NEXOWATT_EOS_STABLE_V7100 = Object.freeze({ version: VERSION, refresh: apply, ensureCockpitScroll, disableCockpitScroll });
})();
