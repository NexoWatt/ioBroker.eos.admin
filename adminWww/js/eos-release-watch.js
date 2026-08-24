(() => {
    'use strict';
    const RELEASE = '7.10.0';
    const RELEASE_KEY = 'nexowatt.eos.loadedRelease';
    const RELOAD_KEY = 'nexowatt.eos.reloadTarget';
    const CHECK_MS = 15000;
    let refreshing = false;

    const normalize = value => String(value || '').trim().replace(/^v/i, '');
    const validRelease = value => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalize(value));
    const reloadUrl = version => {
        const url = new URL(window.location.href);
        url.searchParams.set('_eosRelease', normalize(version) || RELEASE);
        url.searchParams.set('_eosReload', String(Date.now()));
        return url.toString();
    };
    const purgeBrowserCaches = async () => {
        const jobs = [];
        try {
            if ('caches' in window) {
                jobs.push(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))));
            }
        } catch (_) { /* Cache API is optional */ }
        try {
            if (navigator.serviceWorker?.getRegistrations) {
                jobs.push(navigator.serviceWorker.getRegistrations().then(rows => Promise.all(rows.map(row => row.unregister()))));
            }
        } catch (_) { /* service workers may be unavailable */ }
        await Promise.allSettled(jobs);
    };
    const reloadFor = async version => {
        const target = normalize(version) || RELEASE;
        if (refreshing || sessionStorage.getItem(RELOAD_KEY) === target) return;
        refreshing = true;
        sessionStorage.setItem(RELOAD_KEY, target);
        document.documentElement.classList.add('eos-release-refreshing');
        await purgeBrowserCaches();
        window.location.replace(reloadUrl(target));
    };
    const checkServerVersion = async () => {
        try {
            const endpoint = new URL('./version', window.location.href);
            endpoint.searchParams.set('_eosTs', String(Date.now()));
            const response = await fetch(endpoint, {
                cache: 'no-store',
                credentials: 'same-origin',
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (!response.ok) return;
            const serverVersion = normalize(await response.text());
            if (validRelease(serverVersion) && serverVersion !== RELEASE) {
                await reloadFor(serverVersion);
            }
        } catch (_) { /* adapter restart or temporary network interruption */ }
    };

    window.NEXOWATT_EOS_RELEASE = RELEASE;
    const previous = normalize(localStorage.getItem(RELEASE_KEY));
    localStorage.setItem(RELEASE_KEY, RELEASE);
    const loadedFor = normalize(new URL(window.location.href).searchParams.get('_eosRelease'));
    if (previous && previous !== RELEASE && loadedFor !== RELEASE) {
        void reloadFor(RELEASE);
    } else {
        sessionStorage.removeItem(RELOAD_KEY);
    }

    window.addEventListener('focus', () => void checkServerVersion());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void checkServerVersion();
    });
    window.setInterval(() => void checkServerVersion(), CHECK_MS);
    window.NEXOWATT_EOS_RELEASE_WATCH = Object.freeze({
        release: RELEASE,
        check: checkServerVersion,
        purge: purgeBrowserCaches,
    });
})();
