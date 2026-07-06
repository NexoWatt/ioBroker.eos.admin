(() => {
    'use strict';

    window.NEXOWATT_EOS_ROLE_UI_VERSION = 'v49-dp-write-performance-fix';

    const ASSET_BASE = (() => {
        const script = document.currentScript?.src || document.querySelector('script[src*="eos-role-ui.js"]')?.src || window.location.href;
        return new URL('../', script).href;
    })();

    const state = {
        policy: null,
        role: 'unknown',
        scheduled: false,
        observer: null,
        fallbackTimer: null,
        redirects: 0,
        lastTarget: '',
    };

    const securityEndpointUrls = () => [
        new URL('nexowatt/security/context', ASSET_BASE).href,
        new URL('nexowatt/security/session', ASSET_BASE).href,
        new URL('eos/security/status', ASSET_BASE).href,
    ];

    const safe = fn => {
        try { return fn(); } catch (_) { return undefined; }
    };

    const normalize = value => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9#/_:.-]+/g, ' ')
        .trim();

    const stripTab = value => String(value || '').replace(/^#?\/?/, '').replace(/^tab-/, '');

    const hashTab = () => {
        const hash = decodeURIComponent(window.location.hash || '');
        const match = hash.match(/#\/?(tab-[a-z0-9_-]+(?:-\d+)?)\b/i);
        if (match) return match[1];
        if (!hash || hash === '#' || hash === '#/' || hash === '#/tab-intro') return 'tab-intro';
        return '';
    };

    const tabFromHref = href => {
        const value = String(href || '');
        const match = value.match(/#\/?(tab-[a-z0-9_-]+(?:-\d+)?)\b/i);
        return match ? match[1] : '';
    };

    const textOf = el => {
        if (!el) return '';
        const attrs = ['href', 'title', 'aria-label', 'data-name', 'data-tab', 'data-id', 'id'];
        const values = [el.textContent || ''];
        attrs.forEach(attr => {
            if (el.getAttribute && el.hasAttribute(attr)) values.push(el.getAttribute(attr) || '');
        });
        return values.join(' ');
    };

    const isLoginView = () => /(?:^|[?&])login(?:[=&]|$)/i.test(window.location.search || '') ||
        !!document.querySelector('.login-form, #login, [data-testid="login"]');

    const roleFromPolicy = policy => {
        const rawRole = normalize(policy?.role || policy?.eosRole || policy?.accessRole || '');
        if (policy?.isAdmin || policy?.isEosAdminGroup || policy?.isAdministrator || rawRole === 'admin' || rawRole === 'administrator') return 'admin';
        if (policy?.isInstaller || /installateur|installer|service|techniker|technician|integrator|partner|wartung|maintenance/.test(rawRole)) return 'installer';
        if (policy?.isEndUser || /endkunde|endkunden|kunde|kunden|customer|bediener|operator|viewer|user|nutzer/.test(rawRole)) return 'enduser';

        const groupText = normalize([
            ...(Array.isArray(policy?.groups) ? policy.groups : []),
            ...(Array.isArray(policy?.groupNames) ? policy.groupNames : []),
        ].join(' '));
        if (/system\.group\.administrator|\badministrator\b/.test(groupText)) return 'admin';
        if (/installateur|installer|service|techniker|technician|integrator|partner|wartung|maintenance/.test(groupText)) return 'installer';
        if (/endkunde|endkunden|kunde|kunden|customer|bediener|operator|viewer|nutzer/.test(groupText)) return 'enduser';

        // Secure default: a normal, non-admin ioBroker user is an EOS end customer.
        return 'enduser';
    };

    const setRoleClasses = role => safe(() => {
        const root = document.documentElement;
        root.classList.add('eos-role-loaded');
        ['admin', 'installer', 'installateur', 'enduser', 'unknown'].forEach(name => root.classList.remove(`eos-role-${name}`));
        root.classList.add(`eos-role-${role}`);
        if (role === 'installer') root.classList.add('eos-role-installateur');
        if (role === 'admin') {
            root.classList.add('eos-security-admin');
            root.classList.remove('eos-security-nonadmin');
        } else {
            root.classList.add('eos-security-nonadmin');
            root.classList.remove('eos-security-admin');
        }
    });

    const endUserAllowedByText = value => {
        const text = normalize(value);
        if (!text) return false;
        if (/(eos cockpit|nexowatt ui|nexowatt cockpit|kunden cockpit|kundenbereich|endkundenbereich|visualisierung|visualisation|visu|dashboard|energie cockpit|energy cockpit|bedienung|smart home|smart-home)/.test(text)) return true;
        if (/\b(lovelace|jarvis|vis|iqontrol|material)\b/.test(text)) return true;
        return false;
    };

    const endUserDeniedByText = value => {
        const text = normalize(value);
        return /(module|dienste|datenpunkte|objekte|struktur|systemlogs|logs|zugange|rechte|benutzer|users|gruppen|groups|system hosts|system-hosts|hosts|dateien|files|sicherung|backup|konsole|console|terminal|xterm|admin|adapter|instances?|instanzen|geraetesuche|discovery|systemschutz|security)/.test(text);
    };

    const isEndUserTab = (tab, label = '') => {
        const clean = normalize(tab);
        const text = `${clean} ${normalize(label)}`;
        if (!clean || clean === 'tab-intro') return false;
        if (/^tab-(nexowatt-ui|nexowatt-cockpit|eos-cockpit|eos-dashboard|kunden-cockpit|endkunden-cockpit)(?:-|$)/.test(clean)) return true;
        if (/^tab-(lovelace|jarvis|vis|iqontrol|material)(?:-|$)/.test(clean)) return true;
        if (endUserDeniedByText(text)) return false;
        return endUserAllowedByText(text);
    };

    const isInstallerDenied = (tab, label = '') => {
        const text = `${normalize(tab)} ${normalize(label)}`;
        return /(?:tab-users|tab-hosts|tab-xterm|tab-xtrem|tab-admin|tab-system|zugange\s*&?\s*rechte|zugange|rechte|benutzer|users|gruppen|system-hosts|system hosts|hosts|konsole|console|terminal|xterm|sicherung|backup|systemschutz|security|legacy admin)/.test(text);
    };

    const isRouteAllowed = (role, tab, label = '') => {
        if (role === 'admin') return true;
        if (role === 'installer') return !isInstallerDenied(tab, label);
        if (role === 'enduser') return isEndUserTab(tab, label);
        return false;
    };

    const navEntries = () => {
        const anchors = Array.from(document.querySelectorAll('a[href*="#tab-"], a[href*="#/tab-"]'));
        const seen = new Set();
        return anchors.map(anchor => {
            const tab = tabFromHref(anchor.getAttribute('href') || anchor.href || '');
            if (!tab || seen.has(anchor)) return null;
            seen.add(anchor);
            const root = anchor.closest('.MuiListItem-root, .MuiButtonBase-root, li, [role="button"], [class*="DrawerItem"], [class*="dragWrapper"]') || anchor;
            return { anchor, root, tab, label: textOf(root) || textOf(anchor) };
        }).filter(Boolean);
    };

    const firstAllowedTab = role => {
        const entries = navEntries();
        const hit = entries.find(entry => isRouteAllowed(role, entry.tab, entry.label));
        if (hit) return hit.tab;
        if (role === 'enduser') return 'tab-nexowatt-ui';
        if (role === 'installer') return 'tab-instances';
        return 'tab-intro';
    };

    const applyMenuPolicy = () => safe(() => {
        if (!state.policy || !state.role || state.role === 'unknown') return;
        navEntries().forEach(entry => {
            const hide = !isRouteAllowed(state.role, entry.tab, entry.label);
            [entry.anchor, entry.root].forEach(el => {
                if (!el) return;
                el.classList.toggle('eos-role-hidden', hide);
                if (hide) el.setAttribute('aria-hidden', 'true');
                else el.removeAttribute('aria-hidden');
            });
        });
    });

    const setHashTab = tab => {
        if (!tab) return;
        if (state.lastTarget === tab && Date.now() - Number(sessionStorage.getItem('eosRoleLastRedirectAt') || 0) < 1200) return;
        state.lastTarget = tab;
        state.redirects += 1;
        sessionStorage.setItem('eosRoleLastRedirectAt', String(Date.now()));
        const next = `#${tab}`;
        if (window.location.hash !== next) window.location.hash = next;
        window.dispatchEvent(new CustomEvent('eos-role-navigate', { detail: { tab } }));
    };

    const redirectIfNeeded = () => safe(() => {
        if (isLoginView()) return;
        const role = state.role;
        if (!role || role === 'unknown' || role === 'admin') return;
        const tab = hashTab() || 'tab-intro';
        if (isRouteAllowed(role, tab, '')) return;
        const target = firstAllowedTab(role);
        if (target && target !== tab && state.redirects < 6) setHashTab(target);
    });

    const appPaper = () => document.getElementById('app-paper') || document.querySelector('main, #root');

    const appLooksBlank = () => {
        const paper = appPaper();
        if (!paper) return false;
        const tab = hashTab();
        const text = normalize(paper.textContent || '');
        const interactive = paper.querySelectorAll('iframe, a, button, input, select, textarea, table, [role="grid"], .MuiDataGrid-root, .MuiTable-root').length;
        if (state.role === 'enduser' && (!isEndUserTab(tab, text) || tab === 'tab-intro')) return true;
        return text.length < 12 && interactive === 0;
    };

    const showLandingFallback = () => safe(() => {
        if (isLoginView() || state.role !== 'enduser') return;
        if (!appLooksBlank()) {
            document.getElementById('eos-role-landing')?.remove();
            return;
        }
        const paper = appPaper();
        if (!paper) return;
        let landing = document.getElementById('eos-role-landing');
        if (!landing) {
            landing = document.createElement('section');
            landing.id = 'eos-role-landing';
            landing.className = 'eos-role-landing';
            landing.innerHTML = `
                <div class="eos-role-landing-card">
                    <div class="eos-role-landing-eyebrow">NexoWatt EOS</div>
                    <h1>Endkundenbereich</h1>
                    <p>Dieser Benutzer ist als Endkunde angemeldet. Die Administrations-Startseite ist für diese Rolle gesperrt; EOS öffnet stattdessen das Kunden-Cockpit.</p>
                    <button type="button" class="eos-role-open-cockpit">EOS Cockpit öffnen</button>
                </div>
            `;
            landing.querySelector('.eos-role-open-cockpit')?.addEventListener('click', event => {
                event.preventDefault();
                setHashTab(firstAllowedTab('enduser') || 'tab-nexowatt-ui');
            });
        }
        if (!paper.contains(landing)) {
            paper.appendChild(landing);
        }
    });

    const scheduleFallbackCheck = () => {
        clearTimeout(state.fallbackTimer);
        state.fallbackTimer = setTimeout(() => {
            showLandingFallback();
        }, 1000);
    };

    const apply = () => {
        if (!state.policy) return;
        setRoleClasses(state.role);
        applyMenuPolicy();
        redirectIfNeeded();
        scheduleFallbackCheck();
    };

    const scheduleApply = () => {
        if (state.scheduled) return;
        state.scheduled = true;
        requestAnimationFrame(() => {
            state.scheduled = false;
            apply();
        });
    };

    const fetchPolicy = async () => {
        for (const url of securityEndpointUrls()) {
            try {
                const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
                if (!response.ok) continue;
                const json = await response.json();
                const role = roleFromPolicy(json);
                state.policy = { ...json, role };
                state.role = role;
                window.NEXOWATT_EOS_ROLE_POLICY = state.policy;
                scheduleApply();
                return;
            } catch (_) {
                // try next endpoint
            }
        }
        state.policy = { role: 'enduser', isEndUser: true, groups: [] };
        state.role = 'enduser';
        window.NEXOWATT_EOS_ROLE_POLICY = state.policy;
        scheduleApply();
    };

    const startObserver = () => safe(() => {
        if (state.observer || !document.documentElement) return;
        state.observer = new MutationObserver(scheduleApply);
        state.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class', 'aria-label'] });
    });

    const start = () => {
        fetchPolicy();
        startObserver();
        window.addEventListener('hashchange', () => {
            state.redirects = 0;
            scheduleApply();
        });
        window.addEventListener('storage', scheduleApply);
        setTimeout(scheduleApply, 400);
        setTimeout(scheduleApply, 1500);
        setTimeout(scheduleApply, 3500);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
