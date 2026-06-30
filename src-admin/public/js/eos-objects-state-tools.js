(() => {
    'use strict';

    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_VERSION = 'v42-force-version-delete-dp-fix';

    const ACTIVE_CLASS = 'eos-objects-surface';
    const safe = fn => { try { return fn(); } catch (e) { return undefined; } };

    const isObjectsRoute = () => {
        const hash = String(window.location.hash || '');
        if (/#tab-objects/.test(hash)) return true;
        const url = String(window.location.href || '');
        if (/[?&]tab=objects/.test(url)) return true;
        return false;
    };

    const setSurfaceState = () => {
        const active = isObjectsRoute();
        document.documentElement.classList.toggle(ACTIVE_CLASS, active);
        document.body?.classList.toggle(ACTIVE_CLASS, active);
        return active;
    };

    const interactiveSelector = [
        'button',
        '[role="button"]',
        'a[href]',
        'input',
        'select',
        'textarea',
        '.MuiButton-root',
        '.MuiIconButton-root',
        '.MuiCheckbox-root',
        '.MuiSwitch-root',
        '.MuiSwitch-switchBase',
        '.MuiMenuItem-root',
        '.MuiAutocomplete-option',
        '.MuiSelect-select',
        '.admin-button',
        '.copyButton'
    ].join(',');

    const nativeLayerSelector = [
        '.MuiDialog-root',
        '.MuiModal-root',
        '.MuiPopover-root',
        '.MuiPopper-root',
        '.MuiTooltip-popper',
        '[role="dialog"]',
        '[role="listbox"]',
        '[role="menu"]',
        '[role="tooltip"]'
    ].join(',');

    const releaseNativeControls = root => safe(() => {
        if (!setSurfaceState()) return;
        const base = root && root.nodeType ? root : document;
        const nodes = [];
        if (base.nodeType === Node.ELEMENT_NODE && base.matches?.(interactiveSelector)) nodes.push(base);
        nodes.push(...Array.from(base.querySelectorAll?.(interactiveSelector) || []));
        nodes.forEach(el => {
            if (!el || el.closest?.('#eos-assist-root,.eos-assist-root')) return;
            el.classList?.remove('eos-security-hidden-delete', 'eos-protected-delete-control', 'eos-disabled-by-security');
            el.removeAttribute?.('data-eos-security-blocked');
            el.removeAttribute?.('aria-disabled');
            el.style.pointerEvents = 'auto';
            if (el.style.visibility === 'hidden') el.style.visibility = 'visible';
            if (el.style.display === 'none' && !el.classList?.contains('eos-native-logout-hidden')) el.style.display = '';
        });
        const layers = [];
        if (base.nodeType === Node.ELEMENT_NODE && base.matches?.(nativeLayerSelector)) layers.push(base);
        layers.push(...Array.from(base.querySelectorAll?.(nativeLayerSelector) || []));
        layers.forEach(el => {
            if (!el) return;
            el.style.pointerEvents = 'auto';
        });
    });

    const formatAge = ts => {
        const n = Number(ts);
        if (!Number.isFinite(n) || n <= 0) return 'unbekannt';
        try { return new Date(n).toLocaleString(); } catch { return String(n); }
    };

    const annotateValueCells = root => safe(() => {
        if (!setSurfaceState()) return;
        const base = root && root.nodeType ? root : document;
        const cells = [];
        const valueCellSelector = '.eos-object-value-cell,[data-eos-object-value-cell],[title*="Wert schreiben"],[title*="Button sofort testen"]';
        if (base.nodeType === Node.ELEMENT_NODE && base.matches?.(valueCellSelector)) cells.push(base);
        cells.push(...Array.from(base.querySelectorAll?.(valueCellSelector) || []));
        cells.forEach(cell => {
            const id = cell.getAttribute('data-eos-object-value-cell') || cell.closest?.('[id]')?.getAttribute('id') || '';
            const title = cell.getAttribute('title') || '';
            const writable = cell.getAttribute('data-eos-object-writable') === '1' || /Wert schreiben|Button sofort testen/i.test(title);
            const visibleValue = (cell.textContent || '').trim().replace(/\s+/g, ' ') || '(leer)';
            cell.style.pointerEvents = 'auto';
            cell.style.cursor = writable ? 'pointer' : 'default';
            cell.classList.toggle('eos-object-value-writable', writable);
            cell.classList.toggle('eos-object-value-readonly', !writable);
            cell.classList.add('eos-object-value-cell');
            cell.setAttribute('data-eos-current-visible-value', visibleValue);
            const hint = writable
                ? 'Klicken: Wert schreiben / Button sofort testen'
                : 'Nur lesbarer Wert';
            cell.setAttribute('title', [
                id ? `ID: ${id}` : null,
                `Aktueller Wert: ${visibleValue}`,
                `Status: ${writable ? 'beschreibbar' : 'nur lesbar'}`,
                `Letzte Anzeige-Aktualisierung: ${formatAge(Date.now())}`,
                hint,
                'Zusätzliche Statusdetails zeigt der native EOS/ioBroker-Hover an.'
            ].filter(Boolean).join('\n'));
        });
    });

    const handlePointerAssist = event => {
        if (!setSurfaceState()) return;
        const cell = event.target?.closest?.('.eos-object-value-cell');
        if (!cell) return;
        if (cell.getAttribute('data-eos-object-writable') === '1') {
            cell.classList.add('eos-object-value-hover');
        }
    };
    const handlePointerLeave = event => {
        const cell = event.target?.closest?.('.eos-object-value-cell');
        cell?.classList.remove('eos-object-value-hover');
    };

    const run = root => {
        if (!setSurfaceState()) return;
        releaseNativeControls(root);
        annotateValueCells(root);
    };

    window.addEventListener('hashchange', () => setTimeout(() => run(document), 30));
    window.addEventListener('popstate', () => setTimeout(() => run(document), 30));
    document.addEventListener('mouseover', handlePointerAssist, true);
    document.addEventListener('mouseout', handlePointerLeave, true);
    document.addEventListener('click', event => {
        if (!setSurfaceState()) return;
        const nativeInteractive = event.target?.closest?.(interactiveSelector + ',' + nativeLayerSelector + ',.eos-object-value-cell');
        if (nativeInteractive) {
            // Intentionally do not stop propagation. This keeps the native ObjectBrowser write dialog and button states working.
            releaseNativeControls(nativeInteractive);
            window.setTimeout(() => releaseNativeControls(document), 50);
            window.setTimeout(() => annotateValueCells(document), 120);
        }
    }, false);

    const observer = new MutationObserver(records => {
        if (!setSurfaceState()) return;
        let roots = [];
        for (const rec of records) {
            rec.addedNodes?.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) roots.push(node);
            });
        }
        if (!roots.length) roots = [document];
        window.requestAnimationFrame?.(() => roots.forEach(run)) || roots.forEach(run);
    });

    const start = () => {
        setSurfaceState();
        run(document);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        window.setInterval(() => run(document), 2500);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
