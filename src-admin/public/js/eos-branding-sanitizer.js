(() => {
    'use strict';
    const VERSION = 'v93-visible-branding-publisher';
    const existing = window.NEXOWATT_EOS_BRANDING_SANITIZER;
    if (existing?.version === VERSION) return;
    existing?.destroy?.();
    const abort = new AbortController();
    let unsubscribe = null;
    const skip = new Set(['SCRIPT','STYLE','CODE','PRE','TEXTAREA','NOSCRIPT']);
    const rewrite = value => String(value || '')
        .replace(/\[\s*iobroker\.eos-admin@[^\]\r\n]+\]/gi, '[NexoWatt]')
        .replace(/\[\s*eos-admin@[^\]\r\n]+\]/gi, '[NexoWatt]')
        .replace(/ioBroker\.admin/gi, 'NexoWatt EOS Admin')
        .replace(/ioBroker\s*Admin/gi, 'NexoWatt EOS Admin')
        .replace(/ioBroker/gi, 'NexoWatt EOS');
    const rewriteElement = root => {
        if (!root) return;
        const start = root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
        if (!start || start.closest?.('script,style,code,pre,textarea,noscript')) return;
        const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let count = 0;
        let node = start;
        while (node && count++ < 12000) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (!skip.has(node.parentElement?.tagName || '')) {
                    const next = rewrite(node.nodeValue);
                    if (next !== node.nodeValue) node.nodeValue = next;
                }
            } else if (!skip.has(node.tagName)) {
                for (const attr of ['title','aria-label','alt','placeholder']) {
                    const value = node.getAttribute?.(attr);
                    if (value) {
                        const next = rewrite(value);
                        if (next !== value) node.setAttribute(attr, next);
                    }
                }
            }
            node = walker.nextNode();
        }
    };
    const apply = mutations => {
        document.title = 'NexoWatt EOS – Energy Operation System';
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.content = 'NexoWatt EOS – Energy Operation System';
        if (!mutations?.length) rewriteElement(document.body);
        else mutations.forEach(mutation => {
            if (mutation.type === 'characterData') rewriteElement(mutation.target);
            for (const node of mutation.addedNodes || []) rewriteElement(node);
        });
    };
    const connect = () => {
        const coordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
        if (!coordinator?.subscribe) return window.setTimeout(connect, 150);
        unsubscribe = coordinator.subscribe(mutations => apply(mutations));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { apply([]); connect(); }, { once: true, signal: abort.signal });
    else { apply([]); connect(); }
    window.NEXOWATT_EOS_BRANDING_SANITIZER = Object.freeze({ version: VERSION, refresh: () => apply([]), destroy() { unsubscribe?.(); abort.abort(); } });
})();
