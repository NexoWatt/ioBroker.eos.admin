(() => {
    'use strict';

    const VERSION = 'v7108-nexowatt-native-shell-modern-core-surfaces';
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
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match] || match));
    const TECHNICAL_SURFACES = Object.freeze({
        instances: {
            eyebrow: 'EOS SYSTEMDIENSTE',
            title: 'Dienste & Instanzen',
            text: 'Laufzeit, Status, Ressourcen und Konfiguration aller aktiven EOS-Dienste auf einen Blick.',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01M8 17h.01M12 7h5M12 17h5"/></svg>',
        },
        objects: {
            eyebrow: 'EOS DATENEBENE',
            title: 'Datenpunkte & Zustände',
            text: 'Messwerte, Status und freigegebene Steuerwerte in einer klaren technischen Ansicht.',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 10.9 15.7 7M8.3 13.1l7.4 3.9"/></svg>',
        },
        logs: {
            eyebrow: 'EOS DIAGNOSE',
            title: 'Systemlogs',
            text: 'Live-Protokoll für Adapter, Dienste und Systemereignisse mit klarer Priorisierung.',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14M5 10h14M5 15h9M5 20h6"/><circle cx="18" cy="17" r="3"/><path d="m20.2 19.2 1.8 1.8"/></svg>',
        },
    });

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
            badge = document.createElement('button');
            badge.type = 'button';
            badge.className = 'eos-brand-badge eos-system-brand';
            badge.setAttribute('aria-label', 'Zur NexoWatt EOS Übersicht');
            badge.innerHTML = `<span class="eos-brand-badge-full"><img class="eos-brand-badge-full-logo" alt="NexoWatt EOS"></span><span class="eos-brand-led" aria-hidden="true"></span>`;
            badge.addEventListener('click', event => {
                event.preventDefault();
                window.location.hash = '#tab-intro';
            }, { signal: abort.signal });
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

    const ensureModernOverview = () => {
        const paper = document.getElementById('app-paper');
        const role = String(window.NEXOWATT_EOS_ACCESS_ROLE || 'unknown').toLowerCase();
        if (!paper || isLogin() || currentTab() !== 'tab-intro' || role === 'unknown') {
            const staleHero = document.getElementById('eos-native-overview-hero');
            if (staleHero?.dataset.eosRuntimeOverviewHero === 'true') staleHero.remove();
            return;
        }
        const config = role === 'admin'
            ? { label: 'Admin / Service', text: 'Systemstatus, Module, Dienste und Anlagenzugänge in einer modernen Serviceübersicht.' }
            : role === 'installer' || role === 'installateur'
                ? { label: 'Installateur', text: 'Inbetriebnahme, Fehlersuche, Geräte- und EMS-Diagnose – mit deinen freigegebenen Installateurrechten.' }
                : { label: 'Endkunde', text: 'Energie, Laden, Gebäude und die aktuellen EMS-Entscheidungen auf einen Blick.' };
        let hero = document.getElementById('eos-native-overview-hero');
        // A freshly built Intro.tsx owns this node. Do not rewrite React children.
        if (hero?.dataset.eosNativeReactOverview === 'true') return;
        // The bundled Admin-7 runtime predates the React hero. Supply one compatibility node until
        // the next complete frontend rebuild; it uses the same role text and native-card surface.
        if (!hero) {
            hero = document.createElement('section');
            hero.id = 'eos-native-overview-hero';
            hero.className = 'eos-overview-hero eos-native-overview-hero';
            hero.dataset.eosRuntimeOverviewHero = 'true';
            paper.insertBefore(hero, paper.firstChild || null);
        }
        if (hero.dataset.eosRuntimeOverviewHero !== 'true') return;
        hero.innerHTML = `
            <div><span class="eos-overview-eyebrow">NexoWatt EOS</span><h1>Übersicht</h1><p>${config.text}</p></div>
            <div class="eos-overview-role" data-nexowatt-overview-role="${role}"><span class="eos-overview-status-dot"></span>${config.label}</div>`;
    };

    const roleLabel = () => {
        const role = String(window.NEXOWATT_EOS_ACCESS_ROLE || 'unknown').toLowerCase();
        if (role === 'admin') return 'Admin / Service';
        if (role === 'installer' || role === 'installateur') return 'Installateur';
        return 'Endkunde';
    };

    const classifyTechnicalRows = (paper, surface) => {
        if (!paper || !surface) return;
        if (surface === 'instances') {
            paper.querySelectorAll('.MuiAccordion-root,tbody tr,.MuiTableRow-root,[role="row"]').forEach(row => {
                if (row.closest?.('.eos-technical-surface-header') || row.classList.contains('MuiTableHead-root')) return;
                row.classList.add('eos-service-row');
                const expanded = row.classList.contains('Mui-expanded') || !!row.querySelector?.('[aria-expanded="true"]');
                row.classList.toggle('eos-service-row-expanded', expanded);
            });
            return;
        }
        if (surface === 'objects') {
            paper.querySelectorAll('[role="row"],.MuiTableRow-root,.MuiDataGrid-row').forEach(row => {
                if (row.closest?.('.eos-technical-surface-header')) return;
                row.classList.add('eos-datapoint-row');
            });
            return;
        }
        if (surface === 'logs') {
            paper.querySelectorAll('tbody tr,.MuiTableRow-root,[role="row"]').forEach(row => {
                if (row.closest?.('.eos-technical-surface-header')) return;
                const text = String(row.textContent || '').toLowerCase();
                let level = 'info';
                if (/\b(error|fatal|fehler|kritisch|critical)\b/.test(text)) level = 'error';
                else if (/\b(warn|warning|warnung)\b/.test(text)) level = 'warn';
                else if (/\b(debug|trace)\b/.test(text)) level = 'debug';
                row.classList.remove('eos-log-row-error','eos-log-row-warn','eos-log-row-info','eos-log-row-debug');
                row.classList.add('eos-log-row', `eos-log-row-${level}`);
                row.dataset.eosLogLevel = level;
            });
        }
    };

    const ensureTechnicalSurface = () => {
        const paper = document.getElementById('app-paper');
        if (!paper || isLogin()) return;
        const surface = routeKey(currentTab());
        const config = TECHNICAL_SURFACES[surface];
        const existing = document.getElementById('eos-technical-surface-header');
        if (!config) {
            existing?.remove();
            paper.removeAttribute('data-eos-technical-surface');
            return;
        }
        paper.setAttribute('data-eos-technical-surface', surface);
        let header = existing;
        if (!header) {
            header = document.createElement('section');
            header.id = 'eos-technical-surface-header';
            header.className = 'eos-technical-surface-header';
            header.setAttribute('aria-live', 'polite');
            paper.insertBefore(header, paper.firstChild || null);
        }
        if (header.dataset.eosSurface !== surface || header.dataset.eosRole !== roleLabel()) {
            header.dataset.eosSurface = surface;
            header.dataset.eosRole = roleLabel();
            header.innerHTML = `
                <div class="eos-technical-surface-icon">${config.icon}</div>
                <div class="eos-technical-surface-copy">
                    <span>${escapeHtml(config.eyebrow)}</span>
                    <h1>${escapeHtml(config.title)}</h1>
                    <p>${escapeHtml(config.text)}</p>
                </div>
                <div class="eos-technical-surface-meta">
                    <i aria-hidden="true"></i>
                    <strong>${escapeHtml(roleLabel())}</strong>
                    <small>${surface === 'logs' ? 'Live-Diagnose' : surface === 'instances' ? 'Betriebsbereit' : 'Zentrale Datenansicht'}</small>
                </div>`;
        }
        classifyTechnicalRows(paper, surface);
    };

    const apply = () => {
        if (destroyed) return;
        setShellClasses();
        if (!isLogin()) {
            ensureBrand();
            ensureNavigationContainer();
            ensureModernOverview();
            ensureTechnicalSurface();
        } else {
            document.getElementById('eos-native-overview-hero')?.remove();
            document.getElementById('eos-technical-surface-header')?.remove();
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
            document.getElementById('eos-technical-surface-header')?.remove();
        },
    };
})();
