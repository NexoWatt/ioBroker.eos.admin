(() => {
    'use strict';

    if (window.NEXOWATT_EOS_PERFORMANCE_GUARD_VERSION) return;
    window.NEXOWATT_EOS_PERFORMANCE_GUARD_VERSION = 'v52-fast-ui';

    const filteredConsole = (method, matcher) => {
        const original = console[method]?.bind(console);
        if (!original || original.__eosPerformanceGuard) return;
        const wrapped = (...args) => {
            const first = String(args[0] ?? '');
            if (matcher(first)) return;
            return original(...args);
        };
        wrapped.__eosPerformanceGuard = true;
        console[method] = wrapped;
    };

    filteredConsole('log', first => /^Translate:\s+/.test(first));
    filteredConsole('warn', first => /^Please (?:add to|modify) "system\.adapter\./.test(first) && /common\.adminUI=/.test(first));

    const disableI18nWarnings = () => {
        try {
            if (typeof window.i18nDisableWarning === 'function') window.i18nDisableWarning(true);
        } catch (_) {
            // ignore
        }
    };

    disableI18nWarnings();
    let tries = 0;
    const timer = window.setInterval(() => {
        tries += 1;
        disableI18nWarnings();
        if (tries >= 40 || typeof window.i18nDisableWarning === 'function') window.clearInterval(timer);
    }, 250);
})();
