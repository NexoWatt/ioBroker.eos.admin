(() => {
    'use strict';

    const VERSION = 'v37-security-text-polish';
    const LEGACY_ADMIN = 'admin';
    const LEGACY_ADMIN_INSTANCE = 'admin.0';
    const ASSET_BASE = (() => {
        const script = document.currentScript?.src || document.querySelector('script[src*="eos-security-ui.js"]')?.src || window.location.href;
        return new URL('../', script).href;
    })();
    const SECURITY_URLS = [
        new URL('nexowatt/security/session', ASSET_BASE).href,
        new URL('eos/security/status', ASSET_BASE).href,
        '/nexowatt/security/session',
    ];

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

    const fixMojibake = value => {
        let text = String(value || '');
        const map = new Map(Object.entries({
            'dÃ¼rfen': 'dürfen', 'DÃ¼rfen': 'Dürfen', 'fÃ¼r': 'für', 'FÃ¼r': 'Für',
            'mÃ¼ssen': 'müssen', 'MÃ¼ssen': 'Müssen', 'kÃ¶nnen': 'können', 'KÃ¶nnen': 'Können',
            'mÃ¶glich': 'möglich', 'MÃ¶glich': 'Möglich', 'LÃ¶schen': 'Löschen', 'lÃ¶schen': 'löschen',
            'schÃ¼tzen': 'schützen', 'SchÃ¼tzen': 'Schützen', 'SchÃ¼tzt': 'Schützt', 'schÃ¼tzt': 'schützt',
            'GeschÃ¼tzte': 'Geschützte', 'geschÃ¼tzte': 'geschützte', 'GeschÃ¼tzter': 'Geschützter',
            'ausgewÃ¤hlte': 'ausgewählte', 'AusgewÃ¤hlte': 'Ausgewählte', 'Ã¤ndern': 'ändern', 'Ã„ndern': 'Ändern',
            'Ã¼ber': 'über', 'Ãœber': 'Über', 'WÃ¤hle': 'Wähle', 'wÃ¤hle': 'wähle',
            'Ã¶ffnen': 'öffnen', 'Ã–ffnen': 'Öffnen', 'schlieÃŸen': 'schließen', 'SchlieÃŸen': 'Schließen',
            'GerÃ¤t': 'Gerät', 'GerÃ¤te': 'Geräte', 'GerÃ¤teliste': 'Geräteliste',
            'ÃŸ': 'ß', 'Ã„': 'Ä', 'Ã–': 'Ö', 'Ãœ': 'Ü', 'Ã¤': 'ä', 'Ã¶': 'ö', 'Ã¼': 'ü', 'Â': ''
        }));
        for (const [from, to] of map) if (text.includes(from)) text = text.split(from).join(to);
        // Generic Latin1-as-UTF8 repair for labels injected by older bundles. Guard against false positives.
        if (/[ÃÂ]/.test(text)) {
            try {
                const repaired = decodeURIComponent(escape(text));
                if (/[äöüÄÖÜß]/.test(repaired) && !/[ÃÂ]/.test(repaired)) text = repaired;
            } catch { /* keep mapped text */ }
        }
        return text;
    };
    const normalizeFlat = value => normalize(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizeAdapter = value => {
        let adapter = String(value || '').trim().toLowerCase();
        adapter = adapter.replace(/^system\.adapter\./, '').replace(/^iobroker\./, '').replace(/^@nexowatt\/iobroker\./, '').replace(/^@nexowatt\//, '');
        adapter = adapter.replace(/\.\d+$/, '');
        return /^[a-z0-9_-]+$/.test(adapter) ? adapter : '';
    };

    const isAdminUser = () => !!(state.policy?.isAdmin || state.policy?.isEosAdminGroup || state.policy?.isAdministrator);
    const protectedAdapters = () => new Set((state.policy?.protectedAdapters || []).map(normalizeAdapter).filter(Boolean));

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

    const closestPanel = el => el?.closest?.('.MuiCard-root, .MuiPaper-root, [role="row"], tr, .MuiListItem-root, .MuiBox-root') || null;
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
        const text = normalizeFlat(el?.textContent || '');
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
            const text = normalizeFlat(el.textContent || '');
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
            const text = normalizeFlat(panel.textContent || '');
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
                const label = normalizeFlat(`${button.textContent || ''} ${button.getAttribute('title') || ''} ${button.getAttribute('aria-label') || ''}`);
                if (/loschen|delete|remove|deinstall|uninstall/.test(label)) {
                    button.classList.add('eos-security-hidden-delete');
                    button.setAttribute('disabled', 'disabled');
                    button.setAttribute('aria-disabled', 'true');
                    button.style.display = 'none';
                }
            });
        });
        document.querySelectorAll('[role="menuitem"], .MuiMenuItem-root').forEach(item => {
            const text = normalizeFlat(item.textContent || '');
            if (/loschen|delete|remove|deinstall|uninstall/.test(text)) {
                item.classList.add('eos-security-hidden-delete');
                item.style.display = 'none';
            }
        });
    };

    const replaceTextNodes = () => {
        const map = new Map([
            ['EOS security', 'EOS Sicherheit'],
            ['EOS Security', 'EOS Sicherheit'],
            ['Disable Assistent', 'EOS Assist deaktivieren'],
            ['Disable Assistant', 'EOS Assist deaktivieren'],
            ['NexoWatt security', 'NexoWatt Sicherheit'],
            ['Protected adapters', 'Geschützte Systemadapter'],
            ['Legacy admin', 'Alter Admin-Zugang'],
        ]);
        const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            let value = node.nodeValue || '';
            let changed = false;
            for (const [from, to] of map) {
                if (value.includes(from)) {
                    value = value.split(from).join(to);
                    changed = true;
                }
            }
            const fixed = fixMojibake(value);
            if (fixed !== value) { value = fixed; changed = true; }
            if (changed) node.nodeValue = value;
        }
    };

    const securityTextPattern = /(eos\s*(security|sicherheit)|nexowatt\s*sicherheit|alter admin-zugang|alten admin|admin\.0 sperren|geschuetzte systemadapter|geschützte systemadapter|eos administratorgruppen|administratorgruppen)/i;

    const hideEosSecuritySettingsForNonAdmins = () => {
        if (isAdminUser()) return;
        const dialogs = Array.from(document.querySelectorAll('.MuiDialog-paper, [role="dialog"], form'));
        dialogs.forEach(dialog => {
            // Hide the EOS Security tab itself.
            const tabs = Array.from(dialog.querySelectorAll('[role="tab"], .MuiTab-root, button, .MuiButtonBase-root'));
            let activeSecurityTab = false;
            tabs.forEach(tab => {
                const txt = normalize(tab.textContent || tab.getAttribute('aria-label') || tab.getAttribute('title') || '');
                if (/^\s*EOS\s*(Security|Sicherheit)\s*$/i.test(txt)) {
                    if (tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('Mui-selected')) activeSecurityTab = true;
                    tab.classList.add('eos-security-admin-only-field');
                    tab.setAttribute('aria-hidden', 'true');
                    tab.style.display = 'none';
                }
            });
            if (activeSecurityTab) {
                const nextTab = tabs.find(tab => tab.style.display !== 'none' && !tab.classList.contains('eos-security-admin-only-field'));
                if (nextTab) setTimeout(() => nextTab.click(), 0);
            }
            // Hide all field groups belonging to the EOS Security panel if the panel is still rendered.
            Array.from(dialog.querySelectorAll('.MuiFormControl-root, .MuiGrid-root, .MuiTableContainer-root, .MuiTable-root, [role="tabpanel"], fieldset, section, .MuiBox-root')).forEach(el => {
                const txt = normalize(el.textContent || '');
                if (!txt || txt.length > 2200) return;
                if (securityTextPattern.test(txt)) {
                    el.classList.add('eos-security-admin-only-field');
                    el.setAttribute('aria-hidden', 'true');
                    el.style.display = 'none';
                }
            });
        });
    };

    const applyPolicyToDom = () => {
        // Text repair is safe and must also run on adapter config pages.
        replaceTextNodes();
        const admin = isAdminUser();
        document.documentElement.classList.toggle('eos-security-admin-user', admin);
        document.documentElement.classList.toggle('eos-security-non-admin-user', !admin);
        document.documentElement.classList.toggle('eos-security-nonadmin', !admin);
        releaseNotificationControls();
        if (isAdapterConfigSurface()) return;
        hideLegacyAdminPanels();
        hideProtectedDeleteControls();
        hideEosSecuritySettingsForNonAdmins();
    };

    const isAdapterConfigSurface = () => document.documentElement.classList.contains('eos-adapter-config-surface') || /Instanzeinstellungen:|Instance settings:|Geräteliste|Gerät hinzufügen|Gerät bearbeiten/i.test(document.body?.textContent || '');

    const releaseNotificationControls = () => {
        // Never block notification/toast close actions. These controls are owned by
        // the native Admin UI and must remain clickable regardless of EOS security rules.
        document.querySelectorAll('.MuiSnackbar-root, .MuiAlert-root, .MuiSnackbarContent-root, [role="alert"], .Toastify__toast, .notistack-Snackbar').forEach(box => {
            box.classList.add('eos-notification-safe');
            box.style.pointerEvents = 'auto';
            box.querySelectorAll('button, [role="button"], a, .MuiIconButton-root').forEach(control => {
                control.classList.remove('eos-protected-delete-control', 'eos-security-hidden-delete');
                control.removeAttribute('disabled');
                control.removeAttribute('aria-disabled');
                if ('disabled' in control) control.disabled = false;
                control.style.pointerEvents = 'auto';
                control.style.display = '';
                control.style.visibility = '';
            });
        });
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
        for (const url of SECURITY_URLS) {
            try {
                const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
                if (!response.ok) continue;
                const policy = await response.json();
                state.policy = { ...state.policy, ...policy };
                state.loaded = true;
                scheduleApply();
                return;
            } catch { /* try next */ }
        }
        state.loaded = false;
        state.policy = { ...state.policy, isAdmin: false, isEosAdminGroup: false, isAdministrator: false };
        console.warn('[NexoWatt EOS] Cannot read security policy, using safe non-admin UI mode');
        scheduleApply();
    };

    const installObserver = () => {
        if (state.observer) return;
        state.observer = new MutationObserver(() => scheduleApply());
        state.observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    document.addEventListener('click', event => {
        const target = event.target?.closest?.('button,[role="button"],a,[role="menuitem"],.MuiMenuItem-root');
        if (!target || isAdminUser() || isAdapterConfigSurface()) return;
        const label = normalizeFlat(`${target.textContent || ''} ${target.getAttribute?.('title') || ''} ${target.getAttribute?.('aria-label') || ''}`);
        if (/loschen|delete|remove|deinstall|uninstall/.test(label)) {
            target.classList.add('eos-security-hidden-delete');
            target.style.display = 'none';
        }
    }, true);

    const start = () => {
        loadPolicy();
        installObserver();
        [300, 1000, 2500, 5000].forEach(ms => window.setTimeout(scheduleApply, ms));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
    window.addEventListener('hashchange', () => { loadPolicy(); scheduleApply(); });
})();
