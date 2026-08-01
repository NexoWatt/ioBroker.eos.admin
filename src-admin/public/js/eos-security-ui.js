(() => {
    'use strict';

    const VERSION = 'v74-scalar-value-dialog';
    const LEGACY_ADMIN = 'admin';
    const LEGACY_ADMIN_INSTANCE = 'admin.0';
    const CORE_PROTECTED_ADAPTERS = ['admin', 'eos-admin', 'backitup', 'nexowatt-devices', 'nexowatt-device', 'nexowatt-dev', 'nexowatt-ui'];
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
            protectedAdapters: CORE_PROTECTED_ADAPTERS,
        },
        scheduled: false,
        observer: null,
        unsubscribePolicy: null,
        unsubscribeDom: null,
    };

    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const currentTab = () => String(window.location.hash || '').toLowerCase();
    const isObjectsSurface = () => /tab-objects\b/.test(currentTab());
    const isLogsSurface = () => /tab-logs\b/.test(currentTab());
    const isHighLoadAdminSurface = () => /tab-(objects|adapter|adapters|instances|logs|host|hosts)\b/.test(currentTab());
    const isInsideAppPaper = node => !!node?.closest?.('#app-paper, [role="grid"], .MuiDataGrid-root, .ReactVirtualized__Grid, .eos-object-value-cell, .MuiTooltip-popper, .MuiPopover-root, .MuiPopper-root, .MuiMenu-root, [role="tooltip"]');

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
    const parseAdapterTarget = value => {
        let raw = String(value || '').trim().toLowerCase();
        raw = raw.replace(/^system\.adapter\./, '').replace(/^iobroker\./, '').replace(/^@nexowatt\/iobroker\./, '').replace(/^@nexowatt\//, '');
        const match = raw.match(/^([a-z0-9_-]+)(?:\.(\d+))?$/);
        if (!match) return { adapter: raw.replace(/\.\d+$/, ''), instance: undefined };
        return { adapter: match[1], instance: match[2] };
    };

    const normalizeAdapter = value => {
        const { adapter } = parseAdapterTarget(value);
        return /^[a-z0-9_-]+$/.test(adapter) ? adapter : '';
    };

    const isAdminUser = () => !!(state.policy?.isAdmin || state.policy?.isEosAdminGroup || state.policy?.isAdministrator);
    const protectedAdapters = () => {
        // v47: hard delete protection only for EOS core adapters. Dynamic/stale
        // policy entries must never block ordinary installed adapters.
        return new Set([LEGACY_ADMIN, ...CORE_PROTECTED_ADAPTERS].map(normalizeAdapter).filter(Boolean));
    };

    const isProtectedAdapter = value => {
        const adapter = normalizeAdapter(value);
        return !!adapter && (adapter === LEGACY_ADMIN || protectedAdapters().has(adapter));
    };

    const shouldBlockInstanceTarget = value => {
        const { adapter, instance } = parseAdapterTarget(value);
        if (!adapter || !protectedAdapters().has(adapter)) return false;
        // v58: only the main Admin/EOS Admin instance is protected. Additional
        // eos-admin.1/eos-admin.2 test instances must be removable.
        if (adapter === LEGACY_ADMIN || adapter === 'eos-admin') return instance === undefined || instance === '0';
        return true;
    };

    window.NEXOWATT_EOS_SECURITY = {
        version: VERSION,
        getPolicy: () => state.policy,
        isAdminUser,
        isProtectedAdapter,
        shouldBlockAdapterDelete(adapterName) {
            return isProtectedAdapter(adapterName);
        },
        shouldBlockInstanceDelete(instanceIdOrAdapter) {
            return shouldBlockInstanceTarget(instanceIdOrAdapter);
        },
    };

    const SECURITY_SCOPE_MAX_TEXT = 1400;
    const SECURITY_SCOPE_MAX_CONTROLS = 18;
    const isSingleSecurityScope = el => {
        if (!el || !el.querySelectorAll) return false;
        const text = normalize(el.textContent || '');
        if (!text || text.length > SECURITY_SCOPE_MAX_TEXT) return false;
        const controls = el.querySelectorAll('button,[role="button"],a,.MuiIconButton-root').length;
        if (controls > SECURITY_SCOPE_MAX_CONTROLS) return false;
        const nested = el.querySelectorAll('[role="row"],tr,.MuiDataGrid-row,.MuiListItem-root,.MuiCard-root,.MuiAccordion-root').length;
        return nested <= 4;
    };

    const closestPanel = el => {
        let node = el?.closest?.('.MuiCard-root, .MuiPaper-root, [role="row"], tr, .MuiListItem-root, .MuiBox-root') || null;
        while (node && node !== document.body && node !== document.documentElement) {
            if (isSingleSecurityScope(node)) return node;
            node = node.parentElement?.closest?.('.MuiCard-root, .MuiPaper-root, [role="row"], tr, .MuiListItem-root, .MuiBox-root') || null;
        }
        return null;
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

    const releaseDeleteControls = () => {
        // v47: undo markers from older EOS DOM guards. Only touch controls that were
        // marked by EOS scripts, not native Admin disabled states.
        document.querySelectorAll('.eos-security-hidden-delete, .eos-protected-delete-control, [data-eos-security-locked-delete="true"]').forEach(control => {
            control.classList?.remove('eos-security-hidden-delete', 'eos-protected-delete-control');
            control.removeAttribute?.('data-eos-security-locked-delete');
            control.removeAttribute?.('aria-disabled');
            control.style.display = '';
            control.style.visibility = '';
            control.style.pointerEvents = '';
            if (control.hasAttribute?.('disabled')) control.removeAttribute('disabled');
            if ('disabled' in control) control.disabled = false;
        });
    };

    const hideProtectedDeleteControls = () => {
        // v47: Do not hide or capture trash buttons in the DOM. The shipped React
        // source/bundles already block protected EOS core adapters before executing
        // the ioBroker del command. DOM blocking caused stale/virtualized rows to make
        // normal services undeletable.
        releaseDeleteControls();
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
        // Unknown must stay unknown during a restart. Never apply non-admin restrictions
        // until a valid policy has been received.
        if (!state.loaded) return;
        // v57: the datapoints/logs pages belong to the native ObjectBrowser. Do not
        // walk those large virtualized tables or popup surfaces on every mutation.
        if (!isHighLoadAdminSurface()) replaceTextNodes();
        const admin = isAdminUser();
        document.documentElement.classList.toggle('eos-security-admin-user', admin);
        document.documentElement.classList.toggle('eos-security-non-admin-user', !admin);
        document.documentElement.classList.toggle('eos-security-nonadmin', !admin);
        releaseNotificationControls();
        if (isObjectsSurface() || isLogsSurface()) return;
        if (isAdapterConfigSurface()) return;
        hideLegacyAdminPanels();
        hideProtectedDeleteControls();
        hideEosSecuritySettingsForNonAdmins();
    };

    const isAdapterConfigSurface = () => document.documentElement.classList.contains('eos-adapter-config-surface') || /Instanzeinstellungen:|Instance settings:|Geräteliste|Gerät hinzufügen|Gerät bearbeiten/i.test(document.body?.textContent || '');

    const releaseNotificationControls = () => {
        // v38: security UI must not modify generic dialogs or adapter popups.
        // Only snackbar/toast surfaces are normalized for clickability.
        const roots = [
            '.MuiSnackbar-root', '.SnackbarItem-root', '.SnackbarItem-wrappedRoot',
            '.notistack-Snackbar', '.Toastify__toast-container', '.Toastify__toast'
        ].join(',');
        document.querySelectorAll(roots).forEach(box => {
            if (box.closest('.MuiDialog-root,.MuiModal-root,.MuiPopover-root,.MuiPopper-root,.MuiMenu-root,[role="dialog"]')) return;
            box.classList.add('eos-notification-safe');
            box.style.pointerEvents = 'auto';
            box.querySelectorAll('button, [role="button"], a, .MuiIconButton-root').forEach(control => {
                control.classList.remove('eos-protected-delete-control', 'eos-security-hidden-delete');
                control.style.pointerEvents = 'auto';
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

    const applyPolicy = policy => {
        if (!policy || policy.role === 'unknown') return;
        state.policy = { ...state.policy, ...policy };
        state.loaded = true;
        scheduleApply();
    };

    const connectPolicyClient = () => {
        const client = window.NEXOWATT_EOS_POLICY_CLIENT;
        if (!client) {
            window.setTimeout(connectPolicyClient, 250);
            return;
        }
        applyPolicy(client.getPolicy?.());
        state.unsubscribePolicy?.();
        state.unsubscribePolicy = client.subscribe?.(applyPolicy);
        void client.refresh?.();
    };

    const installObserver = () => {
        if (state.unsubscribeDom || state.observer) return;
        const onMutations = mutations => {
            if (isHighLoadAdminSurface() && mutations.length && mutations.every(m => isInsideAppPaper(m.target) || isInsideAppPaper(m.addedNodes?.[0]))) return;
            scheduleApply();
        };
        const coordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
        if (coordinator?.subscribe) state.unsubscribeDom = coordinator.subscribe(onMutations);
    };

    // v47: No global capture listener for delete buttons. Protected adapter deletion is
    // handled in the React delete handlers; global DOM interception broke normal Dienste.

    const start = () => {
        connectPolicyClient();
        installObserver();
        [500, 2000].forEach(ms => window.setTimeout(scheduleApply, ms));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
    window.addEventListener('hashchange', () => { window.NEXOWATT_EOS_POLICY_CLIENT?.refresh?.(); scheduleApply(); });
})();
