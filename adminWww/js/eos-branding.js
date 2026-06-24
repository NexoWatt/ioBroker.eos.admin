(() => {
    'use strict';

    window.NEXOWATT_EOS_UI_VERSION = 'v37-notification-backitup-security-text-fix';

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


    const MOJIBAKE_REPLACEMENTS = new Map(Object.entries({
        'dÃ¼rfen': 'dürfen', 'DÃ¼rfen': 'Dürfen',
        'fÃ¼r': 'für', 'FÃ¼r': 'Für',
        'mÃ¼ssen': 'müssen', 'MÃ¼ssen': 'Müssen',
        'kÃ¶nnen': 'können', 'KÃ¶nnen': 'Können',
        'mÃ¶glich': 'möglich', 'MÃ¶glich': 'Möglich',
        'LÃ¶schen': 'Löschen', 'lÃ¶schen': 'löschen',
        'schÃ¼tzen': 'schützen', 'SchÃ¼tzen': 'Schützen',
        'SchÃ¼tzt': 'Schützt', 'schÃ¼tzt': 'schützt',
        'GeschÃ¼tzte': 'Geschützte', 'geschÃ¼tzte': 'geschützte',
        'ausgewÃ¤hlte': 'ausgewählte', 'AusgewÃ¤hlte': 'Ausgewählte',
        'Ã¤ndern': 'ändern', 'Ã„ndern': 'Ändern',
        'Ã¼ber': 'über', 'Ãœber': 'Über',
        'WÃ¤hle': 'Wähle', 'wÃ¤hle': 'wähle',
        'Ã¶ffnen': 'öffnen', 'Ã–ffnen': 'Öffnen',
        'schlieÃŸen': 'schließen', 'SchlieÃŸen': 'Schließen',
        'GerÃ¤t': 'Gerät', 'gerÃ¤t': 'gerät',
        'GerÃ¤te': 'Geräte', 'gerÃ¤te': 'geräte',
        'ZugÃ¤nge': 'Zugänge', 'zugÃ¤nge': 'zugänge',
        'ÃŸ': 'ß', 'Ã„': 'Ä', 'Ã–': 'Ö', 'Ãœ': 'Ü', 'Ã¤': 'ä', 'Ã¶': 'ö', 'Ã¼': 'ü'
    }));



    const decodeMojibakeChunk = chunk => {
        try {
            const bytes = Uint8Array.from(Array.from(chunk, char => char.charCodeAt(0) & 0xff));
            const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
            return decoded && decoded !== chunk ? decoded : chunk;
        } catch (_) {
            return chunk;
        }
    };

    const repairMojibake = value => {
        let text = String(value || '');
        // Repair common UTF-8-as-Latin1 fragments, including double-encoded strings
        // such as dÃƒÂ¼rfen, LÃƒÂ¶schen, geschÃƒÂ¼tzt.
        for (let i = 0; i < 3 && /(?:Ã.|Â.|â.|�)/.test(text); i += 1) {
            const repaired = text.replace(/[\u00C2-\u00F4][\u0080-\u00BF\u00A0-\u00BF]+/g, decodeMojibakeChunk);
            if (repaired === text) break;
            text = repaired;
        }
        const hardMap = new Map(Object.entries({
            'dÃƒÂ¼rfen': 'dürfen', 'dÃ¼rfen': 'dürfen', 'DÃƒÂ¼rfen': 'Dürfen', 'DÃ¼rfen': 'Dürfen',
            'fÃƒÂ¼r': 'für', 'fÃ¼r': 'für', 'FÃƒÂ¼r': 'Für', 'FÃ¼r': 'Für',
            'kÃƒÂ¶nnen': 'können', 'kÃ¶nnen': 'können', 'KÃƒÂ¶nnen': 'Können', 'KÃ¶nnen': 'Können',
            'mÃƒÂ¶glich': 'möglich', 'mÃ¶glich': 'möglich', 'MÃƒÂ¶glich': 'Möglich', 'MÃ¶glich': 'Möglich',
            'LÃƒÂ¶schen': 'Löschen', 'LÃ¶schen': 'Löschen', 'lÃƒÂ¶schen': 'löschen', 'lÃ¶schen': 'löschen',
            'schÃƒÂ¼tzen': 'schützen', 'schÃ¼tzen': 'schützen', 'SchÃƒÂ¼tzen': 'Schützen', 'SchÃ¼tzen': 'Schützen',
            'GeschÃƒÂ¼tzte': 'Geschützte', 'GeschÃ¼tzte': 'Geschützte', 'geschÃƒÂ¼tzte': 'geschützte', 'geschÃ¼tzte': 'geschützte',
            'ausgewÃƒÂ¤hlte': 'ausgewählte', 'ausgewÃ¤hlte': 'ausgewählte', 'AusgewÃƒÂ¤hlte': 'Ausgewählte', 'AusgewÃ¤hlte': 'Ausgewählte',
            'ÃƒÂ¤ndern': 'ändern', 'Ã¤ndern': 'ändern', 'ÃƒÅ“ber': 'Über', 'Ãœber': 'Über', 'ÃƒÂ¼ber': 'über', 'Ã¼ber': 'über',
            'GerÃƒÂ¤t': 'Gerät', 'GerÃ¤t': 'Gerät', 'GerÃƒÂ¤te': 'Geräte', 'GerÃ¤te': 'Geräte',
            'schlieÃƒÅ¸en': 'schließen', 'schlieÃŸen': 'schließen', 'ÃƒÅ¸': 'ß', 'ÃŸ': 'ß',
            'ÃƒÂ¤': 'ä', 'Ã¤': 'ä', 'ÃƒÂ¶': 'ö', 'Ã¶': 'ö', 'ÃƒÂ¼': 'ü', 'Ã¼': 'ü',
            'Ãƒâ€ž': 'Ä', 'Ã„': 'Ä', 'Ãƒâ€“': 'Ö', 'Ã–': 'Ö', 'ÃƒÅ“': 'Ü', 'Ãœ': 'Ü', 'Â ': ' ', 'Â': ''
        }));
        for (const [from, to] of hardMap) if (text.includes(from)) text = text.split(from).join(to);
        return text;
    };

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
        assistOpen: false,
    };

    const safe = fn => {
        try { return fn(); } catch (e) { return undefined; }
    };

    const replaceBrand = value => {
        if (!value || typeof value !== 'string') return value;
        let next = repairMojibake(value);
        for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
            if (next.includes(from)) next = next.split(from).join(to);
        }
        next = repairMojibake(next);
        for (const [pattern, replacement] of TEXT_REPLACEMENTS) next = next.replace(pattern, replacement);
        next = repairMojibake(next);
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


    const patchMojibakeTextNode = node => {
        if (!node || node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
        if (skipElement(node.parentElement)) return;
        const before = node.nodeValue;
        const after = repairMojibake(before);
        if (after !== before) node.nodeValue = after;
    };

    const patchMojibakeTextNodes = root => safe(() => {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            patchMojibakeTextNode(root);
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
        while ((node = walker.nextNode())) patchMojibakeTextNode(node);
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


    const releaseNotificationControls = () => safe(() => {
        // v37: notification/snackbar close buttons belong to the native Admin UI.
        // They must never be disabled or covered by EOS security/layout layers.
        document.querySelectorAll('.MuiSnackbar-root, .MuiAlert-root, .MuiSnackbarContent-root, [role="alert"], .Toastify__toast, .notistack-Snackbar').forEach(box => {
            box.classList.add('eos-notification-safe');
            box.style.pointerEvents = 'auto';
            box.querySelectorAll('button, [role="button"], a, .MuiIconButton-root, svg').forEach(control => {
                control.classList.remove('eos-protected-delete-control', 'eos-security-hidden-delete');
                control.removeAttribute('disabled');
                control.removeAttribute('aria-disabled');
                if ('disabled' in control) control.disabled = false;
                control.style.pointerEvents = 'auto';
                control.style.display = '';
                control.style.visibility = '';
                control.style.opacity = '';
            });
        });
    });

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
        const securityNeedles = /(nexowatt\s+sicherheit|eos\s+security|eos\s+systemschutz|legacy\s+admin|alter\s+admin|gesch(?:u|ü)tzte\s+(system)?adapter|administratorgruppen|protected\s+adapters|admin\s+groups)/i;
        const markAdminOnly = el => {
            if (!el || isAdminUser()) return;
            el.dataset.eosSecurityAdminOnly = 'true';
            el.classList.add('eos-security-admin-only-field');
            el.setAttribute('aria-hidden', 'true');
        };
        if (isAdminUser()) {
            document.querySelectorAll('[data-eos-security-admin-only="true"], .eos-security-admin-only-field').forEach(el => {
                el.removeAttribute('data-eos-security-admin-only');
                el.classList.remove('eos-security-admin-only-field');
                el.removeAttribute('aria-hidden');
            });
            return;
        }
        Array.from(document.querySelectorAll('[role="tab"], .MuiTab-root, button, [role="button"]')).forEach(tab => {
            if (!securityNeedles.test(textOfElement(tab))) return;
            const inDialog = !!tab.closest('.MuiDialog-paper, [role="dialog"]');
            if (inDialog) markAdminOnly(tab);
        });
        Array.from(document.querySelectorAll('.MuiDialog-paper, [role="dialog"]')).forEach(dialog => {
            const dialogText = textOfElement(dialog);
            if (!securityNeedles.test(dialogText)) return;
            dialog.classList.add('eos-security-settings-restricted');
            Array.from(dialog.querySelectorAll('label, legend, h2, h3, h4, .MuiTypography-root, .MuiFormLabel-root, .MuiTab-root, [role="tab"], .MuiGrid-root, .MuiGrid2-root, .MuiFormControl-root')).forEach(el => {
                if (!securityNeedles.test(textOfElement(el))) return;
                const row = el.closest('.MuiGrid2-root, .MuiGrid-root, .MuiFormControl-root, .MuiBox-root, .MuiPaper-root, [role="tabpanel"]') || el.parentElement;
                if (row && row !== dialog) markAdminOnly(row);
                markAdminOnly(el);
            });
            if (!dialog.querySelector('.eos-security-restricted-note')) {
                const note = document.createElement('div');
                note.className = 'eos-security-restricted-note';
                note.innerHTML = '<strong>EOS Systemschutz</strong><span>Dieser Bereich ist nur für Administratoren sichtbar. Geschützte Adapter und der alte Admin werden zentral durch NexoWatt EOS verwaltet.</span>';
                const content = dialog.querySelector('.MuiDialogContent-root') || dialog;
                content.insertBefore(note, content.firstElementChild || null);
            }
        });
    };

    const applySecurityUiGuard = () => safe(() => {
        const policy = state.securityPolicy;
        applySecurityClasses();
        releaseNotificationControls();
        // Do not apply EOS security decoration inside native adapter configuration pages.
        // Adapter UIs must remain 100% functional; backend/role checks still protect EOS actions.
        if (isAdapterConfigSurface()) return;
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
        const pathname = window.location.pathname || '';
        const badPath = /(?:%2f%23|%252f%2523|\/login|\/logout|\/404(?:\.html)?)/i.test(pathname)
            || /(?:^|[?&])(?:hard|origin)=/i.test(window.location.search || '');
        if (!badPath) return;
        const clean = new URL(ASSET_BASE);
        clean.hash = window.location.hash && !/%23|hard=|login/i.test(window.location.hash) ? window.location.hash : '#/tab-intro';
        if (document.getElementById('app-paper')) {
            window.history.replaceState(null, document.title, `${clean.pathname}${clean.search}${clean.hash}`);
        } else if (/(?:%2f%23|%252f%2523)/i.test(pathname)) {
            window.location.replace(`${clean.pathname}${clean.search}#/tab-intro`);
        }
    });

    const setRouteClasses = () => {
        const routes = routeInfo();
        document.documentElement.classList.toggle('eos-route-users', routes.users);
        document.documentElement.classList.toggle('eos-route-adapters', routes.adapters);
        document.documentElement.classList.toggle('eos-route-instances', routes.instances);
        document.documentElement.classList.toggle('eos-route-intro', routes.intro);
    };


    const isAdapterConfigSurface = () => document.documentElement.classList.contains('eos-adapter-config-surface');

    const markAdapterConfigSurface = () => safe(() => {
        const app = document.querySelector('#app-paper') || document.body;
        const text = textOfElement(app).slice(0, 3500);
        const isConfig = /Instanzeinstellungen:|Instance settings:|Gerät hinzufügen|Gerät bearbeiten|Geräteliste|Adapterkonfiguration|json exportieren|json importieren|Speichern und schließen|Save and close/i.test(text);
        document.documentElement.classList.toggle('eos-adapter-config-surface', !!isConfig);
        if (!isConfig) return;

        // Native adapter configuration UIs are owned by the adapter. EOS must never
        // block, rewrite or intercept their controls. This is critical for custom
        // React/HTML configuration pages such as nexowatt-devices.
        document.querySelectorAll('#app-paper button, #app-paper [role="button"], #app-paper a, #app-paper input, #app-paper select, #app-paper textarea, #app-paper [tabindex]').forEach(control => {
            if (control.closest('.eos-assist-root, #eos-assist-root, .eos-standalone-nav-toggle')) return;
            control.style.pointerEvents = 'auto';
            control.removeAttribute('aria-disabled');
        });
        document.querySelectorAll('#app-paper .eos-protected-delete-control, #app-paper .eos-security-hidden-delete, #app-paper .eos-protected-adapter-row').forEach(el => {
            el.classList.remove('eos-protected-delete-control', 'eos-security-hidden-delete', 'eos-protected-adapter-row');
            el.removeAttribute('aria-disabled');
            if (el.style) {
                el.style.pointerEvents = '';
                el.style.display = '';
                el.style.visibility = '';
                el.style.opacity = '';
            }
            if ('disabled' in el && !el.dataset.eosOriginalDisabled) el.disabled = false;
        });
    });

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


    let hardLogoutTimer = 0;
    let hardLogoutPollTimer = 0;
    let hardLogoutInstalled = false;

    const clearAuthStorage = () => safe(() => {
        const storageKeys = [
            'App.refreshToken', 'App.accessToken', 'App.token', 'tokens', 'iobroker.admin.token',
            'access_token', 'refresh_token', 'oidc_id_token', 'oidc_access_token', 'oidc_refresh_token'
        ];
        storageKeys.forEach(key => {
            window.localStorage?.removeItem(key);
            window.sessionStorage?.removeItem(key);
            window._localStorage?.removeItem?.(key);
        });
        ['access_token', 'refresh_token', 'connect.sid', 'io', 'sid'].forEach(name => {
            document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
            document.cookie = `${name}=; Max-Age=0; path=${new URL(ASSET_BASE).pathname || '/'}; SameSite=Lax`;
        });
    });

    const hardLogout = () => {
        clearAuthStorage();
        const logoutUrl = new URL('logout', window.location.origin + '/');
        logoutUrl.searchParams.set('hard', '1');
        logoutUrl.searchParams.set('ts', String(Date.now()));
        window.location.replace(logoutUrl.href);
    };

    const scheduleHardLogoutCheck = delay => {
        if (hardLogoutPollTimer) window.clearTimeout(hardLogoutPollTimer);
        hardLogoutPollTimer = window.setTimeout(checkHardLogoutSession, Math.max(1000, delay || 15000));
    };

    async function checkHardLogoutSession() {
        if (isLoginView() || !document.getElementById('app-paper')) {
            scheduleHardLogoutCheck(10000);
            return;
        }
        try {
            const response = await fetch(new URL('session', ASSET_BASE).href, {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { accept: 'application/json' },
            });
            const data = await response.json().catch(() => ({}));
            const expireInSec = Number(data?.expireInSec);
            if (Number.isFinite(expireInSec) && expireInSec <= 0) {
                hardLogout();
                return;
            }
            if (Number.isFinite(expireInSec) && expireInSec > 0) {
                if (hardLogoutTimer) window.clearTimeout(hardLogoutTimer);
                hardLogoutTimer = window.setTimeout(hardLogout, Math.max(1200, expireInSec * 1000 + 500));
                scheduleHardLogoutCheck(Math.min(Math.max(5000, expireInSec * 500), 30000));
                return;
            }
        } catch (_) {
            // Network reconnects happen during updates/restarts. Do not log out on a transient request failure.
        }
        scheduleHardLogoutCheck(30000);
    }

    const installHardLogoutWatchdog = () => {
        // v36: disabled. Upstream ioBroker Admin session handling is used again so
        // the configured admin TTL is respected and native adapter config pages are
        // not interrupted by duplicate EOS timers.
        hardLogoutInstalled = true;
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

    const hideNativeLogoutNav = () => safe(() => {
        const candidates = Array.from(document.querySelectorAll('.MuiDrawer-paper a, .MuiDrawer-paper button, .MuiDrawer-paper li, .MuiDrawer-paper .MuiListItem-root, .MuiDrawer-paper .MuiListItemButton-root, .MuiDrawer-paper [role="button"], nav a, nav button, nav li, nav [role="button"]'));
        candidates.forEach(el => {
            const text = normalize(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''} ${el.getAttribute?.('title') || ''}`);
            const href = String(el.getAttribute?.('href') || '');
            const isLogout = /(?:^|\b)(abmelden|logout|ra_logout)(?:\b|$)/.test(text) || /(?:^|[/?#])logout(?:[/?#]|$)/i.test(href);
            if (!isLogout) return;
            const targets = new Set([
                el,
                el.closest('.MuiListItem-root'),
                el.closest('li'),
                el.closest('.MuiListItemButton-root'),
                el.closest('.MuiButtonBase-root'),
                el.closest('a, button, [role="button"]'),
            ].filter(Boolean));
            targets.forEach(item => {
                item.classList.add('eos-hidden-logout', 'eos-native-logout-hidden');
                item.setAttribute('aria-hidden', 'true');
                item.setAttribute('tabindex', '-1');
                if (item.style) {
                    item.style.display = 'none';
                    item.style.visibility = 'hidden';
                    item.style.pointerEvents = 'none';
                }
            });
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
            header.classList.add('eos-native-drawer-header', 'eos-nav-toggle-shell');
            const toggleButton = header.querySelector('button, .MuiIconButton-root, [role="button"]');
            if (toggleButton && !toggleButton.dataset.eosNavCompactToggle) {
                toggleButton.dataset.eosNavCompactToggle = 'true';
                toggleButton.classList.add('eos-nav-compact-toggle');
                toggleButton.setAttribute('title', 'Navigation kompakt/normal umschalten');
                toggleButton.setAttribute('aria-label', 'Navigation kompakt/normal umschalten');
                const toggleCompact = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                    const compact = !document.documentElement.classList.contains('eos-nav-compact');
                    document.documentElement.classList.toggle('eos-nav-compact', compact);
                    safe(() => localStorage.setItem('nexowatt:eosNavCompact', compact ? '1' : '0'));
                    toggleButton.setAttribute('aria-pressed', compact ? 'true' : 'false');
                };
                toggleButton.addEventListener('click', toggleCompact, true);
                toggleButton.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') toggleCompact(event);
                }, true);
            }
            header.querySelectorAll('a,img,.MuiAvatar-root,.MuiAvatar-img,.eos-native-title').forEach(el => {
                if (!el.closest?.('button')) el.classList.add('eos-nav-toggle-decor-hidden');
            });
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
        patchNotifications();
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


    

    const ensureNotificationDialogClasses = () => safe(() => {
        document.querySelectorAll('.MuiDialog-root, .MuiModal-root, [role="presentation"]').forEach(root => {
            const paper = root.querySelector?.('.MuiDialog-paper, [role="dialog"]');
            if (!paper) return;
            const txt = normalize(paper.textContent || '');
            if (!/(benachrichtigungen|notifications|acknowledge|bestätigen|schließen|close)/i.test(txt) && !paper.querySelector('#notifications-dialog-close')) return;
            root.classList.add('eos-notification-dialog-root');
            paper.classList.add('eos-notification-dialog');
            paper.querySelectorAll('button, [role="button"], a, .MuiButtonBase-root, .MuiIconButton-root').forEach(control => {
                control.style.pointerEvents = 'auto';
                control.style.userSelect = 'auto';
                if (control.getAttribute('aria-disabled') === 'true' && /schließen|close/i.test(control.textContent || control.getAttribute('aria-label') || control.getAttribute('title') || '')) {
                    control.removeAttribute('aria-disabled');
                }
            });
        });
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




    const patchNotifications = () => safe(() => {
        const selectors = [
            '.MuiSnackbar-root', '.SnackbarItem-root', '.SnackbarItem-wrappedRoot', '.notistack-Snackbar',
            '.Toastify__toast-container', '.Toastify__toast', '.MuiAlert-root', '[role="alert"]'
        ];
        document.querySelectorAll(selectors.join(',')).forEach(node => {
            node.classList.add('eos-notification-surface');
            if (node.style) {
                node.style.pointerEvents = 'auto';
                if (!node.closest('.MuiDialog-root')) node.style.zIndex = '5200';
            }
            node.querySelectorAll('button,[role="button"],a').forEach(control => {
                control.classList.add('eos-notification-action');
                control.style.pointerEvents = 'auto';
                control.style.visibility = 'visible';
                control.style.opacity = '1';
            });
        });
    });

    const applyNavCompactPreference = () => safe(() => {
        const compact = localStorage.getItem('nexowatt:eosNavCompact') === '1';
        document.documentElement.classList.toggle('eos-nav-compact', compact);
        document.querySelectorAll('.eos-nav-compact-toggle').forEach(button => {
            button.setAttribute('aria-pressed', compact ? 'true' : 'false');
            button.setAttribute('title', compact ? 'Navigation normal anzeigen' : 'Navigation kompakt anzeigen');
        });
    });

    const assistContext = () => {
        const routes = routeInfo();
        if (routes.adapters) return {
            title: 'Module einrichten',
            text: 'Wähle zuerst das passende Modul, prüfe Version und Instanzstatus und öffne dann die Konfiguration über die drei Punkte oder das Werkzeug-Symbol.',
            steps: ['Modul suchen', 'Instanz anlegen', 'Verbindung testen', 'Datenpunkte prüfen']
        };
        if (routes.instances) return {
            title: 'Dienste prüfen',
            text: 'Kontrolliere Status, Port, Speicherverbrauch und Logmeldungen. Gestoppte Dienste erst nach Ursache und Abhängigkeiten prüfen.',
            steps: ['Status ansehen', 'Log öffnen', 'Konfiguration prüfen', 'Dienst neu starten']
        };
        if (routes.users) return {
            title: 'Zugänge & Rechte',
            text: 'Installateure und Endkunden sollten nur die Module sehen, die sie wirklich bedienen dürfen. Geschützte EOS-Module bleiben Administratoren vorbehalten.',
            steps: ['Benutzer wählen', 'Rolle zuordnen', 'Rechteprofil setzen', 'Löschschutz prüfen']
        };
        if (routeInfo().intro) return {
            title: 'EOS Cockpit',
            text: 'Beginne mit Systemstatus, Hosts und gesicherten Basisdiensten. Danach Module Schritt für Schritt freischalten.',
            steps: ['System prüfen', 'Sicherung prüfen', 'Module planen', 'Rechte vergeben']
        };
        return {
            title: 'EOS Bedienhilfe',
            text: 'Ich unterstütze dich beim Einrichten, Prüfen und Absichern deiner EOS-Module.',
            steps: ['Ziel beschreiben', 'Modul auswählen', 'Parameter prüfen', 'Test starten']
        };
    };

    const configuredAssistEndpoint = () => safe(() => {
        const globalEndpoint = typeof window.NEXOWATT_EOS_ASSIST_ENDPOINT === 'string' ? window.NEXOWATT_EOS_ASSIST_ENDPOINT.trim() : '';
        const storedEndpoint = localStorage.getItem('nexowatt:eosAssistEndpoint') || '';
        return globalEndpoint || storedEndpoint.trim();
    }) || '';

    const localAssistAnswer = query => {
        const q = normalize(query);
        if (!q) return 'Beschreibe kurz, was eingerichtet werden soll, zum Beispiel: Wallbox, PV, Speicher, Modbus, MQTT, Sicherung oder Benutzerrechte. EOS Assist zeigt mehrere Integrationswege und nicht nur einen einzelnen Adapter.';
        if (/wallbox|evcs|lade|auto|ocpp|ladestation|charge/.test(q)) return [
            'Wallbox / Ladepunkt: Es gibt mehrere mögliche Integrationswege. Empfehlung nach Priorität prüfen:',
            '1. Herstelleradapter: nutzen, wenn ein stabiler Adapter für Hersteller/Modell vorhanden ist.',
            '2. Modbus TCP/RTU: bevorzugt für lokale EMS-Werte wie Leistung, Strom, Freigabe, Zählerstand und Phasen.',
            '3. OCPP: passend, wenn die Wallbox als Ladepunkt-Backend angebunden werden soll oder mehrere Ladepunkte zentral verwaltet werden.',
            '4. HTTP/REST oder MQTT: sinnvoll bei offenen APIs, eigener Firmware oder Gateway-Lösungen.',
            '5. Datenpunkt-Mapping: Fallback, wenn Werte bereits aus einem anderen System kommen.',
            'Nächster Schritt: Hersteller, Modell, IP-Adresse und verfügbare Schnittstellen nennen. Dann kann EOS Assist den besten Weg vorschlagen.'
        ].join('\n');
        if (/keba|kecontact|mennekes|abl|alfen|easee|heidelberg|go-?e|openwb|zaptec|wallbe|duosida/.test(q)) return [
            'Wallbox-Hersteller erkannt. Bitte nicht automatisch nur OCPP verwenden.',
            'Prüfe zuerst: gibt es einen nativen Adapter oder eine lokale Modbus-/HTTP-Schnittstelle?',
            'OCPP ist gut für Backend-/Ladepunktverwaltung; Modbus/HTTP ist oft besser für lokale EMS-Regelung und schnelle Leistungswerte.',
            'Für EOS empfehle ich: lokale Schnittstelle für Regelung + OCPP nur, wenn Backend-Funktionen gebraucht werden.'
        ].join('\n');
        if (/pv|solar|wechselrichter|sun2000|fronius|kostal|sma|huawei|growatt|sungrow/.test(q)) return 'PV/Wechselrichter: Herstelleradapter oder Modbus TCP prüfen. Für EOS sind Erzeugung, Bezug, Einspeisung, Batterieladeleistung und Statusdaten wichtig. Erst Livewerte validieren, dann Optimierung aktivieren.';
        if (/speicher|batterie|akku|soc/.test(q)) return 'Speicher: SoC, Lade-/Entladeleistung, Betriebsmodus und Grenzwerte prüfen. Schreibbefehle erst freigeben, wenn Lese-Datenpunkte stabil und plausibel sind.';
        if (/modbus/.test(q)) return 'Modbus: IP/Port 502, Unit-ID, Registerliste, Datentyp und Byte-Reihenfolge prüfen. Erst nur lesen testen, danach Schreibrechte gezielt und mit Schutzliste freischalten.';
        if (/mqtt/.test(q)) return 'MQTT: Broker, Authentifizierung, Topic-Struktur und TLS prüfen. Mit Test-Topic starten, dann produktive Topics in EOS-Datenpunkte mappen.';
        if (/backup|sicherung|restore|backitup/.test(q)) return 'Sicherung: BackItUp aktiv halten, Zielpfad/Cloud-Ziel testen, Test-Backup erstellen und Restore-Ablauf dokumentieren. BackItUp bleibt Systemadapter und sollte geschützt sein.';
        if (/rechte|benutzer|installateur|kunde|admin|sicherheit|security/.test(q)) return 'Rechte: Administratoren verwalten Systemschutz. Installateure dürfen konfigurieren, aber geschützte Systemadapter nicht löschen, stoppen oder kritisch ändern. Endkunden bekommen Bedien- und Leserechte.';
        if (/fehler|log|offline|404|timeout|startet nicht|server/.test(q)) return 'Fehlersuche: Systemlogs filtern, betroffene Instanz prüfen, letzte Änderung identifizieren, Dienst neu starten und danach Port, WebSocket, Repository und Paketversion kontrollieren.';
        return 'EOS Assist Empfehlung: Gerätetyp, Hersteller/Modell und verfügbare Schnittstellen nennen. Danach wird der beste Integrationsweg gewählt: nativer Adapter, Modbus, OCPP, HTTP/REST, MQTT oder Datenpunkt-Mapping.';
    };

    const requestRemoteAssist = async query => {
        const endpoint = configuredAssistEndpoint();
        if (!endpoint) return '';
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query, route: window.location.hash || '', ui: 'nexowatt-eos-admin' }),
            });
            if (!response.ok) return '';
            const data = await response.json().catch(() => ({}));
            return String(data.answer || data.text || data.message || '').trim();
        } catch { return ''; }
    };

    const assistAnswer = query => localAssistAnswer(query);

    const sendAssistQuestion = async (root, query) => {
        const out = root?.querySelector?.('.eos-assist-answer');
        if (!out) return;
        const endpoint = configuredAssistEndpoint();
        if (endpoint) out.textContent = 'EOS Assist fragt die KI an ...';
        const remote = endpoint ? await requestRemoteAssist(query) : '';
        out.textContent = remote || localAssistAnswer(query);
    };

    const ensureEosAssist = () => safe(() => {
        const hasApp = !!document.getElementById('app-paper');
        if (!hasApp || isLoginView()) {
            document.getElementById('eos-assist-root')?.remove();
            document.querySelectorAll('.eos-assist-launcher,.eos-assist-panel:not(#eos-assist-root .eos-assist-panel)').forEach(el => el.remove());
            return;
        }
        if (isAdapterConfigSurface()) {
            const existing = document.getElementById('eos-assist-root');
            if (existing) existing.classList.add('eos-assist-config-hidden');
            return;
        }

        let root = document.getElementById('eos-assist-root');
        if (!root) {
            root = document.createElement('section');
            root.id = 'eos-assist-root';
            root.className = 'eos-assist-root';
            root.innerHTML = `
                <button class="eos-assist-button" type="button" aria-expanded="false">
                    <span class="eos-assist-dot"></span><strong>EOS Assist</strong><small>KI-Hilfe</small>
                </button>
                <div class="eos-assist-panel" role="dialog" aria-label="EOS Assist Einrichtungshilfe">
                    <div class="eos-assist-head">
                        <span class="eos-assist-logo"><img src="${LOGO}" alt="NexoWatt EOS" /></span>
                        <div><strong class="eos-assist-title"></strong><span class="eos-assist-text"></span></div>
                        <button type="button" class="eos-assist-close" aria-label="EOS Assist schließen">×</button>
                    </div>
                    <div class="eos-assist-steps"></div>
                    <div class="eos-assist-actions">
                        <button type="button" data-question="Wallbox einrichten: Welche Wege gibt es?">Wallbox</button>
                        <button type="button" data-question="Wie richte ich dieses Modul ein?">Modul einrichten</button>
                        <button type="button" data-question="Wie prüfe ich Fehler in den Logs?">Fehler prüfen</button>
                        <button type="button" data-question="Welche Rechte braucht der Installateur?">Rechte erklären</button>
                        <button type="button" data-question="Was muss ich vor einem Update beachten?">Update-Check</button>
                    </div>
                    <label class="eos-assist-input-label">Was möchtest du einrichten?</label>
                    <div class="eos-assist-input-row"><input class="eos-assist-input" placeholder="z. B. Wallbox Keba Modbus, OCPP, PV, Rechte..." /><button type="button" class="eos-assist-send">Fragen</button></div>
                    <div class="eos-assist-answer"></div>
                    <div class="eos-assist-foot">EOS Assist nutzt eine lokale Entscheidungslogik und ist für eine echte NexoWatt-KI-Anbindung vorbereitet.</div>
                </div>
            `;
            document.body.appendChild(root);
        }

        root.classList.remove('eos-assist-config-hidden');
        const ctx = assistContext();
        const button = root.querySelector('.eos-assist-button');
        const input = root.querySelector('.eos-assist-input');
        const answer = root.querySelector('.eos-assist-answer');
        root.querySelector('.eos-assist-title').textContent = ctx.title;
        root.querySelector('.eos-assist-text').textContent = ctx.text;
        root.querySelector('.eos-assist-steps').innerHTML = ctx.steps.map(step => `<span>${step}</span>`).join('');
        if (answer && !answer.textContent) answer.textContent = assistAnswer('');
        root.classList.toggle('eos-assist-open', !!state.assistOpen);
        button?.setAttribute('aria-expanded', state.assistOpen ? 'true' : 'false');

        if (!root.dataset.eosAssistBound) {
            root.dataset.eosAssistBound = 'true';
            root.addEventListener('click', event => {
                const target = event.target?.closest?.('button');
                if (!target || !root.contains(target)) return;
                if (target.classList.contains('eos-assist-button')) {
                    event.preventDefault();
                    event.stopPropagation();
                    state.assistOpen = !state.assistOpen;
                    root.classList.toggle('eos-assist-open', state.assistOpen);
                    target.setAttribute('aria-expanded', state.assistOpen ? 'true' : 'false');
                    if (state.assistOpen) setTimeout(() => root.querySelector('.eos-assist-input')?.focus(), 50);
                    return;
                }
                if (target.classList.contains('eos-assist-close')) {
                    event.preventDefault();
                    state.assistOpen = false;
                    root.classList.remove('eos-assist-open');
                    root.querySelector('.eos-assist-button')?.setAttribute('aria-expanded', 'false');
                    return;
                }
                if (target.classList.contains('eos-assist-send')) {
                    event.preventDefault();
                    const value = root.querySelector('.eos-assist-input')?.value || '';
                    const out = root.querySelector('.eos-assist-answer');
                    sendAssistQuestion(root, value);
                    return;
                }
                if (target.hasAttribute('data-question')) {
                    event.preventDefault();
                    const question = target.getAttribute('data-question') || '';
                    const field = root.querySelector('.eos-assist-input');
                    if (field) field.value = question;
                    const out = root.querySelector('.eos-assist-answer');
                    sendAssistQuestion(root, question);
                }
            }, true);
            root.addEventListener('keydown', event => {
                if (event.key !== 'Enter' || !event.target?.classList?.contains('eos-assist-input')) return;
                const out = root.querySelector('.eos-assist-answer');
                sendAssistQuestion(root, event.target.value || '');
            }, true);
        }
    });



    const installAssistDelegatedClick = () => safe(() => {
        if (window.__NEXOWATT_EOS_ASSIST_BRANDING_CLICK__) return;
        window.__NEXOWATT_EOS_ASSIST_BRANDING_CLICK__ = true;
        document.addEventListener('click', event => {
            const target = event.target?.closest?.('.eos-assist-button,.eos-assist-close,.eos-assist-send');
            if (!target) return;
            const root = document.getElementById('eos-assist-root') || target.closest('.eos-assist-root');
            if (!root) return;
            const input = root.querySelector('.eos-assist-input');
            const answer = root.querySelector('.eos-assist-answer');
            if (target.matches('.eos-assist-button')) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                state.assistOpen = !root.classList.contains('eos-assist-open');
                root.classList.toggle('eos-assist-open', state.assistOpen);
                target.setAttribute('aria-expanded', state.assistOpen ? 'true' : 'false');
                if (state.assistOpen) setTimeout(() => input?.focus(), 40);
            } else if (target.matches('.eos-assist-close')) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                state.assistOpen = false;
                root.classList.remove('eos-assist-open');
                root.querySelector('.eos-assist-button')?.setAttribute('aria-expanded', 'false');
            } else if (target.matches('.eos-assist-send')) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                sendAssistQuestion(root, input?.value || '');
                state.assistOpen = true;
                root.classList.add('eos-assist-open');
            }
        }, true);
    });


    const ensureStandaloneNavToggle = () => safe(() => {
        const html = document.documentElement;
        if (!html.classList.contains('eos-app') || html.classList.contains('eos-login')) {
            document.getElementById('eos-standalone-nav-toggle')?.remove();
            return;
        }
        let button = document.getElementById('eos-standalone-nav-toggle');
        if (!button) {
            button = document.createElement('button');
            button.id = 'eos-standalone-nav-toggle';
            button.type = 'button';
            button.className = 'eos-standalone-nav-toggle';
            button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.8 5.4 8.2 12l6.6 6.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            const toggle = event => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                const compact = !document.documentElement.classList.contains('eos-nav-compact');
                document.documentElement.classList.toggle('eos-nav-compact', compact);
                safe(() => localStorage.setItem('nexowatt:eosNavCompact', compact ? '1' : '0'));
                button.setAttribute('aria-pressed', compact ? 'true' : 'false');
                button.setAttribute('title', compact ? 'Navigation normal anzeigen' : 'Navigation kompakt anzeigen');
                button.setAttribute('aria-label', compact ? 'Navigation normal anzeigen' : 'Navigation kompakt anzeigen');
            };
            button.addEventListener('click', toggle, true);
            button.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') toggle(event);
            }, true);
            document.body.appendChild(button);
        }
        const compact = document.documentElement.classList.contains('eos-nav-compact') || safe(() => localStorage.getItem('nexowatt:eosNavCompact') === '1');
        document.documentElement.classList.toggle('eos-nav-compact', !!compact);
        button.setAttribute('aria-pressed', compact ? 'true' : 'false');
        button.setAttribute('title', compact ? 'Navigation normal anzeigen' : 'Navigation kompakt anzeigen');
        button.setAttribute('aria-label', compact ? 'Navigation normal anzeigen' : 'Navigation kompakt anzeigen');
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
        markAdapterConfigSurface();
        applyNavCompactPreference();
        ensureStandaloneNavToggle();
        installAssistDelegatedClick();
        ensureEosAssist();
        installHardLogoutWatchdog();
        ensureRightsHelper();
        ensurePermissionPresets();
        ensureSettingsDialogClasses();
        ensureNotificationDialogClasses();
        hideNativeLogoutNav();
        hideOfficialNexoWattRepoWarning();
        patchNotifications();
        applySecurityUiGuard();
        if (isAdapterConfigSurface()) {
            // Adapter-owned configuration pages must not be rebranded or structurally patched.
            // We still repair broken UTF-8/mojibake text because jsonConfig labels can be
            // rendered through different legacy paths. This is text-only and does not touch
            // adapter controls, React state, events or attributes.
            patchMojibakeTextNodes(document.getElementById('app-paper'));
            ['.MuiAppBar-root', '.MuiDrawer-paper', 'nav', '.eos-brand-badge', '.eos-top-toolbar'].forEach(selector => {
                document.querySelectorAll(selector).forEach(scope => {
                    patchTextNodes(scope);
                    patchAttributes(scope);
                });
            });
        } else {
            patchTextNodes(document.body || document.documentElement);
            patchAttributes(document.body || document.documentElement);
        }
    };

    const scopePatch = () => {
        state.scopePatchScheduled = false;
        const scopes = Array.from(state.pendingScopes);
        state.pendingScopes.clear();
        normalizeBadAddressAfterLogin();
        patchLogin();
        patchShell();
        markAdapterConfigSurface();
        applyNavCompactPreference();
        ensureStandaloneNavToggle();
        installAssistDelegatedClick();
        ensureEosAssist();
        installHardLogoutWatchdog();
        ensureRightsHelper();
        ensurePermissionPresets();
        ensureSettingsDialogClasses();
        ensureNotificationDialogClasses();
        hideNativeLogoutNav();
        hideOfficialNexoWattRepoWarning();
        patchNotifications();
        applySecurityUiGuard();
        for (const scope of scopes.slice(0, 80)) {
            if (!scope || !scope.isConnected) continue;
            if (isAdapterConfigSurface() && (scope.id === 'app-paper' || scope.closest?.('#app-paper'))) {
                patchMojibakeTextNodes(scope);
                continue;
            }
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
                    if (isAdapterConfigSurface() && mutation.target?.parentElement?.closest?.('#app-paper')) patchMojibakeTextNode(mutation.target);
                    else patchTextNode(mutation.target);
                    continue;
                }
                if (mutation.type !== 'childList') continue;
                mutation.addedNodes.forEach(node => {
                    if (!node) return;
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (isAdapterConfigSurface() && node.parentElement?.closest?.('#app-paper')) patchMojibakeTextNode(node);
                        else patchTextNode(node);
                    } else if (node.nodeType === Node.ELEMENT_NODE) state.pendingScopes.add(node);
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


// v37 eos notification close compatibility: never let EOS overlays block native notification dialogs.
(() => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    document.addEventListener('click', event => {
        const target = event.target?.closest?.('button, [role="button"], a, .MuiButtonBase-root, .MuiIconButton-root');
        if (!target) return;
        const dialog = target.closest?.('.eos-notification-dialog, .MuiDialog-paper, [role="dialog"]');
        if (!dialog || !/benachrichtigungen|notifications|acknowledge|bestätigen|schließen|close/i.test(dialog.textContent || '')) return;
        const label = normalize(`${target.textContent || ''} ${target.getAttribute?.('aria-label') || ''} ${target.getAttribute?.('title') || ''}`);
        if (/schließen|close|bestätigen|acknowledge/i.test(label)) {
            target.style.pointerEvents = 'auto';
            // Do not prevent React handlers; only stop EOS-specific bubbling side effects.
            event.stopPropagation();
        }
    }, true);
})();
