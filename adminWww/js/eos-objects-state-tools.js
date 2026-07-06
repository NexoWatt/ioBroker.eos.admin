(() => {
    'use strict';

    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_VERSION = 'v49-dp-write-performance-fix';

    const ACTIVE_CLASS = 'eos-objects-surface';
    const safe = fn => { try { return fn(); } catch (_) { return undefined; } };

    const isObjectsRoute = () => {
        const hash = String(window.location.hash || '');
        if (/#tab-objects/.test(hash)) return true;
        return /[?&]tab=objects/.test(String(window.location.href || ''));
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

    const valueCellSelector = [
        '.eos-object-value-cell',
        '[data-eos-object-value-cell]',
        '[title*="Wert schreiben"]',
        '[title*="Button sofort testen"]'
    ].join(',');

    const collect = (base, selector) => {
        const out = [];
        if (!base) return out;
        if (base.nodeType === Node.ELEMENT_NODE && base.matches?.(selector)) out.push(base);
        if (base.querySelectorAll) out.push(...Array.from(base.querySelectorAll(selector)));
        return out;
    };

    const releaseNativeControls = root => safe(() => {
        if (!setSurfaceState()) return;
        const base = root && root.nodeType ? root : document;
        collect(base, `${interactiveSelector},${nativeLayerSelector}`).forEach(el => {
            if (!el || el.closest?.('#eos-assist-root,.eos-assist-root')) return;
            el.classList?.remove('eos-security-hidden-delete', 'eos-protected-delete-control', 'eos-disabled-by-security');
            el.removeAttribute?.('data-eos-security-blocked');
            el.removeAttribute?.('aria-disabled');
            if (el.style?.pointerEvents === 'none') el.style.pointerEvents = 'auto';
            if (el.style?.visibility === 'hidden') el.style.visibility = 'visible';
            if (el.style?.display === 'none' && !el.classList?.contains('eos-native-logout-hidden')) el.style.display = '';
        });
    });

    const annotateValueCells = root => safe(() => {
        if (!setSurfaceState()) return;
        const base = root && root.nodeType ? root : document;
        collect(base, valueCellSelector).forEach(cell => {
            const id = cell.getAttribute('data-eos-object-value-cell') || cell.closest?.('[id]')?.getAttribute('id') || '';
            const nativeTitle = cell.getAttribute('title') || '';
            const writable = cell.getAttribute('data-eos-object-writable') === '1' || /Wert schreiben|Button sofort testen/i.test(nativeTitle);
            const visibleValue = (cell.textContent || '').trim().replace(/\s+/g, ' ') || '(leer)';
            const cache = `${id}|${writable ? 1 : 0}|${visibleValue}`;

            cell.style.pointerEvents = 'auto';
            cell.style.cursor = writable ? 'pointer' : 'default';
            cell.classList.add('eos-object-value-cell');
            cell.classList.toggle('eos-object-value-writable', writable);
            cell.classList.toggle('eos-object-value-readonly', !writable);

            if (cell.getAttribute('data-eos-value-cache') !== cache) {
                cell.setAttribute('data-eos-value-cache', cache);
                cell.setAttribute('data-eos-current-visible-value', visibleValue);
                const nextTitle = [
                    id ? `ID: ${id}` : null,
                    `Aktueller Wert: ${visibleValue}`,
                    `Status: ${writable ? 'beschreibbar' : 'nur lesbar'}`,
                    writable ? 'Klicken: Wert schreiben / Button sofort testen' : 'Nur lesbarer Wert'
                ].filter(Boolean).join('\n');
                if (cell.getAttribute('title') !== nextTitle) cell.setAttribute('title', nextTitle);
            }
        });
    });

    const run = root => {
        if (!setSurfaceState()) return;
        releaseNativeControls(root);
        annotateValueCells(root);
    };

    let scheduled = false;
    const pendingRoots = new Set();
    const schedule = root => {
        if (!setSurfaceState()) return;
        if (root) pendingRoots.add(root);
        if (scheduled) return;
        scheduled = true;
        const execute = () => {
            scheduled = false;
            const roots = pendingRoots.size ? Array.from(pendingRoots) : [document];
            pendingRoots.clear();
            roots.slice(0, 60).forEach(run);
        };
        if ('requestIdleCallback' in window) window.requestIdleCallback(execute, { timeout: 500 });
        else window.requestAnimationFrame(execute);
    };

    const handlePointerAssist = event => {
        if (!setSurfaceState()) return;
        const cell = event.target?.closest?.('.eos-object-value-cell');
        if (cell?.getAttribute('data-eos-object-writable') === '1') cell.classList.add('eos-object-value-hover');
    };

    const handlePointerLeave = event => {
        event.target?.closest?.('.eos-object-value-cell')?.classList.remove('eos-object-value-hover');
    };

    window.addEventListener('hashchange', () => window.setTimeout(() => schedule(document), 30));
    window.addEventListener('popstate', () => window.setTimeout(() => schedule(document), 30));
    document.addEventListener('mouseover', handlePointerAssist, true);
    document.addEventListener('mouseout', handlePointerLeave, true);
    document.addEventListener('click', event => {
        if (!setSurfaceState()) return;
        const nativeInteractive = event.target?.closest?.(`${interactiveSelector},${nativeLayerSelector},.eos-object-value-cell`);
        if (nativeInteractive) {
            // Keep native React/ObjectBrowser handlers untouched; only repair stale CSS/attributes after the click.
            releaseNativeControls(nativeInteractive);
            window.setTimeout(() => schedule(nativeInteractive), 80);
        }
    }, false);

    const observer = new MutationObserver(records => {
        if (!setSurfaceState()) return;
        for (const rec of records) {
            rec.addedNodes?.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) schedule(node);
            });
        }
    });

    const start = () => {
        setSurfaceState();
        schedule(document);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        // Low-frequency safety pass only; v45 scanned the complete page every 2.5s and hurt large object lists.
        window.setInterval(() => schedule(document), 15000);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
