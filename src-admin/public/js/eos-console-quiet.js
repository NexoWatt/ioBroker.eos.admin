(() => {
    'use strict';

    window.NEXOWATT_EOS_CONSOLE_QUIET_VERSION = 'v60-admin-stability-delete-version-fix';

    const original = window.__NEXOWATT_EOS_CONSOLE_ORIGINAL__ || {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        debug: console.debug.bind(console),
        error: console.error.bind(console),
    };
    window.__NEXOWATT_EOS_CONSOLE_ORIGINAL__ = original;

    const toText = args => {
        // v60: avoid JSON.stringify on large admin objects. The previous quiet filter
        // could itself become visible in Chrome as requestIdleCallback/message violations.
        const out = [];
        const list = Array.from(args || []).slice(0, 4);
        for (const value of list) {
            if (typeof value === 'string') out.push(value);
            else if (value && typeof value.message === 'string') out.push(value.message);
            else if (value && typeof value.name === 'string') out.push(value.name);
            else if (value != null && (typeof value === 'number' || typeof value === 'boolean')) out.push(String(value));
        }
        return out.join(' ').replace(/%c/g, '').replace(/\s+/g, ' ').trim();
    };

    const noisy = args => {
        const text = toText(args);
        if (!text) return false;
        return /(?:^|\s)\[ADAPTERS\](?:\s|$)/.test(text)
            || /Render because of /.test(text)
            || /getInstances:\s*\d+/.test(text)
            || /Translate:\s*/.test(text)
            || /Stored version:\s*/.test(text)
            || /Please (?:add to|modify) "system\.(?:adapter\.|host\.[^.]+\.adapter\.)/.test(text)
            || /Please (?:add to|modify) "system\.host\.[^.]+\.adapter\./.test(text);
    };

    const install = () => {
        ['log', 'info', 'warn', 'debug'].forEach(level => {
            if (console[level]?.__nexowattQuietV58) return;
            const wrapped = (...args) => {
                if (noisy(args)) return;
                original[level](...args);
            };
            Object.defineProperty(wrapped, '__nexowattQuietV58', { value: true });
            console[level] = wrapped;
        });
    };

    install();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        queueMicrotask(install);
    }
    window.addEventListener('load', install, { once: true });

    window.NEXOWATT_EOS_RESTORE_CONSOLE = () => Object.assign(console, original);
})();
