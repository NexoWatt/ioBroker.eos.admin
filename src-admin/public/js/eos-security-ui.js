(() => {
    'use strict';

    const VERSION = 'v26-security-visibility-guard';
    const LEGACY_ADMIN = 'admin';
    const LEGACY_ADMIN_INSTANCE = 'admin.0';
    const SECURITY_URL = '/nexowatt/security/session';

    const state = {
        loaded: false,
        policy: {
            isAdmin: false,
            isEosAdminGroup: false,
            isAdministrator: false,
            hideLegacyAdminFromNonAdmins: true,
            restrictProtectedAdapterControls: true,
            protectedAdapters: ['eos-admin'],
        },
        scheduled: false,
        observer: null,
    };

    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const normalizeAdapter = value => {
        let adapter = String(value || '').trim().toLowerCase();
        adapter = adapter.replace(/^system\.adapter\./, '').replace(/^iobroker\./, '').replace(/^@nexowatt\/iobroker\./, '').replace(/^@nexowatt\//, '');
        adapter = adapter.replace(/\.\d+$/, '');
        return /^[a-z0-9_-]+$/.test(adapter) ? adapter : '';
    };

    const isAdminUser = () => !!(state.policy?.isAdmin || state.policy?.isEosAdminGroup || state.policy?.isAdministrator);
    const protectedAdapters = () => new Set((state.policy?.protectedAdapters || []).map(normalizeAdapter).filter(Boolean));

    const isLegacyAdminId = value => {
        const text = String(value || '').toLowerCase();
        return text === LEGACY_ADMIN || text === LEGACY_ADMIN_INSTANCE || text === 'system.adapter.admin' || text === 'system.adapter.admin.0';
    };

    const isProtectedAdapter = value => {
        const adapter = normalizeAdapter(value);
        return !!adapter && protectedAdapters().has(adapter);
    };

    window.NEXOWATT_EOS_SECURITY = {
        version: VERSION,
        getPolicy: () => state.policy,
        isAdminUser,
        isProtectedAdapter,
        shouldBlockAdapterDelete(adapterName) {
            if (isAdminUser()) return false;
            const adapter = normalizeAdapter(adapterName);
            return adapter === LEGACY_ADMIN || isProtectedAdapter(adapter);
        },
        shouldBlockInstanceDelete(instanceIdOrAdapter) {
            if (isAdminUser()) return false;
            const raw = String(instanceIdOrAdapter || '').replace(/^system\.adapter\./, '');
            const adapter = normalizeAdapter(raw);
            return adapter === LEGACY_ADMIN || isProtectedAdapter(adapter);
        },
    };

    const closestPanel = el => {
        if (!el || !el.closest) return null;
        return el.closest('.MuiCard-root, .MuiPaper-root, [role="row"], tr, .MuiListItem-root, .MuiBox-root');
    };

    const markHidden = el => {
        if (!el || el.classList?.contains('eos-security-keep-visible')) return;
        el.classList.add('eos-security-hidden');
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
    };

    const elementHasLegacyAdminIcon = el => {
        if (!el?.querySelectorAll) return false;
        return Array.from(el.querySelectorAll('img,[src]')).some(img => {
            const src = String(img.getAttribute('src') || '').toLowerCase();
            return /(?:^|\/)adapter\/admin\//.test(src) || /(?:^|\/)admin\/(?:admin\.(?:png|svg)|admin\.svg)/.test(src);
        });
    };

    const elementTextMatchesLegacyAdmin = el => {
        const text = normalize(el?.textContent || '').toLowerCase();
        if (!text) return false;
        if (text.includes('eos-admin') || text.includes('eos admin')) return false;
        return /\badmin\.0\b/.test(text) || /system\.adapter\.admin(?:\.0)?\b/.test(text) || /\biobroker\.admin\b/.test(text);
    };

    const hideLegacyAdminPanels = () => {
        if (!state.policy?.hideLegacyAdminFromNonAdmins || isAdminUser()) return;
        const candidates = new Set();
        document.querySelectorAll('img,[src]').forEach(img => {
            if (elementHasLegacyAdminIcon(img.parentElement || img)) candidates.add(closestPanel(img) || img);
        });
        document.querySelectorAll('.MuiCard-root, .MuiPaper-root, [role="row"], tr, .MuiListItem-root').forEach(el => {
            if (elementHasLegacyAdminIcon(el) || elementTextMatchesLegacyAdmin(el)) candidates.add(el);
        });
        candidates.forEach(el => {
            const text = normalize(el.textContent || '').toLowerCase();
            if (text.includes('eos-admin') || text.includes('eos admin')) return;
            markHidden(el);
        });
    };

    const hideProtectedDeleteControls = () => {
        if (!state.policy?.restrictProtectedAdapterControls || isAdminUser()) return;
        const protectedSet = protectedAdapters();
        if (!protectedSet.size) return;

        document.querySelectorAll('.MuiCard-root, .MuiPaper-root, [role="row"], tr, .MuiListItem-root').forEach(panel => {
            let adapter = '';
            const icon = panel.querySelector('img[src*="/adapter/"], img[src*="adapter/"]');
            const src = icon ? String(icon.getAttribute('src') || '') : '';
            const match = src.match(/adapter\/([^\/]+)\//i);
            if (match) adapter = normalizeAdapter(match[1]);
            const text = normalize(panel.textContent || '').toLowerCase();
            if (!adapter) {
                for (const protectedName of protectedSet) {
                    if (new RegExp(`\\b${protectedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.\\d+)?\\b`, 'i').test(text)) {
                        adapter = protectedName;
                        break;
                    }
                }
            }
            if (!adapter || !protectedSet.has(adapter)) return;
            panel.classList.add('eos-security-protected-adapter');
            panel.querySelectorAll('button,[role="button"],a').forEach(button => {
                const label = normalize(`${button.textContent || ''} ${button.getAttribute('title') || ''} ${button.getAttribute('aria-label') || ''}`).toLowerCase();
                if (/löschen|delete|remove|deinstall|uninstall/.test(label)) {
                    button.classList.add('eos-security-hidden-delete');
                    button.setAttribute('disabled', 'disabled');
                    button.setAttribute('aria-disabled', 'true');
                    button.style.display = 'none';
                }
            });
        });

        document.querySelectorAll('[role="menuitem"], .MuiMenuItem-root').forEach(item => {
            const text = normalize(item.textContent || '').toLowerCase();
            if (/löschen|delete|remove|deinstall|uninstall/.test(text)) {
                // Context menus cannot always be mapped back to the originating card. For protected NexoWatt systems,
                // deletion through pop-up menus is blocked by the command guard and visually hidden for non-admin users.
                item.classList.add('eos-security-hidden-delete');
                item.style.display = 'none';
            }
        });
    };

    const applyPolicyToDom = () => {
        document.documentElement.classList.toggle('eos-security-admin-user', isAdminUser());
        document.documentElement.classList.toggle('eos-security-non-admin-user', !isAdminUser());
        hideLegacyAdminPanels();
        hideProtectedDeleteControls();
    };

    const scheduleApply = () => {
        if (state.scheduled) return;
        state.scheduled = true;
        const run = () => {
            state.scheduled = false;
            applyPolicyToDom();
        };
        if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 600 });
        else window.requestAnimationFrame(run);
    };

    const loadPolicy = async () => {
        try {
            const response = await fetch(SECURITY_URL, { credentials: 'same-origin', cache: 'no-store' });
            const policy = await response.json();
            state.policy = { ...state.policy, ...policy };
            state.loaded = true;
        } catch (e) {
            state.loaded = false;
            state.policy = { ...state.policy, isAdmin: false, isEosAdminGroup: false, isAdministrator: false };
            console.warn('[NexoWatt EOS] Cannot read security policy, using safe non-admin UI mode:', e);
        }
        scheduleApply();
    };

    const installObserver = () => {
        if (state.observer) return;
        state.observer = new MutationObserver(() => scheduleApply());
        state.observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    document.addEventListener('click', event => {
        const target = event.target?.closest?.('button,[role="button"],a,[role="menuitem"],.MuiMenuItem-root');
        if (!target || isAdminUser()) return;
        const label = normalize(`${target.textContent || ''} ${target.getAttribute?.('title') || ''} ${target.getAttribute?.('aria-label') || ''}`).toLowerCase();
        if (/löschen|delete|remove|deinstall|uninstall/.test(label)) {
            target.classList.add('eos-security-hidden-delete');
            target.style.display = 'none';
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            loadPolicy();
            installObserver();
            [300, 1000, 2500, 5000].forEach(ms => window.setTimeout(scheduleApply, ms));
        }, { once: true });
    } else {
        loadPolicy();
        installObserver();
        [300, 1000, 2500, 5000].forEach(ms => window.setTimeout(scheduleApply, ms));
    }
    window.addEventListener('hashchange', () => {
        loadPolicy();
        scheduleApply();
    });
})();
