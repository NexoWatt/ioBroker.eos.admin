(() => {
    'use strict';

    window.NEXOWATT_EOS_CONSOLE_QUIET_VERSION = 'v56-native-dp-click-tooltip-performance';

    const original = window.__NEXOWATT_EOS_CONSOLE_ORIGINAL__ || {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        debug: console.debug.bind(console),
        error: console.error.bind(console),
    };
    window.__NEXOWATT_EOS_CONSOLE_ORIGINAL__ = original;

    const normalizeArg = value => {
        try {
            if (typeof value === 'string') return value;
            if (value && typeof value.message === 'string') return value.message;
            return JSON.stringify(value);
        } catch (_) {
            return String(value);
        }
    };

    const noisy = args => {
        const text = Array.from(args || [])
            .map(normalizeArg)
            .join(' ')
            .replace(/%c/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        return /(?:^|\s)\[ADAPTERS\](?:\s|$)/.test(text)
            || /^Render because of /.test(text)
            || /^getInstances:\s*\d+/.test(text)
            || /^Translate:\s*/.test(text)
            || /^Stored version:\s*/.test(text)
            || /^Please (?:add to|modify) "system\.(?:adapter\.|host\.[^.]+\.adapter\.)/.test(text);
    };

    const install = () => {
        ['log', 'info', 'warn', 'debug'].forEach(level => {
            if (console[level]?.__nexowattQuietV56) return;
            const wrapped = (...args) => {
                if (noisy(args)) return;
                original[level](...args);
            };
            Object.defineProperty(wrapped, '__nexowattQuietV56', { value: true });
            console[level] = wrapped;
        });
    };

    install();
    queueMicrotask(install);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    window.addEventListener('load', install, { once: true });
    [50, 250, 750, 1500, 3500, 7000].forEach(ms => setTimeout(install, ms));

    window.NEXOWATT_EOS_RESTORE_CONSOLE = () => Object.assign(console, original);
})();
