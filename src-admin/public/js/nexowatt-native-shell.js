(() => {
    'use strict';

    const VERSION = 'v85-nexowatt-native-shell-brand-eos-assist';
    const previous = window.NEXOWATT_NATIVE_SHELL;
    if (previous?.version === VERSION) return;
    previous?.destroy?.();

    window.NEXOWATT_EOS_UI_VERSION = VERSION;

    const scriptUrl = document.currentScript?.src ||
        document.querySelector('script[src*="nexowatt-native-shell.js"]')?.src || window.location.href;
    const baseUrl = new URL('../', scriptUrl);
    const brandLogoUrl = new URL('img/eos/nexowatt-eos-brand-wide.png', baseUrl).href;
    const abort = new AbortController();
    let unsubscribeDom = null;
    let retryTimer = 0;
    let scheduled = false;
    let destroyed = false;

    const routeClasses = [
        'intro', 'adapters', 'instances', 'objects', 'enums', 'logs', 'users', 'hosts', 'files', 'scripts', 'other',
    ];

    const safe = fn => {
        try { return fn(); } catch (_) { return undefined; }
    };


    // Navigation labels and icons are rendered natively by Drawer.tsx.
    // This runtime only positions the shell and never rewrites React content.

    const currentTab = () => {
        const match = String(window.location.hash || '').match(/tab-[a-z0-9_-]+/i);
        return match ? match[0].toLowerCase() : 'tab-intro';
    };

    const routeKey = tab => {
        if (tab === 'tab-intro') return 'intro';
        if (tab === 'tab-adapters') return 'adapters';
        if (tab === 'tab-instances') return 'instances';
        if (tab === 'tab-objects') return 'objects';
        if (tab === 'tab-enums') return 'enums';
        if (tab === 'tab-logs') return 'logs';
        if (tab === 'tab-users') return 'users';
        if (tab === 'tab-hosts') return 'hosts';
        if (tab === 'tab-files') return 'files';
        if (tab === 'tab-javascript') return 'scripts';
        return 'other';
    };

    const isLogin = () => /(?:^|[?&])login(?:[=&]|$)/i.test(window.location.search || '') ||
        !!document.querySelector('#login, .login-form, input#username, input#password');

    const setShellClasses = () => {
        const root = document.documentElement;
        const login = isLogin();
        const hasApp = !!document.getElementById('app-paper');
        root.classList.add('eos-native-shell');
        root.classList.toggle('eos-login', login);
        root.classList.toggle('eos-app', !login && hasApp);
        routeClasses.forEach(name => root.classList.remove(`eos-route-${name}`));
        if (!login && hasApp) {
            root.classList.add(`eos-route-${routeKey(currentTab())}`);
            root.classList.toggle('eos-objects-surface', currentTab() === 'tab-objects');
        } else {
            root.classList.remove('eos-objects-surface');
        }
    };

    const ensureBrand = () => {
        const toolbar = document.querySelector('#root > .MuiPaper-root > .MuiAppBar-root .MuiToolbar-root, .MuiAppBar-root .MuiToolbar-root');
        if (!toolbar) return;
        toolbar.classList.add('eos-top-toolbar');
        let badge = toolbar.querySelector(':scope > .eos-brand-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'eos-brand-badge eos-system-brand';
            badge.innerHTML = `<span class="eos-brand-badge-full"><img class="eos-brand-badge-full-logo" alt="NexoWatt EOS"></span><span class="eos-brand-led" aria-hidden="true"></span>`;
            toolbar.insertBefore(badge, toolbar.firstChild || null);
        }
        const image = badge.querySelector('img');
        if (image && image.src !== brandLogoUrl) image.src = brandLogoUrl;

        // Only the compact upstream identity is hidden. Navigation labels and
        // icons are rendered natively by Drawer.tsx and are never rewritten here.
        toolbar.querySelectorAll('a[href="/#easy"], a[href="#easy"]').forEach(link => {
            if (link.closest('.eos-brand-badge')) return;
            const wrapper = link.closest('.MuiGrid2-root, .MuiBox-root') || link;
            wrapper.classList.add('eos-native-toolbar-identity-hidden');
            wrapper.setAttribute('aria-hidden', 'true');
        });
        if (window.innerWidth > 700) {
            toolbar.querySelectorAll('button').forEach(button => {
                if (button.closest('.eos-brand-badge')) return;
                if (button.querySelector('svg[data-testid="MenuIcon"]')) {
                    button.classList.add('eos-native-toolbar-menu-hidden');
                    button.setAttribute('aria-hidden', 'true');
                    button.tabIndex = -1;
                }
            });
        }
    };

    const ensureNavigationContainer = () => {
        const drawer = document.querySelector('.MuiDrawer-paper');
        if (!drawer) return;
        drawer.classList.add('eos-drawer');

        const nativeHeader = drawer.querySelector(':scope > div:first-child:not(.MuiList-root)');
        if (nativeHeader && nativeHeader.querySelector('button, a, img, .MuiAvatar-root')) {
            nativeHeader.classList.add('eos-native-drawer-header');
            nativeHeader.setAttribute('aria-hidden', 'true');
        }

        const list = drawer.querySelector('.MuiList-root');
        if (list) {
            list.classList.add('eos-scroll-nav');
        }

        let toggle = drawer.querySelector(':scope > .eos-standalone-nav-toggle');
        if (!toggle) {
            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'eos-standalone-nav-toggle';
            toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="m14.8 5.4-6.6 6.6 6.6 6.6"/></svg>';
            toggle.setAttribute('aria-label', 'Navigation kompakt oder vollständig anzeigen');
            toggle.addEventListener('click', event => {
                event.preventDefault();
                const compact = !document.documentElement.classList.contains('eos-nav-compact');
                document.documentElement.classList.toggle('eos-nav-compact', compact);
                safe(() => localStorage.setItem('nexowatt:eosNavCompact', compact ? '1' : '0'));
                toggle.setAttribute('aria-pressed', compact ? 'true' : 'false');
            }, { signal: abort.signal });
            drawer.insertBefore(toggle, list || drawer.firstChild || null);
        }

        const compact = safe(() => localStorage.getItem('nexowatt:eosNavCompact') === '1') || false;
        document.documentElement.classList.toggle('eos-nav-compact', compact);
        toggle.setAttribute('aria-pressed', compact ? 'true' : 'false');
    };

    const apply = () => {
        if (destroyed) return;
        setShellClasses();
        if (!isLogin()) {
            ensureBrand();
            ensureNavigationContainer();
        }
    };

    const schedule = () => {
        if (scheduled || destroyed) return;
        scheduled = true;
        const run = () => {
            scheduled = false;
            apply();
        };
        if ('requestAnimationFrame' in window) requestAnimationFrame(run);
        else setTimeout(run, 16);
    };

    const connectCoordinator = () => {
        const coordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
        if (!coordinator?.subscribe) {
            retryTimer = window.setTimeout(connectCoordinator, 200);
            return;
        }
        unsubscribeDom = coordinator.subscribe(schedule);
    };

    window.addEventListener('hashchange', schedule, { signal: abort.signal });
    window.addEventListener('resize', schedule, { signal: abort.signal });
    window.addEventListener('pageshow', schedule, { signal: abort.signal });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', schedule, { once: true, signal: abort.signal });
    } else {
        schedule();
    }
    connectCoordinator();
    [250, 750, 1500].forEach(delay => window.setTimeout(schedule, delay));

    window.NEXOWATT_NATIVE_SHELL = {
        version: VERSION,
        refresh: schedule,
        destroy() {
            destroyed = true;
            abort.abort();
            unsubscribeDom?.();
            unsubscribeDom = null;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = 0;
        },
    };
})();
