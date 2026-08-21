(() => {
    'use strict';

    const VERSION = 'v87-rc3-product-role-access';
    window.NEXOWATT_EOS_ROLE_UI_VERSION = VERSION;

    const state = {
        policy: window.NEXOWATT_EOS_BOOTSTRAP_POLICY || null,
        role: window.NEXOWATT_EOS_ACCESS_ROLE || 'unknown',
        scheduled: false,
        fallbackTimer: 0,
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
    const endUserAllowedByText = value => /(eos cockpit|nexowatt ui|nexowatt cockpit|kunden cockpit|kundenbereich|endkundenbereich|visualisierung|visualisation|visu|dashboard|energie cockpit|energy cockpit|bedienung|smart home|smart-home|lovelace|jarvis|iqontrol|material)/.test(normalize(value));
    const endUserDeniedByText = value => /(module|dienste|datenpunkte|objekte|systemlogs|logs|zugange|rechte|benutzer|users|gruppen|groups|system hosts|system-hosts|hosts|dateien|files|sicherung|backup|konsole|console|terminal|xterm|admin|adapter|instances?|instanzen|geraetesuche|discovery|systemschutz|security)/.test(normalize(value));
    const isEndUserTab = (tab, label = '') => {
        const clean = normalize(tab); const text = `${clean} ${normalize(label)}`;
        if (!clean || clean === 'tab-intro') return false;
        if (clean === 'tab-enums') return true;
        if (/^tab-(nexowatt-ui|nexowatt-cockpit|eos-cockpit|eos-dashboard|kunden-cockpit|endkunden-cockpit|lovelace|jarvis|vis|iqontrol|material)(?:-|$)/.test(clean)) return true;
        return !endUserDeniedByText(text) && endUserAllowedByText(text);
    };
    const isInstallerDenied = (tab, label = '') => /(?:tab-users|tab-hosts|tab-files|tab-xterm|tab-xtrem|tab-admin|tab-system|zugange\s*&?\s*rechte|zugange|rechte|benutzer|users|gruppen|system-hosts|system hosts|hosts|dateien|files|konsole|console|terminal|xterm|sicherung|backup|systemschutz|security|legacy admin)/.test(`${normalize(tab)} ${normalize(label)}`);
    const isRouteAllowed = (role, route, label = '') => role === 'admin' || (role === 'installer' ? route === 'easy' || !isInstallerDenied(route, label) : role === 'enduser' ? route === 'easy' || isEndUserTab(route, label) : false);
    const defaultTab = role => role === 'installer' ? 'tab-instances' : role === 'enduser' ? 'easy' : 'tab-intro';

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

    const textOf = el => [el?.textContent || '', ...['href','title','aria-label','data-name','data-tab','data-id','id'].map(a => el?.getAttribute?.(a) || '')].join(' ');
    const navEntries = () => Array.from(document.querySelectorAll('a[href*="#tab-"],a[href*="#/tab-"]')).map(anchor => {
        const tab = tabFromHref(anchor.getAttribute('href') || anchor.href || '');
        if (!tab) return null;
        const root = anchor.closest('.MuiListItem-root,.MuiButtonBase-root,li,[role="button"],[class*="DrawerItem"],[class*="dragWrapper"]') || anchor;
        return { anchor, root, tab, label: textOf(root) || textOf(anchor) };
    }).filter(Boolean);
    const firstAllowedTab = role => navEntries().find(entry => isRouteAllowed(role, entry.tab, entry.label))?.tab || defaultTab(role);

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
            const label = toolbarButtonSignature(button);
            const system = isSystemSettingsButton(button);
            const expert = isExpertModeButton(button);
            if (system) {
                buildIndex = index;
                button.dataset.eosSystemSettingsControl = '1';
            }
            button.dataset.eosKnownToolbar = /notifications|visibility|menu|logout|brightness|palette|darkmode|lightmode|colorlens|sync/.test(label) ? '1' : '0';
            if (expert) button.dataset.eosAdminOnlyControl = '1';
        });
        // IconExpert has no stable data-testid in older GUI packages. The first otherwise unknown
        // control after Build/System settings is the expert toggle; theme buttons are excluded above.
        if (buildIndex >= 0) {
            for (let index = buildIndex + 1; index < buttons.length; index++) {
                const button = buttons[index];
                if (button.dataset.eosKnownToolbar === '1') continue;
                if (button.closest('[class*="user"],.MuiAvatar-root')) break;
                button.dataset.eosAdminOnlyControl = '1';
                break;
            }
        }
        buttons.forEach(button => {
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
        if (state.lastTarget === tab && Date.now() - Number(sessionStorage.getItem('eosRoleLastRedirectAt') || 0) < 1000) return;
        state.lastTarget = tab; state.redirects += 1;
        sessionStorage.setItem('eosRoleLastRedirectAt', String(Date.now()));
        const targetHash = tab === 'easy' ? '#easy' : `#${tab}`;
        if (window.location.hash !== targetHash) window.location.hash = targetHash;
        window.dispatchEvent(new CustomEvent('eos-role-navigate', { detail: { tab } }));
    };
    const redirectIfNeeded = () => safe(() => {
        if (isLoginView() || state.role === 'admin' || state.role === 'unknown') return;
        const route = currentRoute();
        if (!isRouteAllowed(state.role, route)) setHashTab(firstAllowedTab(state.role));
    });

    const appPaper = () => document.getElementById('app-paper') || document.querySelector('main,#root');
    const appLooksBlank = () => {
        const paper = appPaper(); if (!paper) return false;
        const text = normalize(paper.textContent || '');
        const interactive = paper.querySelectorAll('iframe,a,button,input,select,textarea,table,[role="grid"],.MuiDataGrid-root,.MuiTable-root').length;
        return text.length < 12 && interactive === 0;
    };
    const landingActions = role => role === 'installer'
        ? [ ['Dienste','tab-instances'], ['Module','tab-adapters'], ['Datenpunkte','tab-objects'], ['Struktur','tab-enums'], ['Geräte','tab-devicemanager'], ['Basis-Einstellungen','basic-settings'], ['EOS Cockpit','tab-nexowatt-ui'] ]
        : [ ['EOS Cockpit','tab-nexowatt-ui'], ['Smart Home','easy'], ['Smart Home Zuordnung','tab-enums'] ];
    const showLandingFallback = () => safe(() => {
        if (isLoginView() || state.role === 'admin' || state.role === 'unknown') return;
        const paper = appPaper(); if (!paper) return;
        if (!appLooksBlank()) { document.getElementById('eos-role-landing')?.remove(); return; }
        let landing = document.getElementById('eos-role-landing');
        if (!landing) {
            landing = document.createElement('section'); landing.id = 'eos-role-landing'; landing.className = 'eos-role-landing';
        }
        const installer = state.role === 'installer';
        const actions = landingActions(state.role).filter(([,tab]) => tab === 'easy' || tab === 'basic-settings' || isRouteAllowed(state.role, tab));
        landing.innerHTML = `<div class="eos-role-landing-card"><div class="eos-role-landing-eyebrow">NexoWatt EOS</div><h1>${installer ? 'Installateurbereich' : 'Endkundenbereich'}</h1><p>${installer ? 'Die technische Oberfläche enthält Inbetriebnahme und Fehlersuche. Sichere Basis-Einstellungen sind verfügbar; Repositories, Lizenzen, Zertifikate, Zugangsdaten, Sicherheitsverwaltung und Expertenmodus bleiben ausschließlich NexoWatt Admin/Service vorbehalten.' : 'Dieser Zugang zeigt nur die für den Endkunden freigegebenen Bedien- und Smart-Home-Oberflächen.'}</p><div class="eos-role-actions">${actions.map(([label,tab]) => `<button type="button" data-eos-role-tab="${tab}">${label}</button>`).join('')}</div></div>`;
        if (!paper.contains(landing)) paper.appendChild(landing);
    });

    const applySensitiveDialogPolicy = () => safe(() => {
        if (state.role === 'admin') return;
        const forbidden = /(repositories|repository|lizenzen|licenses|zertifikate|certificates|zugangsdaten|credentials|let'?s encrypt|standard acl|benutzer|users|gruppen|groups)/;
        for (const dialog of document.querySelectorAll('.MuiDialog-root,[role="dialog"]')) {
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
        applyMenuPolicy(); markAdminOnlyToolbarControls(); applySensitiveDialogPolicy(); redirectIfNeeded();
        clearTimeout(state.fallbackTimer); state.fallbackTimer = window.setTimeout(showLandingFallback, 700);
    };
    const scheduleApply = () => {
        if (state.scheduled) return; state.scheduled = true;
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
            event.preventDefault(); event.stopImmediatePropagation();
            lockExpertMode();
            return;
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
            event.preventDefault(); event.stopImmediatePropagation();
            window.NEXOWATT_EOS_BASIC_SETTINGS?.open?.();
            return;
        }
        const roleTab = target.getAttribute('data-eos-role-tab');
        if (roleTab) {
            event.preventDefault();
            if (roleTab === 'basic-settings') window.NEXOWATT_EOS_BASIC_SETTINGS?.open?.();
            else roleTab === 'easy' ? (window.location.hash = '#easy') : setHashTab(roleTab);
            return;
        }
        const tab = tabFromHref(target.getAttribute('href') || target.href || '');
        if (tab && !isRouteAllowed(state.role, tab, textOf(target))) { event.preventDefault(); event.stopImmediatePropagation(); setHashTab(firstAllowedTab(state.role)); }
    }, { capture: true, signal: abort.signal });

    window.NEXOWATT_EOS_ROLE_UI_API = Object.freeze({ version: VERSION, getRole: () => state.role, getPolicy: () => state.policy, isRouteAllowed, defaultTab, refresh: scheduleApply });
    const start = () => {
        applyPolicy(window.NEXOWATT_EOS_BOOTSTRAP_POLICY);
        connectPolicyClient(); startObserver();
        window.addEventListener('hashchange', () => { state.redirects = 0; redirectIfNeeded(); scheduleApply(); }, { signal: abort.signal });
        window.addEventListener('storage', scheduleApply, { signal: abort.signal });
        [100,500,1200,2500].forEach(delay => setTimeout(scheduleApply, delay));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
