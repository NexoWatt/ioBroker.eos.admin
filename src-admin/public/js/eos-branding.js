(() => {
    'use strict';

    window.NEXOWATT_EOS_UI_VERSION = 'v27-header-logo-nav-assist';

    const BRAND = 'NexoWatt EOS';
    const EOS_MEANING = 'Energy Operation System';
    const BRAND_LONG = `${BRAND} - ${EOS_MEANING}`;
    const ASSET_BASE = (() => {
        const script = document.currentScript?.src || document.querySelector('script[src*="eos-branding.js"]')?.src || window.location.href;
        return new URL('../', script).href;
    })();
    const asset = path => new URL(path.replace(/^\.\//, ''), ASSET_BASE).href;
    const LOGO = asset('img/eos/nexowatt-192.png');
    const PNG_LOGO = asset('img/eos/nexowatt-192.png');
    const LOGIN_MOTTO = EOS_MEANING;

    const TEXT_REPLACEMENTS = [
        [/NexoWatt\s+Energy\s+Management\s+System/gi, BRAND],
        [/NexoWatt\s+Energy\s+Managementsystem/gi, BRAND],
        [/Energy\s+Management\s+System/gi, EOS_MEANING],
        [/Energy\s+Managementsystem/gi, EOS_MEANING],
        [/ioBroker\.admin/gi, BRAND],
        [/ioBroker\s+admin/gi, BRAND],
        [/\bioBroker\b/gi, BRAND],
    ];

    const EXACT_LABELS = new Map(Object.entries({
        'Admin': BRAND,
        'NEXOWATT': 'NEXOWATT EOS',
        'NexoWatt EMS': 'EOS Cockpit',
        'Übersicht': 'Cockpit',
        'Overview': 'Cockpit',
        'Adapter': 'Module',
        'Adapters': 'Module',
        'Instanzen': 'Dienste',
        'Instances': 'Dienste',
        'Objekte': 'Datenpunkte',
        'Objects': 'Datenpunkte',
        'Kategorien': 'Struktur',
        'Categories': 'Struktur',
        'Protokolle': 'Systemlogs',
        'Logs': 'Systemlogs',
        'Benutzer': 'Zugänge & Rechte',
        'Users': 'Benutzerkonten',
        'Groups': 'Rollen',
        'In groups': 'Zugeordnete Rollen',
        'Permissions': 'Rechte',
        'Permission': 'Recht',
        'User parameters': 'Benutzerkonto bearbeiten',
        'Group parameters': 'Rolle & Rechte bearbeiten',
        'Main': 'Stammdaten',
        'Hosts': 'System-Hosts',
        'Files': 'Dateien',
        'Backup': 'Sicherung',
        'xtrem': 'Konsole',
        'xterm': 'Konsole',
        'ra_Logout': 'Abmelden',
        'Logout': 'Abmelden',
    }));

    const state = {
        fullPatchScheduled: false,
        scopePatchScheduled: false,
        pendingScopes: new Set(),
        lastFullPatch: 0,
        securityPolicy: {
            loaded: false,
            isAdmin: false,
            hideLegacyAdminForNonAdmins: true,
            restrictProtectedAdapterControls: true,
            protectedAdapters: ['eos-admin', 'backitup'],
        },
        securityFetchStarted: false,
    };

    const safe = fn => {
        try { return fn(); } catch (e) { return undefined; }
    };

    const replaceBrand = value => {
        if (!value || typeof value !== 'string') return value;
        let next = value;
        for (const [pattern, replacement] of TEXT_REPLACEMENTS) next = next.replace(pattern, replacement);
        const compact = next.trim();
        if (EXACT_LABELS.has(compact)) next = next.replace(compact, EXACT_LABELS.get(compact));
        return next;
    };

    const skipElement = el => {
        if (!el || el.nodeType !== 1) return false;
        const tag = el.tagName;
        return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'CODE' || tag === 'PRE';
    };

    const patchTextNode = node => {
        if (!node || node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
        if (skipElement(node.parentElement)) return;
        const before = node.nodeValue;
        const after = replaceBrand(before);
        if (after !== before) node.nodeValue = after;
    };

    const patchTextNodes = root => safe(() => {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            patchTextNode(root);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
        if (skipElement(root)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                return skipElement(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
        });
        let node;
        while ((node = walker.nextNode())) patchTextNode(node);
    });

    const patchImage = img => {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        const inBrandArea = !!img.closest('.eos-login-card, .eos-native-drawer-header, .eos-system-brand, .eos-brand-badge');
        const cleanSrc = src.split(/[?#]/)[0];
        const isBrandLogo = /(?:^|\/)(?:admin\.svg|admin\.png|logo192\.png|logo\.svg)$/i.test(cleanSrc) || (inBrandArea && /iobroker|admin|nexowatt|eos|logo/i.test(alt));
        const isAdapterIcon = /adapter\/|adapters\/|custom\/|upload\/|assets\//i.test(src);
        const isNeutralPlaceholder = /no-image\.svg/i.test(src);

        // Only replace real brand surfaces. Do not stamp the NexoWatt logo onto instance/module placeholders.
        if ((inBrandArea || (isBrandLogo && !isAdapterIcon)) && !(!inBrandArea && isNeutralPlaceholder)) {
            img.setAttribute('src', LOGO);
            img.setAttribute('alt', BRAND);
        }
    };

    const patchAttributes = root => safe(() => {
        if (!root || (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE)) return;
        const elements = root.matches && root.matches('[title],[aria-label],[alt],[placeholder],img')
            ? [root]
            : Array.from(root.querySelectorAll ? root.querySelectorAll('[title],[aria-label],[alt],[placeholder],img') : []);
        for (const el of elements) {
            ['title', 'aria-label', 'alt', 'placeholder'].forEach(attr => {
                if (el.hasAttribute && el.hasAttribute(attr)) {
                    const oldValue = el.getAttribute(attr);
                    const newValue = replaceBrand(oldValue);
                    if (newValue !== oldValue) el.setAttribute(attr, newValue);
                }
            });
            if (el.tagName === 'IMG') patchImage(el);
        }
    });

    const forceLoginGlobals = () => {
        window.loginTitle = BRAND;
        window.loginMotto = LOGIN_MOTTO;
        window.loginLogo = PNG_LOGO;
        window.loginLink = '#';
        window.loginHideLogo = 'false';
        window.loginBackgroundColor = '#020914';
        window.loadingBackgroundColor = '#020914';
    };

    const routeInfo = () => {
        const hash = window.location.hash || '';
        return {
            users: hash.includes('tab-users'),
            adapters: hash.includes('tab-adapters'),
            instances: hash.includes('tab-instances'),
            intro: hash.includes('tab-intro') || hash === '' || hash === '#/' || hash === '#/tab-intro',
        };
    };

    const normalizeIdentifier = value => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^iobroker\./, '')
        .replace(/^system\.adapter\./, '')
        .replace(/\.\d+$/, '')
        .replace(/[^a-z0-9_.-]+/g, ' ')
        .trim();

    const adapterPattern = adapter => {
        const escaped = String(adapter || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|[^a-z0-9_-])${escaped}(?:$|[^a-z0-9_-])`, 'i');
    };

    const textOfElement = el => {
        if (!el) return '';
        const attrs = ['data-adapter-name', 'data-adapter', 'data-id', 'id', 'title', 'aria-label', 'alt', 'href', 'src'];
        const values = [el.textContent || ''];
        attrs.forEach(attr => {
            if (el.getAttribute && el.hasAttribute(attr)) values.push(el.getAttribute(attr) || '');
        });
        return values.join(' ');
    };

    const securityEndpointUrls = () => [
        new URL('nexowatt/security/context', ASSET_BASE).href,
        new URL('nexowatt/security/session', ASSET_BASE).href,
        new URL('eos/security/status', ASSET_BASE).href,
    ];

    const normalizeSecurityPolicy = policy => {
        const protectedAdapters = new Set(['eos-admin', 'backitup']);
        (Array.isArray(policy?.protectedAdapters) ? policy.protectedAdapters : []).forEach(item => {
            const adapter = typeof item === 'string' ? normalizeIdentifier(item) : normalizeIdentifier(item?.adapter || item?.name);
            if (adapter) protectedAdapters.add(adapter);
        });
        const isAdmin = !!(policy?.isAdmin || policy?.isAdminGroup || policy?.isEosAdminGroup || policy?.isAdministrator);
        return {
            loaded: true,
            user: policy?.user || null,
            groups: Array.isArray(policy?.groups) ? policy.groups : [],
            isAdmin,
            hideLegacyAdminForNonAdmins: policy?.hideLegacyAdminForNonAdmins !== false && policy?.hideLegacyAdminFromNonAdmins !== false,
            restrictProtectedAdapterControls: policy?.restrictProtectedAdapterControls !== false,
            protectedAdapters: [...protectedAdapters].sort(),
        };
    };

    const applySecurityClasses = () => {
        const policy = state.securityPolicy;
        document.documentElement.classList.toggle('eos-security-loaded', !!policy.loaded);
        document.documentElement.classList.toggle('eos-security-admin', !!policy.isAdmin);
        document.documentElement.classList.toggle('eos-security-nonadmin', policy.loaded && !policy.isAdmin);
    };

    const fetchSecurityPolicy = async () => {
        if (state.securityFetchStarted) return;
        state.securityFetchStarted = true;
        for (const url of securityEndpointUrls()) {
            try {
                const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
                if (!response.ok) continue;
                const json = await response.json();
                if (!json || json.error) continue;
                state.securityPolicy = normalizeSecurityPolicy(json);
                applySecurityClasses();
                scheduleFullPatch(0);
                return;
            } catch (e) {
                // Security endpoint may be unavailable during login or old cache. Fallback below.
            }
        }
        state.securityPolicy = normalizeSecurityPolicy({ isAdmin: false, protectedAdapters: ['eos-admin', 'backitup'] });
        applySecurityClasses();
        scheduleFullPatch(0);
    };

    const isAdminUser = () => !!state.securityPolicy?.isAdmin;

    const isLegacyAdminContainer = el => {
        const text = textOfElement(el);
        if (/\badmin\.0\b/i.test(text) || /\bsystem\.adapter\.admin\.0\b/i.test(text)) return true;
        const candidates = Array.from(el.querySelectorAll ? el.querySelectorAll('*') : []);
        candidates.push(el);
        return candidates.some(node => {
            const value = textOfElement(node).trim();
            return /^admin$/i.test(value) || /^iobroker\.admin$/i.test(value) || /^system\.adapter\.admin$/i.test(value);
        });
    };

    const containerMentionsAdapter = (container, adapter) => {
        if (!container || !adapter) return false;
        const normalized = normalizeIdentifier(adapter);
        if (!normalized) return false;
        if (normalized === 'admin') return isLegacyAdminContainer(container);
        const pattern = adapterPattern(normalized);
        if (pattern.test(textOfElement(container))) return true;
        return Array.from(container.querySelectorAll ? container.querySelectorAll('[title],[aria-label],[data-adapter-name],[data-adapter],[data-id]') : [])
            .some(el => pattern.test(textOfElement(el)));
    };

    const getSecurityContainers = () => Array.from(document.querySelectorAll([
        '#app-paper .MuiCard-root',
        '#app-paper tr.MuiTableRow-root',
        '#app-paper tr',
        '#app-paper .MuiAccordion-root',
        '#app-paper [role="row"]',
        '#app-paper [role="treeitem"]',
        '#app-paper .MuiDataGrid-row',
        '#app-paper .MuiTreeItem-root',
        '#app-paper .MuiFormControlLabel-root',
        '#app-paper .MuiListItem-root',
        '#app-paper .MuiListItemButton-root',
    ].join(','))).filter(el => !el.closest('.MuiDialog-paper'));

    const isDeleteControl = el => {
        const text = normalize(el.textContent || el.getAttribute?.('title') || el.getAttribute?.('aria-label') || '');
        const title = normalize(el.getAttribute?.('title') || el.closest?.('[title]')?.getAttribute('title') || '');
        const svg = el.querySelector?.('svg[data-testid*="Delete"], svg[data-testid*="Remove"], svg[data-testid*="Clear"]');
        return !!svg || /\b(delete|remove|uninstall|del|loschen|entfernen|deinstallieren)\b/.test(`${text} ${title}`);
    };

    const lockDeleteControls = container => {
        Array.from(container.querySelectorAll('button, [role="button"], a')).forEach(control => {
            if (!isDeleteControl(control)) return;
            control.classList.add('eos-protected-delete-control');
            control.setAttribute('aria-disabled', 'true');
            control.setAttribute('title', 'Nur Administratoren dürfen geschützte EOS-Systemmodule löschen');
            if ('disabled' in control) control.disabled = true;
            control.addEventListener('click', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
            }, true);
        });
    };

    const protectDeleteDialogs = () => {
        if (isAdminUser() || state.securityPolicy.restrictProtectedAdapterControls === false) return;
        const protectedAdapters = state.securityPolicy.protectedAdapters || [];
        Array.from(document.querySelectorAll('.MuiDialog-paper, [role="dialog"]')).forEach(dialog => {
            const text = textOfElement(dialog);
            if (!/(delete|remove|loschen|entfernen|deinstallieren|del\s+)/i.test(text)) return;
            const protectedHit = protectedAdapters.some(adapter => containerMentionsAdapter(dialog, adapter));
            if (!protectedHit) return;
            dialog.classList.add('eos-protected-delete-dialog');
            Array.from(dialog.querySelectorAll('button')).forEach(button => {
                const label = normalize(button.textContent || button.getAttribute('aria-label') || '');
                if (/^(ok|ja|yes|delete|remove|loschen|entfernen|deinstallieren)$/.test(label)) {
                    button.disabled = true;
                    button.classList.add('eos-protected-delete-control');
                }
            });
        });
    };

    const hideSecuritySettingsForNonAdmin = () => {
        if (isAdminUser()) return;
        Array.from(document.querySelectorAll('.MuiDialog-paper, [role="dialog"]')).forEach(dialog => {
            const dialogText = textOfElement(dialog);
            if (!/(eos security|nexowatt security|legacy admin|alter admin|protected adapters|geschutzte adapter|eos admin groups)/i.test(dialogText)) return;
            dialog.classList.add('eos-security-settings-restricted');
            const needles = /(eos security|nexowatt security|legacy admin|alter admin|protected adapters|geschutzte adapter|eos admin groups|lock legacy admin|hide legacy admin|restrict protected adapter)/i;
            Array.from(dialog.querySelectorAll('label, legend, h2, h3, h4, .MuiTypography-root, .MuiFormLabel-root')).forEach(label => {
                if (!needles.test(label.textContent || '')) return;
                const row = label.closest('.MuiGrid2-root, .MuiGrid-root, .MuiFormControl-root, .MuiBox-root, .MuiPaper-root') || label.parentElement;
                if (row && row !== dialog) row.classList.add('eos-security-admin-only-field');
            });
            if (!dialog.querySelector('.eos-security-restricted-note')) {
                const note = document.createElement('div');
                note.className = 'eos-security-restricted-note';
                note.innerHTML = '<strong>EOS Systemschutz aktiv</strong><span>Diese Sicherheitseinstellungen sind nur für Administratoren sichtbar und änderbar.</span>';
                const content = dialog.querySelector('.MuiDialogContent-root') || dialog;
                content.insertBefore(note, content.firstElementChild || null);
            }
        });
    };

    const applySecurityUiGuard = () => safe(() => {
        const policy = state.securityPolicy;
        applySecurityClasses();
        if (!policy.loaded) return;
        if (isAdminUser()) {
            document.querySelectorAll('.eos-hidden-legacy-admin, .eos-protected-adapter-row').forEach(el => {
                el.classList.remove('eos-hidden-legacy-admin', 'eos-protected-adapter-row');
                el.removeAttribute('aria-hidden');
            });
            return;
        }

        const containers = getSecurityContainers();
        containers.forEach(container => {
            if (policy.hideLegacyAdminForNonAdmins !== false && isLegacyAdminContainer(container)) {
                container.classList.add('eos-hidden-legacy-admin');
                container.setAttribute('aria-hidden', 'true');
                return;
            }
            if (policy.restrictProtectedAdapterControls !== false) {
                const protectedHit = (policy.protectedAdapters || []).some(adapter => adapter !== 'admin' && containerMentionsAdapter(container, adapter));
                if (protectedHit) {
                    container.classList.add('eos-protected-adapter-row');
                    lockDeleteControls(container);
                }
            }
        });
        protectDeleteDialogs();
        hideSecuritySettingsForNonAdmin();
    });

    const isLoginView = () => safe(() => {
        const hasApp = !!document.getElementById('app-paper');
        if (hasApp) return false;
        const urlText = `${window.location.pathname} ${window.location.search} ${window.location.hash}`.toLowerCase();
        const hasPassword = !!document.querySelector('#password, input[type="password"], input[name*="pass" i], input[autocomplete*="password" i]');
        const hasUserField = !!document.querySelector('#username, input[name="username" i], input[name*="login" i], input[name*="user" i], input[autocomplete="username"]');
        const hasLoginButton = Array.from(document.querySelectorAll('button')).some(button => /^(anmelden|login|sign in)$/.test(normalize(button.textContent || '')));
        return /(?:^|[/?#])login(?:[/?#=&]|$)/.test(urlText) || (hasPassword && (hasUserField || hasLoginButton));
    }) || false;

    const removeLogoutButton = () => document.querySelectorAll('.eos-direct-logout').forEach(button => button.remove());

    const sanitizeLoginHref = () => safe(() => {
        const url = new URL(window.location.href);
        const href = url.searchParams.get('href') || '';
        if (href && /(?:^|\/)(?:logout|login|404|404\.html)(?:[/?#]|$)|%2f(?:logout|login|404|404\.html)|undefined|null/i.test(href)) {
            url.searchParams.delete('href');
            window.history.replaceState(null, document.title, `${url.pathname}${url.search}${url.hash}`);
        }
    });

    const normalizeBadAddressAfterLogin = () => safe(() => {
        if (!document.getElementById('app-paper')) return;
        const pathname = window.location.pathname || '';
        if (/(?:\/login|\/logout|\/404\.html)$/i.test(pathname)) {
            const clean = new URL(ASSET_BASE);
            clean.hash = window.location.hash || '#/tab-intro';
            window.history.replaceState(null, document.title, `${clean.pathname}${clean.search}${clean.hash}`);
        }
    });

    const setRouteClasses = () => {
        const routes = routeInfo();
        document.documentElement.classList.toggle('eos-route-users', routes.users);
        document.documentElement.classList.toggle('eos-route-adapters', routes.adapters);
        document.documentElement.classList.toggle('eos-route-instances', routes.instances);
        document.documentElement.classList.toggle('eos-route-intro', routes.intro);
    };

    const getLoginCard = () => {
        const input = document.querySelector('#username, input[name="username"], #password, input[type="password"]');
        return input ? input.closest('.MuiPaper-root, form, main > div') : null;
    };

    const patchLogin = () => safe(() => {
        forceLoginGlobals();
        sanitizeLoginHref();
        const hasApp = !!document.getElementById('app-paper');
        const card = hasApp ? null : getLoginCard();
        const isLogin = isLoginView();
        document.documentElement.classList.toggle('eos-login', isLogin);
        document.documentElement.classList.toggle('eos-loading', !document.body || !document.querySelector('#root > *'));
        if (isLogin) removeLogoutButton();
        if (!isLogin || !card) return;
        card.classList.add('eos-login-card');
        const titles = Array.from(card.querySelectorAll('h1,h2,h3,h4,h5,.MuiTypography-h5'));
        const title = titles.find(el => /management|nexowatt|admin|eos/i.test(el.textContent || '')) || titles[0];
        if (title && title.textContent.trim() !== BRAND) {
            title.textContent = BRAND;
            title.setAttribute('aria-label', BRAND_LONG);
        }
        const logo = card.querySelector('img');
        if (logo) patchImage(logo);
        Array.from(card.querySelectorAll('a, .MuiTypography-caption, .MuiTypography-body2')).forEach(el => {
            const text = (el.textContent || '').trim();
            if (/independent|transparent|fair|management|iobroker/i.test(text)) {
                el.textContent = `${BRAND} · ${EOS_MEANING}`;
            }
        });
    });

    const logout = () => {
        const nativeLogout = Array.from(document.querySelectorAll('a,button')).find(el => /^(abmelden|logout)$/i.test((el.textContent || '').trim()) && !el.classList.contains('eos-direct-logout'));
        if (nativeLogout) { nativeLogout.click(); return; }
        safe(() => {
            ['App.refreshToken', 'App.accessToken', 'App.token', 'tokens', 'iobroker.admin.token'].forEach(key => {
                window.localStorage && window.localStorage.removeItem(key);
                window.sessionStorage && window.sessionStorage.removeItem(key);
            });
        });
        const cleanRoot = ASSET_BASE.replace(/\/?$/, '/');
        window.location.assign(cleanRoot);
    };

    const ensureBrandBadge = toolbar => {
        if (!toolbar) return;
        document.querySelectorAll('.eos-brand-badge').forEach(existing => {
            if (!toolbar.contains(existing)) existing.remove();
        });
        let badge = toolbar.querySelector('.eos-brand-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'eos-brand-badge eos-system-brand';
            const firstButton = toolbar.querySelector('button');
            toolbar.insertBefore(badge, firstButton || toolbar.firstChild || null);
        }
        badge.classList.add('eos-system-brand');
        badge.innerHTML = `
            <span class="eos-brand-badge-mark"><img class="eos-brand-badge-logo" src="${LOGO}" alt="${BRAND}" /></span>
            <span class="eos-brand-badge-copy"><strong>${BRAND}</strong><small>${EOS_MEANING}</small></span>
            <span class="eos-brand-led"></span>
        `;
    };

    const ensureLogoutButton = () => {
        // v14: the custom EOS logout button remains disabled/removed.
        // The visible native logout menu item is hidden too because it caused broken redirects.
        removeLogoutButton();
    };

    const NAV_COMPACT_KEY = 'nexowatt.eos.navCompact';

    const setNavCompact = value => safe(() => {
        const active = !!value;
        document.documentElement.classList.toggle('eos-nav-compact', active);
        window.localStorage && window.localStorage.setItem(NAV_COMPACT_KEY, active ? '1' : '0');
    });

    const restoreNavCompact = () => safe(() => {
        const saved = window.localStorage && window.localStorage.getItem(NAV_COMPACT_KEY);
        if (saved === '1') document.documentElement.classList.add('eos-nav-compact');
        if (saved === '0') document.documentElement.classList.remove('eos-nav-compact');
    });

    const bindCompactNavToggle = header => safe(() => {
        if (!header) return;
        restoreNavCompact();
        const controls = Array.from(header.querySelectorAll('button, .MuiIconButton-root, [role="button"]'));
        controls.forEach(control => {
            if (control.dataset.eosCompactToggleBound === '1') return;
            control.dataset.eosCompactToggleBound = '1';
            control.setAttribute('title', 'Menü kompakt/erweitert anzeigen');
            control.setAttribute('aria-label', 'Menü kompakt/erweitert anzeigen');
            const toggle = event => {
                event.preventDefault();
                event.stopPropagation();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                setNavCompact(!document.documentElement.classList.contains('eos-nav-compact'));
                scheduleFullPatch(0);
                return false;
            };
            control.addEventListener('click', toggle, true);
            control.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') toggle(event);
            }, true);
        });
    });

    const hideNativeLogoutNav = () => safe(() => {
        const candidates = Array.from(document.querySelectorAll('.MuiDrawer-paper a, .MuiDrawer-paper button, .MuiDrawer-paper .MuiListItem-root, .MuiDrawer-paper .MuiListItemButton-root, .MuiDrawer-paper [role=\"button\"]'));
        candidates.forEach(el => {
            const text = normalize(el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '');
            const href = String(el.getAttribute('href') || '');
            const isLogout = /^(abmelden|logout|ra_logout)$/.test(text) || /(?:^|[/?#])logout(?:[/?#]|$)/i.test(href);
            if (!isLogout) return;
            const item = el.closest('.MuiListItem-root, li') || el.closest('.MuiListItemButton-root, a, button') || el;
            item.classList.add('eos-hidden-logout');
            item.setAttribute('aria-hidden', 'true');
            item.setAttribute('tabindex', '-1');
        });
    });

    const patchDrawerHeader = drawer => safe(() => {
        if (!drawer) return;
        drawer.classList.add('eos-drawer');
        drawer.querySelectorAll('.eos-drawer-identity').forEach(el => el.remove());

        const directChildren = Array.from(drawer.children).filter(el => el.nodeType === 1);
        const isListLike = el => el.classList?.contains('MuiList-root') || el.querySelector?.('.MuiListItemButton-root');
        let header = drawer.querySelector(':scope > .eos-native-drawer-header');
        if (!header) {
            header = directChildren.find(el => !isListLike(el) && el.querySelector && el.querySelector('button') && (el.querySelector('img') || el.querySelector('.MuiAvatar-root') || el.querySelector('a')))
                || directChildren.find(el => !isListLike(el) && el.querySelector && (el.querySelector('button') || el.querySelector('img') || el.querySelector('.MuiAvatar-root')));
        }
        if (header) {
            header.classList.add('eos-native-drawer-header');
            bindCompactNavToggle(header);
            const img = header.querySelector('img');
            if (img) patchImage(img);
            const avatarImg = header.querySelector('.MuiAvatar-img');
            if (avatarImg) patchImage(avatarImg);
            const logoArea = header.querySelector('a')?.parentElement || header.firstElementChild || header;
            if (logoArea && !logoArea.querySelector('.eos-native-title')) {
                const title = document.createElement('span');
                title.className = 'eos-native-title';
                title.innerHTML = `<strong>${BRAND}</strong><small>${EOS_MEANING}</small>`;
                const link = logoArea.querySelector('a');
                if (link && link.nextSibling) logoArea.insertBefore(title, link.nextSibling);
                else logoArea.appendChild(title);
            }
        }
        const list = drawer.querySelector('.MuiList-root');
        if (list) {
            list.classList.add('eos-scroll-nav');
            hideNativeLogoutNav();
        }
    });

    const patchShell = () => safe(() => {
        const hasApp = !!document.getElementById('app-paper');
        const login = isLoginView();
        document.documentElement.classList.toggle('eos-login', login);
        document.documentElement.classList.toggle('eos-app', !login && hasApp);
        setRouteClasses();
        if (login || !hasApp) {
            removeLogoutButton();
            return;
        }
        const toolbar = document.querySelector('#root > .MuiPaper-root > .MuiAppBar-root .MuiToolbar-root, header .MuiToolbar-root, .MuiAppBar-root .MuiToolbar-root');
        if (toolbar) {
            toolbar.classList.add('eos-top-toolbar');
            ensureBrandBadge(toolbar);
        }
        patchDrawerHeader(document.querySelector('.MuiDrawer-paper'));
        hideNativeLogoutNav();
        removeLogoutButton();
    });

    const ensureRightsHelper = () => safe(() => {
        const appPaper = document.getElementById('app-paper');
        if (!appPaper) return;
        const isUsers = routeInfo().users;
        const existing = appPaper.querySelector('.eos-rights-helper');
        if (!isUsers) {
            existing && existing.remove();
            return;
        }
        if (existing) return;
        const helper = document.createElement('section');
        helper.className = 'eos-rights-helper';
        helper.innerHTML = `
            <div class="eos-rights-helper-icon">🔐</div>
            <div class="eos-rights-helper-copy">
                <strong>Zugänge & Rechte</strong>
                <span>Benutzer werden Rollen zugeordnet. Wähle ein verständliches Rechteprofil und passe einzelne Rechte bei Bedarf an.</span>
            </div>
            <div class="eos-rights-helper-steps">
                <span>1 Benutzer</span><span>2 Rolle</span><span>3 Profil</span><span>4 Speichern</span>
            </div>
        `;
        appPaper.insertBefore(helper, appPaper.firstElementChild || null);
    });

    const normalize = text => String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const permissionKey = label => {
        const text = normalize(label);
        if (/auflisten|list/.test(text)) return 'list';
        if (/lesen|read/.test(text)) return 'read';
        if (/schreiben|write/.test(text)) return 'write';
        if (/erstellen|create/.test(text)) return 'create';
        if (/loschen|delete/.test(text)) return 'delete';
        if (/shell|execute|ausfuhr/.test(text)) return 'execute';
        if (/http/.test(text)) return 'http';
        if (/sendto/.test(text)) return 'sendto';
        return '';
    };

    const sectionKey = label => {
        let el = label.parentElement;
        for (let i = 0; i < 7 && el; i += 1, el = el.parentElement) {
            const heading = el.querySelector && el.querySelector('h2,h3,h4,.MuiTypography-h6');
            if (heading && el.contains(label)) {
                const text = normalize(heading.textContent);
                if (/objekt|object/.test(text)) return 'object';
                if (/zustand|state/.test(text)) return 'state';
                if (/benutzer|user/.test(text)) return 'users';
                if (/datei|file/.test(text)) return 'file';
                if (/andere|other/.test(text)) return 'other';
            }
        }
        return 'unknown';
    };

    const desiredPermission = (profile, block, perm) => {
        if (!perm) return null;
        if (profile === 'admin') return true;
        if (profile === 'viewer') return ['object', 'state', 'file'].includes(block) && ['list', 'read'].includes(perm);
        if (profile === 'operator') {
            if (['object', 'state', 'file'].includes(block)) return ['list', 'read', 'write'].includes(perm);
            if (block === 'other') return perm === 'sendto';
            if (block === 'users') return false;
        }
        if (profile === 'service') {
            if (['object', 'state', 'file'].includes(block)) return ['list', 'read', 'write', 'create'].includes(perm);
            if (block === 'other') return ['sendto', 'execute'].includes(perm);
            if (block === 'users') return false;
        }
        return null;
    };

    const applyPermissionProfile = (dialog, profile) => {
        const labels = Array.from(dialog.querySelectorAll('label.MuiFormControlLabel-root'));
        labels.forEach(label => {
            const input = label.querySelector('input[type="checkbox"]');
            if (!input || input.disabled) return;
            const perm = permissionKey(label.textContent);
            const block = sectionKey(label);
            const desired = desiredPermission(profile, block, perm);
            if (desired === null) return;
            if (Boolean(input.checked) !== desired) input.click();
        });
    };

    const ensurePermissionPresets = () => safe(() => {
        const dialogs = Array.from(document.querySelectorAll('.MuiDialog-paper'));
        const dialog = dialogs.find(item => item.querySelectorAll('input[type="checkbox"]').length >= 8 && /rechte|permissions|berecht/i.test(item.textContent || ''));
        if (!dialog || dialog.querySelector('.eos-permission-presets')) return;
        const content = dialog.querySelector('.MuiDialogContent-root') || dialog;
        const panel = document.createElement('section');
        panel.className = 'eos-permission-presets';
        panel.innerHTML = `
            <div class="eos-permission-presets-title">Rechte-Schnellprofile</div>
            <div class="eos-permission-presets-text">Wähle ein Profil und passe danach einzelne Rechte an. Administrator-Rollen bleiben bewusst transparent sichtbar.</div>
            <div class="eos-permission-presets-actions">
                <button type="button" data-profile="viewer">Nur lesen</button>
                <button type="button" data-profile="operator">Bedienung</button>
                <button type="button" data-profile="service">Service</button>
                <button type="button" data-profile="admin">Vollzugriff</button>
            </div>
        `;
        panel.addEventListener('click', event => {
            const button = event.target.closest('button[data-profile]');
            if (!button) return;
            applyPermissionProfile(dialog, button.getAttribute('data-profile'));
        });
        content.insertBefore(panel, content.firstElementChild || null);
    });


    const ensureSettingsDialogClasses = () => safe(() => {
        const dialogs = Array.from(document.querySelectorAll('.MuiDialog-paper, [role="dialog"]'));
        dialogs.forEach(dialog => {
            const title = dialog.querySelector('#base-settings-dialog-title, .dialogName');
            const aria = (dialog.getAttribute('aria-labelledby') || '').toLowerCase();
            const text = normalize(title?.textContent || dialog.textContent || '');
            const isSettingsDialog =
                aria.includes('system-settings-dialog-title') ||
                aria.includes('base-settings-dialog-title') ||
                /basiseinstellungen|base settings|host basis|host base settings|system repositories|standard acl|let'?s encrypt|zugangsdaten|zertifikate/.test(text);
            if (!isSettingsDialog) return;
            dialog.classList.add('eos-settings-dialog');
            const content = dialog.querySelector('.MuiDialogContent-root');
            if (content) content.classList.add('eos-settings-content');
            const actions = dialog.querySelector('.MuiDialogActions-root');
            if (actions) actions.classList.add('eos-settings-actions');
            dialog.querySelectorAll('.leaflet-container').forEach(map => map.classList.add('eos-settings-map'));
        });
    });


    const hideOfficialNexoWattRepoWarning = () => safe(() => {
        const body = document.body || document.documentElement;
        if (!body || !/repo|repository|nexowatt|gefahr|risk/i.test(body.textContent || '')) return;
        const warningTextPattern = /(WARNUNG:\s*)?(Aktuelles Repository ist|Current repository is)\s+["“”']?nexowatt["“”']?.*(Benutzung auf eigene Gefahr|Use at own risk)?/i;
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const text = node.nodeValue || '';
                return warningTextPattern.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        const hits = [];
        let node;
        while ((node = walker.nextNode())) hits.push(node);
        hits.forEach(textNode => {
            let target = textNode.parentElement;
            const box = target && target.closest('.MuiBox-root, .MuiAlert-root, [role="alert"]');
            if (box && warningTextPattern.test(box.textContent || '')) target = box;
            else {
                for (let i = 0; i < 5 && target && target.parentElement; i += 1) {
                    const txt = (target.textContent || '').trim();
                    if (warningTextPattern.test(txt) && txt.length < 220) break;
                    target = target.parentElement;
                }
            }
            if (!target || !warningTextPattern.test(target.textContent || '')) return;
            target.classList.add('eos-hidden-nexowatt-repo-warning');
            target.setAttribute('aria-hidden', 'true');
            target.style.display = 'none';
        });
    });

    const patchDocumentMeta = () => safe(() => {
        document.title = BRAND_LONG;
        const theme = document.querySelector('meta[name="theme-color"]');
        if (theme) theme.setAttribute('content', '#020914');
        const desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute('content', BRAND_LONG);
    });

    const fullPatch = () => {
        state.fullPatchScheduled = false;
        state.lastFullPatch = Date.now();
        forceLoginGlobals();
        sanitizeLoginHref();
        normalizeBadAddressAfterLogin();
        patchDocumentMeta();
        patchLogin();
        patchShell();
        ensureRightsHelper();
        ensurePermissionPresets();
        ensureSettingsDialogClasses();
        hideNativeLogoutNav();
        hideOfficialNexoWattRepoWarning();
        applySecurityUiGuard();
        patchTextNodes(document.body || document.documentElement);
        patchAttributes(document.body || document.documentElement);
    };

    const scopePatch = () => {
        state.scopePatchScheduled = false;
        const scopes = Array.from(state.pendingScopes);
        state.pendingScopes.clear();
        normalizeBadAddressAfterLogin();
        patchLogin();
        patchShell();
        ensureRightsHelper();
        ensurePermissionPresets();
        ensureSettingsDialogClasses();
        hideNativeLogoutNav();
        hideOfficialNexoWattRepoWarning();
        applySecurityUiGuard();
        for (const scope of scopes.slice(0, 80)) {
            if (!scope || !scope.isConnected) continue;
            patchTextNodes(scope);
            patchAttributes(scope);
        }
    };

    const scheduleFullPatch = delay => {
        if (state.fullPatchScheduled && !delay) return;
        state.fullPatchScheduled = true;
        const run = () => {
            if ('requestIdleCallback' in window) window.requestIdleCallback(fullPatch, { timeout: 800 });
            else window.requestAnimationFrame(fullPatch);
        };
        if (delay) window.setTimeout(run, delay);
        else run();
    };

    const scheduleScopePatch = () => {
        if (state.scopePatchScheduled) return;
        state.scopePatchScheduled = true;
        const run = () => {
            if ('requestIdleCallback' in window) window.requestIdleCallback(scopePatch, { timeout: 600 });
            else window.requestAnimationFrame(scopePatch);
        };
        run();
    };

    const installObserver = () => safe(() => {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'characterData') {
                    patchTextNode(mutation.target);
                    continue;
                }
                if (mutation.type !== 'childList') continue;
                mutation.addedNodes.forEach(node => {
                    if (!node) return;
                    if (node.nodeType === Node.TEXT_NODE) patchTextNode(node);
                    else if (node.nodeType === Node.ELEMENT_NODE) state.pendingScopes.add(node);
                });
            }
            if (state.pendingScopes.size) scheduleScopePatch();
        });
        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
        });
    });

    forceLoginGlobals();
    restoreNavCompact();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            fullPatch();
            fetchSecurityPolicy();
            installObserver();
            [250, 1000, 2500, 5000].forEach(scheduleFullPatch);
        }, { once: true });
    } else {
        fullPatch();
        fetchSecurityPolicy();
        installObserver();
        [250, 1000, 2500, 5000].forEach(scheduleFullPatch);
    }
    window.addEventListener('load', () => scheduleFullPatch(0), { once: true });
    window.addEventListener('hashchange', () => scheduleFullPatch(0));
})();
