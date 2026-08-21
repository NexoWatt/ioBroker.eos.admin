(() => {
    'use strict';

    const VERSION = 'v89-role-safe-overview-and-reserve-visibility';
    window.NEXOWATT_EOS_ROLE_UI_VERSION = VERSION;

    const state = {
        policy: window.NEXOWATT_EOS_BOOTSTRAP_POLICY || null,
        role: window.NEXOWATT_EOS_ACCESS_ROLE || 'unknown',
        scheduled: false,
        redirects: 0,
        lastTarget: '',
        unsubscribePolicy: null,
        unsubscribeDom: null,
    };
    const abort = new AbortController();

    const safe = fn => { try { return fn(); } catch (_) { return undefined; } };
    const normalize = value => String(value || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9#/_:.-]+/g, ' ').trim();
    const currentRoute = () => {
        const hash = decodeURIComponent(window.location.hash || '').toLowerCase();
        if (/^#\/?easy(?:[/?&]|$)/.test(hash)) return 'easy';
        const direct = hash.match(/^#\/?(system|users|hosts|files|objects|instances|adapters|logs|enums)(?:[/?&]|$)/);
        if (direct) return `tab-${direct[1]}`;
        const match = hash.match(/tab-[a-z0-9_-]+(?:-\d+)?/i);
        return match ? match[0].toLowerCase() : 'tab-intro';
    };
    const tabFromHref = href => String(href || '').match(/#\/?(tab-[a-z0-9_-]+(?:-\d+)?)/i)?.[1]?.toLowerCase() || '';
    const isLoginView = () => /(?:^|[?&])login(?:[=&]|$)/i.test(window.location.search || '') || !!document.querySelector('.login-form,#login,[data-testid="login"]');
    const isHighLoadSurface = () => /tab-(objects|adapter|adapters|instances|logs|host|hosts)\b/.test(currentRoute());
    const isInsideAppPaper = node => !!node?.closest?.('#app-paper,[role="grid"],.MuiDataGrid-root,.ReactVirtualized__Grid,.eos-object-value-cell,.MuiTooltip-popper,.MuiPopover-root,.MuiPopper-root,.MuiMenu-root,[role="tooltip"]');

    const roleFromPolicy = policy => {
        const raw = normalize(policy?.role || policy?.eosRole || policy?.accessRole || '');
        if (policy?.isAdmin || policy?.isEosAdminGroup || policy?.isAdministrator || /^(?:admin|administrator)$/.test(raw)) return 'admin';
        if (/nexowatt service|eos service|service admin|service administrator/.test(raw)) return 'admin';
        if (policy?.isInstaller || /installateur|installer|installation|inbetriebnahme|techniker|technician|integrator|partner/.test(raw)) return 'installer';
        return 'enduser';
    };
    const isOfficialAdminTab = tab => /^tab-admin(?:-\d+)?$/.test(normalize(tab));
    const isOfficialBackupTab = tab => /^tab-backitup(?:-\d+)?$/.test(normalize(tab));
    const isOfficialReserveTab = tab => isOfficialAdminTab(tab) || isOfficialBackupTab(tab);
    const isCustomerBackupTab = tab => /^tab-(?:nexowatt-backup|eos-backup|nexowatt-sicherung)(?:-\d+)?$/.test(normalize(tab));
    const endUserAllowedByText = value => /(eos cockpit|nexowatt ui|nexowatt cockpit|kunden cockpit|kundenbereich|endkundenbereich|visualisierung|visualisation|visu|dashboard|energie cockpit|energy cockpit|bedienung|smart home|smart-home|lovelace|jarvis|iqontrol|material)/.test(normalize(value));
    const endUserDeniedByText = value => /(module|dienste|datenpunkte|objekte|systemlogs|logs|zugange|rechte|benutzer|users|gruppen|groups|system hosts|system-hosts|hosts|dateien|files|konsole|console|terminal|xterm|adapter|instances?|instanzen|geraetesuche|discovery|systemschutz|security)/.test(normalize(value));
    const isEndUserTab = (tab, label = '') => {
        const clean = normalize(tab); const text = `${clean} ${normalize(label)}`;
        if (clean === 'tab-intro' || clean === 'tab-enums' || isCustomerBackupTab(clean)) return true;
        if (/^tab-(nexowatt-ui|nexowatt-cockpit|eos-cockpit|eos-dashboard|kunden-cockpit|endkunden-cockpit|lovelace|jarvis|vis|iqontrol|material)(?:-|$)/.test(clean)) return true;
        return !!clean && !endUserDeniedByText(text) && endUserAllowedByText(text);
    };
    const isInstallerDenied = (tab, label = '') => {
        const clean = normalize(tab); const text = `${clean} ${normalize(label)}`;
        if (isOfficialReserveTab(clean)) return true;
        if (isCustomerBackupTab(clean)) return false;
        return /(?:tab-hosts|tab-files|tab-xterm|tab-xtrem|tab-system|system-hosts|system hosts|hosts|dateien|files|konsole|console|terminal|xterm|systemschutz|security)/.test(text);
    };
    const isRouteAllowed = (role, route, label = '') => {
        if (route === 'easy') return false;
        if (role === 'admin') return true;
        if (isOfficialReserveTab(route)) return false;
        if (role === 'installer') return route === 'tab-intro' || route === 'tab-users' || !isInstallerDenied(route, label);
        if (role === 'enduser') return isEndUserTab(route, label);
        return false;
    };
    const defaultTab = () => 'tab-intro';

    const setRoleClasses = role => safe(() => {
        const root = document.documentElement;
        root.classList.add('eos-role-loaded');
        ['admin','installer','installateur','enduser','unknown'].forEach(name => root.classList.remove(`eos-role-${name}`));
        root.classList.add(`eos-role-${role}`);
        if (role === 'installer') root.classList.add('eos-role-installateur');
        root.classList.toggle('eos-security-admin', role === 'admin');
        root.classList.toggle('eos-security-nonadmin', role !== 'admin');
    });

    const lockExpertMode = () => safe(() => {
        if (state.role === 'admin') return false;
        const storage = window._sessionStorage || window.sessionStorage;
        const previous = storage.getItem('App.expertMode');
        for (const target of [storage, window._localStorage || window.localStorage]) {
            target.setItem('App.expertMode', 'false');
            target.removeItem('App.doNotShowExpertDialog');
        }
        if (previous !== 'false' && document.getElementById('app-paper') && storage.getItem('eosRoleExpertReloaded') !== '1') {
            storage.setItem('eosRoleExpertReloaded', '1');
            window.location.reload();
            return true;
        }
        return false;
    });

    const textOf = el => [el?.textContent || '', ...['href','title','aria-label','data-name','data-tab','data-id','data-instance','id'].map(a => el?.getAttribute?.(a) || '')].join(' ');
    const navEntries = () => Array.from(document.querySelectorAll('a[href*="#tab-"],a[href*="#/tab-"],a[href="#easy"],a[href="/#easy"],a[href$="/#easy"]')).map(anchor => {
        const href = anchor.getAttribute('href') || anchor.href || '';
        const tab = /#\/?easy(?:[/?&]|$)/i.test(href) ? 'easy' : tabFromHref(href);
        if (!tab) return null;
        const root = anchor.closest('.MuiListItem-root,.MuiButtonBase-root,li,[role="button"],[class*="DrawerItem"],[class*="dragWrapper"]') || anchor;
        return { anchor, root, tab, label: textOf(root) || textOf(anchor) };
    }).filter(Boolean);
    const firstAllowedTab = role => navEntries().find(entry => entry.tab === 'tab-intro' && isRouteAllowed(role, entry.tab, entry.label))?.tab
        || navEntries().find(entry => isRouteAllowed(role, entry.tab, entry.label))?.tab || defaultTab(role);

    const applyMenuPolicy = () => safe(() => {
        navEntries().forEach(entry => {
            const hide = !isRouteAllowed(state.role, entry.tab, entry.label);
            [entry.anchor, entry.root].forEach(el => {
                if (!el) return;
                el.classList.toggle('eos-role-hidden', hide);
                if (hide) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
            });
        });
    });

    const toolbarButtonSignature = button => {
        const testIds = Array.from(button?.querySelectorAll?.('svg[data-testid]') || []).map(svg => svg.getAttribute('data-testid') || '').join(' ');
        return normalize(`${button?.getAttribute?.('aria-label') || ''} ${button?.getAttribute?.('title') || ''} ${testIds}`);
    };
    const isSystemSettingsButton = button => /buildicon|system settings|systemeinstellungen|systeeminstellingen/.test(toolbarButtonSignature(button));
    const isExpertModeButton = button => /expert|experten/.test(toolbarButtonSignature(button));
    const markAdminOnlyToolbarControls = () => safe(() => {
        const toolbar = document.querySelector('.eos-top-toolbar,.MuiAppBar-root .MuiToolbar-root');
        if (!toolbar) return;
        const buttons = Array.from(toolbar.querySelectorAll('button'));
        let buildIndex = -1;
        buttons.forEach((button, index) => {
            if (button.closest('#eos-assist-root')) return;
            const label = toolbarButtonSignature(button);
            const system = isSystemSettingsButton(button);
            const expert = isExpertModeButton(button);
            if (system) { buildIndex = index; button.dataset.eosSystemSettingsControl = '1'; }
            button.dataset.eosKnownToolbar = /notifications|visibility|menu|logout|brightness|palette|darkmode|lightmode|colorlens|sync|assist/.test(label) ? '1' : '0';
            if (expert) button.dataset.eosAdminOnlyControl = '1';
        });
        if (buildIndex >= 0) {
            for (let index = buildIndex + 1; index < buttons.length; index++) {
                const button = buttons[index];
                if (button.closest('#eos-assist-root') || button.dataset.eosKnownToolbar === '1') continue;
                if (button.closest('[class*="user"],.MuiAvatar-root')) break;
                button.dataset.eosAdminOnlyControl = '1';
                break;
            }
        }
        buttons.forEach(button => {
            if (button.closest('#eos-assist-root')) return;
            if (button.dataset.eosSystemSettingsControl === '1') {
                const hideSystem = state.role === 'enduser';
                button.classList.toggle('eos-role-hidden', hideSystem);
                button.disabled = hideSystem;
                if (hideSystem) { button.tabIndex = -1; button.setAttribute('aria-hidden', 'true'); }
                else { button.removeAttribute('aria-hidden'); button.disabled = false; }
            }
            if (button.dataset.eosAdminOnlyControl !== '1') return;
            const hide = state.role !== 'admin';
            button.classList.toggle('eos-admin-only-control', hide);
            button.disabled = hide;
            if (hide) { button.tabIndex = -1; button.setAttribute('aria-hidden', 'true'); }
            else { button.removeAttribute('aria-hidden'); }
        });
    });

    const setHashTab = tab => {
        if (!tab) return;
        if (tab === 'easy') tab = 'tab-intro';
        if (state.lastTarget === tab && Date.now() - Number(sessionStorage.getItem('eosRoleLastRedirectAt') || 0) < 1000) return;
        state.lastTarget = tab; state.redirects += 1;
        sessionStorage.setItem('eosRoleLastRedirectAt', String(Date.now()));
        const targetHash = `#${tab}`;
        if (window.location.hash !== targetHash) window.location.hash = targetHash;
        window.dispatchEvent(new CustomEvent('eos-role-navigate', { detail: { tab } }));
    };
    const redirectIfNeeded = () => safe(() => {
        if (isLoginView() || state.role === 'unknown') return;
        const route = currentRoute();
        if (route === 'easy') { setHashTab('tab-intro'); return; }
        if (!isRouteAllowed(state.role, route)) setHashTab(firstAllowedTab(state.role));
    });

    const appPaper = () => document.getElementById('app-paper');
    const routeForPattern = pattern => navEntries().find(entry => pattern.test(entry.tab) && isRouteAllowed(state.role, entry.tab, entry.label))?.tab || '';
    const actionDefinitions = role => {
        const uiTab = routeForPattern(/^tab-(?:nexowatt-ui|nexowatt-eos|eos-cockpit)(?:-|$)/) || 'tab-nexowatt-ui';
        const backupTab = routeForPattern(/^tab-(?:nexowatt-backup|eos-backup|nexowatt-sicherung)(?:-|$)/);
        if (role === 'installer') {
            return [
                ['Dienste', 'Instanzen starten, stoppen und diagnostizieren', 'tab-instances', 'services'],
                ['Module', 'Module installieren, aktualisieren und konfigurieren', 'tab-adapters', 'modules'],
                ['Datenpunkte', 'Messwerte prüfen und freigegebene Werte schreiben', 'tab-objects', 'datapoints'],
                ['Struktur', 'Räume und Funktionen für Smart Home zuordnen', 'tab-enums', 'structure'],
                ['Geräte', 'Geräteintegration und Inbetriebnahme öffnen', 'tab-devicemanager', 'devices'],
                ['Zugänge & Rechte', 'Endkundenpasswörter sicher zurücksetzen', 'tab-users', 'rights'],
                ['Basis-Einstellungen', 'Standort, Sprache und Anlagenparameter', 'basic-settings', 'settings'],
                ...(backupTab ? [['NexoWatt Sicherung', 'Sicherung und Wiederherstellung des EOS-Systems', backupTab, 'backup']] : []),
                ['EOS Cockpit', 'Energie-, Lade- und Gebäudesteuerung öffnen', uiTab, 'eos'],
            ];
        }
        return [
            ['EOS Cockpit', 'Energie, Laden und Gebäude bedienen', uiTab, 'eos'],
            ['Smart Home', 'Räume, Funktionen und freigegebene Geräte zuordnen', 'tab-enums', 'structure'],
            ...(backupTab ? [['NexoWatt Sicherung', 'Eigene Sicherungen ausführen und wiederherstellen', backupTab, 'backup']] : []),
        ];
    };
    const iconFor = icon => ({
        services: '↻', modules: '◫', datapoints: '⌁', structure: '⌂', devices: '⌘', rights: '♙', settings: '⚙', backup: '⇩', eos: '⚡',
    }[icon] || '•');
    const removeSafeOverview = () => {
        document.getElementById('eos-role-safe-overview')?.remove();
        document.documentElement.classList.remove('eos-safe-overview-active');
    };
    const suppressPermissionErrors = () => {
        if (state.role === 'admin') return;
        document.querySelectorAll('.MuiSnackbar-root,[role="alert"],.MuiAlert-root').forEach(node => {
            if (/permissionerror|cannot get data/i.test(node.textContent || '')) node.classList.add('eos-role-hidden');
        });
    };
    const ensureSafeOverview = () => safe(() => {
        if (isLoginView() || state.role === 'admin' || state.role === 'unknown' || currentRoute() !== 'tab-intro') {
            removeSafeOverview();
            return;
        }
        const paper = appPaper();
        if (!paper) return;
        document.documentElement.classList.add('eos-safe-overview-active');
        suppressPermissionErrors();
        let overview = document.getElementById('eos-role-safe-overview');
        if (!overview) {
            overview = document.createElement('section');
            overview.id = 'eos-role-safe-overview';
            overview.className = 'eos-role-safe-overview';
            paper.appendChild(overview);
        }
        const installer = state.role === 'installer';
        const actions = actionDefinitions(state.role).filter(([, , tab]) => tab === 'basic-settings' || isRouteAllowed(state.role, tab));
        overview.innerHTML = `
            <header class="eos-overview-hero eos-role-overview-hero">
                <div><span class="eos-overview-eyebrow">NexoWatt EOS</span><h1>Übersicht</h1><p>${installer ? 'Inbetriebnahme, Fehlersuche und Anlagenkonfiguration – passend zu deinen Installateurrechten.' : 'Deine freigegebenen Energie-, Smart-Home- und Sicherungsfunktionen.'}</p></div>
                <div class="eos-overview-role"><span class="eos-overview-status-dot"></span>${installer ? 'Installateur' : 'Gast / Endkunde'}</div>
            </header>
            <div class="eos-overview-grid">${actions.map(([label, description, tab, icon]) => `
                <button type="button" class="eos-overview-action" data-eos-role-tab="${tab}">
                    <span class="eos-overview-action-icon" aria-hidden="true">${iconFor(icon)}</span>
                    <span><strong>${label}</strong><small>${description}</small></span><i aria-hidden="true">›</i>
                </button>`).join('')}</div>`;
    });

    const hideOfficialReserveSurfaces = () => safe(() => {
        if (state.role === 'admin') return;
        const paper = appPaper();
        if (!paper) return;
        const selectors = [
            '[data-id^="system.adapter.admin"]','[data-id^="system.adapter.backitup"]',
            '[data-instance^="admin."]','[data-instance^="backitup."]',
            '[data-name="admin"]','[data-name="backitup"]',
            'a[href*="#tab-admin"]','a[href*="#tab-backitup"]',
            'a[href*="system.adapter.admin"]','a[href*="system.adapter.backitup"]',
        ];
        paper.querySelectorAll(selectors.join(',')).forEach(node => {
            const root = node.closest('tr,.MuiTableRow-root,.MuiCard-root,.MuiPaper-root,li,[role="row"],[data-testid="adapter-card"]') || node;
            if (root.id === 'app-paper' || root.classList.contains('eos-role-safe-overview')) return;
            root.classList.add('eos-role-hidden', 'eos-official-reserve-hidden');
            root.setAttribute('aria-hidden', 'true');
        });
    });

    const applySensitiveDialogPolicy = () => safe(() => {
        if (state.role === 'admin') return;
        const forbidden = /(repositories|repository|lizenzen|licenses|zertifikate|certificates|zugangsdaten|credentials|let'?s encrypt|standard acl|benutzer|users|gruppen|groups)/;
        for (const dialog of document.querySelectorAll('.MuiDialog-root,[role="dialog"]')) {
            if (dialog.closest('#eos-assist-root,.eos-account-management-overlay')) continue;
            const title = normalize(dialog.querySelector('h1,h2,.MuiDialogTitle-root')?.textContent || '');
            if (!/(basiseinstellungen|base settings|systemeinstellungen|system settings)/.test(title)) continue;
            if (state.role === 'enduser') {
                const close = Array.from(dialog.querySelectorAll('button')).find(button => /close|schliessen|schließen|cancel/.test(normalize(textOf(button))));
                close?.click();
                dialog.classList.add('eos-role-hidden');
                continue;
            }
            for (const control of dialog.querySelectorAll('button,[role="tab"],a')) {
                if (forbidden.test(normalize(textOf(control)))) control.classList.add('eos-role-hidden');
            }
            for (const label of dialog.querySelectorAll('label,.MuiFormControl-root,.MuiGrid-root')) {
                if (/expertenmodus|expert mode/.test(normalize(label.textContent || ''))) label.classList.add('eos-role-hidden');
            }
        }
    });

    const apply = () => {
        if (!state.policy || state.role === 'unknown') return;
        setRoleClasses(state.role);
        if (lockExpertMode()) return;
        applyMenuPolicy();
        markAdminOnlyToolbarControls();
        applySensitiveDialogPolicy();
        redirectIfNeeded();
        ensureSafeOverview();
        hideOfficialReserveSurfaces();
        suppressPermissionErrors();
        window.NEXOWATT_EOS_ACCOUNT_MANAGEMENT?.refreshEntry?.();
    };
    const scheduleApply = () => {
        if (state.scheduled) return;
        state.scheduled = true;
        const run = () => { state.scheduled = false; apply(); };
        if ('requestAnimationFrame' in window) requestAnimationFrame(run); else setTimeout(run, 16);
    };
    const applyPolicy = policy => {
        if (!policy || policy.role === 'unknown') return;
        const role = roleFromPolicy(policy);
        state.policy = { ...policy, role }; state.role = role;
        window.NEXOWATT_EOS_ROLE_POLICY = state.policy; window.NEXOWATT_EOS_ACCESS_ROLE = role;
        scheduleApply();
    };
    const connectPolicyClient = () => {
        const client = window.NEXOWATT_EOS_POLICY_CLIENT;
        if (!client) { setTimeout(connectPolicyClient, 150); return; }
        applyPolicy(client.getPolicy?.() || window.NEXOWATT_EOS_BOOTSTRAP_POLICY);
        state.unsubscribePolicy?.(); state.unsubscribePolicy = client.subscribe?.(applyPolicy);
        void client.refresh?.();
    };
    const startObserver = () => {
        const coordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
        if (!coordinator?.subscribe) { setTimeout(startObserver, 200); return; }
        if (state.unsubscribeDom) return;
        state.unsubscribeDom = coordinator.subscribe(mutations => {
            if (isHighLoadSurface() && mutations.length && mutations.every(m => isInsideAppPaper(m.target) || isInsideAppPaper(m.addedNodes?.[0]))) return;
            scheduleApply();
        });
    };

    document.addEventListener('click', event => {
        if (state.role === 'admin' || state.role === 'unknown') return;
        const clickedButton = event.target?.closest?.('button');
        if (clickedButton && isExpertModeButton(clickedButton)) {
            event.preventDefault(); event.stopImmediatePropagation(); lockExpertMode(); return;
        }
        if (clickedButton && isSystemSettingsButton(clickedButton)) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (state.role === 'installer') window.NEXOWATT_EOS_BASIC_SETTINGS?.open?.();
            return;
        }
        const target = event.target?.closest?.('[data-eos-admin-only-control="1"],[data-eos-system-settings-control="1"],button[data-eos-role-tab],a[href*="#tab-"],a[href*="#/tab-"]');
        if (!target) return;
        if (target.matches('[data-eos-admin-only-control="1"]')) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (target.matches('[data-eos-system-settings-control="1"]') && state.role === 'installer') {
            event.preventDefault(); event.stopImmediatePropagation(); window.NEXOWATT_EOS_BASIC_SETTINGS?.open?.(); return;
        }
        const roleTab = target.getAttribute('data-eos-role-tab');
        if (roleTab) {
            event.preventDefault();
            if (roleTab === 'basic-settings') window.NEXOWATT_EOS_BASIC_SETTINGS?.open?.();
            else setHashTab(roleTab);
            return;
        }
        const tab = tabFromHref(target.getAttribute('href') || target.href || '');
        if (tab && !isRouteAllowed(state.role, tab, textOf(target))) {
            event.preventDefault(); event.stopImmediatePropagation(); setHashTab(firstAllowedTab(state.role));
        }
    }, { capture: true, signal: abort.signal });

    window.NEXOWATT_EOS_ROLE_UI_API = Object.freeze({
        version: VERSION,
        getRole: () => state.role,
        getPolicy: () => state.policy,
        isRouteAllowed,
        defaultTab,
        isOfficialReserveTab,
        isCustomerBackupTab,
        refresh: scheduleApply,
    });
    const start = () => {
        applyPolicy(window.NEXOWATT_EOS_BOOTSTRAP_POLICY);
        connectPolicyClient(); startObserver();
        window.addEventListener('hashchange', () => { state.redirects = 0; redirectIfNeeded(); scheduleApply(); }, { signal: abort.signal });
        window.addEventListener('storage', scheduleApply, { signal: abort.signal });
        [100, 350, 750, 1300, 2500].forEach(delay => setTimeout(scheduleApply, delay));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
