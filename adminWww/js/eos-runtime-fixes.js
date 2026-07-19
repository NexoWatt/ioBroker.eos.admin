(() => {
    'use strict';

    window.NEXOWATT_EOS_RUNTIME_FIXES_VERSION = 'v62-adapter-filter-overlay-cleanup';

    const MOJIBAKE_MAP = new Map(Object.entries({
        'dÃ¼rfen': 'dürfen', 'DÃ¼rfen': 'Dürfen',
        'fÃ¼r': 'für', 'FÃ¼r': 'Für',
        'mÃ¼ssen': 'müssen', 'MÃ¼ssen': 'Müssen',
        'kÃ¶nnen': 'können', 'KÃ¶nnen': 'Können',
        'mÃ¶glich': 'möglich', 'MÃ¶glich': 'Möglich',
        'LÃ¶schen': 'Löschen', 'lÃ¶schen': 'löschen',
        'schÃ¼tzen': 'schützen', 'SchÃ¼tzen': 'Schützen',
        'SchÃ¼tzt': 'Schützt', 'schÃ¼tzt': 'schützt',
        'GeschÃ¼tzte': 'Geschützte', 'geschÃ¼tzte': 'geschützte',
        'GeschÃ¼tzter': 'Geschützter', 'geschÃ¼tzter': 'geschützter',
        'geschÃ¼tzten': 'geschützten', 'GeschÃ¼tzten': 'Geschützten',
        'ausgewÃ¤hlte': 'ausgewählte', 'AusgewÃ¤hlte': 'Ausgewählte',
        'Ã¤ndern': 'ändern', 'Ã„ndern': 'Ändern',
        'Ã¼ber': 'über', 'Ãœber': 'Über',
        'WÃ¤hle': 'Wähle', 'wÃ¤hle': 'wähle',
        'Ã¶ffnen': 'öffnen', 'Ã–ffnen': 'Öffnen',
        'schlieÃŸen': 'schließen', 'SchlieÃŸen': 'Schließen',
        'GerÃ¤t': 'Gerät', 'gerÃ¤t': 'gerät',
        'GerÃ¤te': 'Geräte', 'gerÃ¤te': 'geräte',
        'ZugÃ¤nge': 'Zugänge', 'zugÃ¤nge': 'zugänge',
        'SicherheitsgrÃ¼nden': 'Sicherheitsgründen',
        'KompatibilitÃ¤tsgrÃ¼nden': 'Kompatibilitätsgründen',
        'Benachrichtigungen': 'Benachrichtigungen',
        'ÃŸ': 'ß', 'Ã„': 'Ä', 'Ã–': 'Ö', 'Ãœ': 'Ü', 'Ã¤': 'ä', 'Ã¶': 'ö', 'Ã¼': 'ü',
        'â€“': '–', 'â€”': '—', 'â€ž': '„', 'â€œ': '“', 'â€': '”', 'Â ': ' ', 'Â': ''
    }));

    const safe = fn => { try { return fn(); } catch { return undefined; } };
    const isHighLoadAdminSurface = () => /tab-(objects|adapter|adapters|instances|logs|host|hosts)\b/.test(String(window.location.hash || '').toLowerCase());
    const isInsideAppPaper = node => !!node?.closest?.('#app-paper, [role="grid"], .MuiDataGrid-root, .ReactVirtualized__Grid, .eos-object-value-cell');

    const repairText = value => {
        let text = String(value || '');
        if (!/[ÃÂâ]/.test(text)) return text;
        for (const [from, to] of MOJIBAKE_MAP) {
            if (text.includes(from)) text = text.split(from).join(to);
        }
        return text;
    };

    const skip = el => {
        const tag = el?.tagName;
        return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'PRE';
    };

    const repairSecurityText = root => safe(() => {
        const base = root && root.nodeType ? root : document.body || document.documentElement;
        if (!base) return;
        const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                return skip(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
        });
        let node;
        while ((node = walker.nextNode())) {
            const before = node.nodeValue || '';
            const after = repairText(before);
            if (after !== before) node.nodeValue = after;
        }
        const attrSelector = '[title],[aria-label],[placeholder],[value]';
        const elements = base.nodeType === Node.ELEMENT_NODE && base.matches?.(attrSelector)
            ? [base]
            : Array.from(base.querySelectorAll?.(attrSelector) || []);
        elements.forEach(el => {
            if (skip(el)) return;
            ['title', 'aria-label', 'placeholder', 'value'].forEach(attr => {
                if (!el.hasAttribute?.(attr)) return;
                const before = el.getAttribute(attr) || '';
                const after = repairText(before);
                if (after !== before) el.setAttribute(attr, after);
            });
        });
    });

    const isNotificationSurface = el => !!el?.closest?.([
        '.MuiSnackbar-root',
        '.SnackbarItem-root',
        '.SnackbarItem-wrappedRoot',
        '.notistack-Snackbar',
        '.Toastify__toast',
        '.eos-notification-safe'
    ].join(','));

    const isCloseControl = el => {
        const label = `${el?.textContent || ''} ${el?.getAttribute?.('aria-label') || ''} ${el?.getAttribute?.('title') || ''}`.toLowerCase();
        return /close|schlie(?:ß|ss)en|dismiss|ausblenden|ok|verstanden|x$/.test(label)
            || !!el?.querySelector?.('svg[data-testid*="Close"], svg[data-testid*="Clear"], .material-icons');
    };

    const restoreCloseButton = button => safe(() => {
        if (!button || !isCloseControl(button)) return;
        button.classList.remove('eos-protected-delete-control', 'eos-security-hidden-delete', 'eos-hidden-logout', 'eos-native-logout-hidden');
        button.removeAttribute('aria-disabled');
        button.removeAttribute('data-eos-security-blocked');
        if ('disabled' in button && button.disabled && !button.dataset.eosOriginalDisabled) button.disabled = false;
        button.style.pointerEvents = 'auto';
        button.style.visibility = 'visible';
        button.style.opacity = '1';
        if (button.style.display === 'none') button.style.display = '';
    });

    const repairNotifications = root => safe(() => {
        const base = root && root.nodeType ? root : document;
        const surfaces = Array.from(base.querySelectorAll?.([
            '.MuiSnackbar-root',
            '.SnackbarItem-root',
            '.SnackbarItem-wrappedRoot',
            '.notistack-Snackbar',
            '.Toastify__toast'
        ].join(',')) || []);
        if (base.nodeType === Node.ELEMENT_NODE && isNotificationSurface(base)) surfaces.push(base);
        surfaces.forEach(surface => {
            surface.classList.add('eos-notification-safe');
            surface.style.pointerEvents = 'auto';
            surface.querySelectorAll('button,[role="button"],a,.MuiIconButton-root').forEach(restoreCloseButton);
        });
    });

    const run = root => {
        if (!isHighLoadAdminSurface() || !isInsideAppPaper(root?.nodeType === Node.TEXT_NODE ? root.parentElement : root)) repairSecurityText(root);
        repairNotifications(root);
    };

    const install = () => {
        run(document.body || document.documentElement);
        const observer = new MutationObserver(mutations => {
            const roots = new Set();
            for (const mutation of mutations) {
                if (mutation.type === 'characterData') roots.add(mutation.target.parentElement || document.body);
                mutation.addedNodes?.forEach(node => roots.add(node));
            }
            roots.forEach(root => run(root));
        });
        observer.observe(document.documentElement, { subtree: true, childList: true, characterData: false });
        [250, 1000, 3000, 8000].forEach(ms => window.setTimeout(() => run(document.body || document.documentElement), ms));
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
})();
