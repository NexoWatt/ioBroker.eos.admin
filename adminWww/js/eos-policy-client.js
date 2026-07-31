(() => {
    'use strict';

    const VERSION = 'v70-stability';
    const existing = window.NEXOWATT_EOS_POLICY_CLIENT;
    if (existing?.version === VERSION) return;
    existing?.destroy?.();

    const script = document.currentScript?.src || document.querySelector('script[src*="eos-policy-client.js"]')?.src || window.location.href;
    const base = new URL('../', script).href;
    const urls = [new URL('nexowatt/security/context', base).href];

    let policy = null;
    let status = 'idle';
    let attempt = 0;
    let timer = 0;
    let inFlight = null;
    let destroyed = false;
    const listeners = new Set();
    const abort = new AbortController();

    const emit = (kind = 'policy') => {
        const detail = { policy, status, attempt, kind };
        window.NEXOWATT_EOS_ROLE_POLICY = policy;
        window.NEXOWATT_EOS_SECURITY_POLICY = policy;
        window.dispatchEvent(new CustomEvent('nexowatt-eos-policy', { detail }));
        listeners.forEach(listener => {
            try { listener(policy, detail); } catch (_) { /* isolated subscriber */ }
        });
    };

    const clearRetry = () => {
        if (timer) window.clearTimeout(timer);
        timer = 0;
    };

    const scheduleRetry = () => {
        if (destroyed || timer) return;
        const delays = [1000, 2000, 4000, 8000, 15000, 30000];
        const delay = delays[Math.min(attempt, delays.length - 1)];
        timer = window.setTimeout(() => {
            timer = 0;
            void refresh();
        }, delay);
    };

    const requestOne = async url => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 4500);
        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data || data.error || !data.role || data.role === 'unknown') throw new Error('Incomplete policy');
            return data;
        } finally {
            window.clearTimeout(timeout);
        }
    };

    async function refresh() {
        if (destroyed) return null;
        if (inFlight) return inFlight;
        clearRetry();
        status = policy ? 'refreshing' : 'loading';
        emit('status');
        inFlight = (async () => {
            let lastError;
            for (const url of urls) {
                try {
                    const data = await requestOne(url);
                    policy = Object.freeze({ ...data });
                    status = 'ready';
                    attempt = 0;
                    emit('policy');
                    return policy;
                } catch (error) {
                    lastError = error;
                }
            }
            // Critical stability rule: never downgrade an admin to enduser because
            // the adapter/websocket is temporarily restarting. Keep last-good policy
            // in memory; otherwise stay unknown until the backend answers again.
            status = policy ? 'stale' : 'unknown';
            attempt += 1;
            emit('error');
            scheduleRetry();
            return null;
        })().finally(() => { inFlight = null; });
        return inFlight;
    }

    const api = {
        version: VERSION,
        getPolicy: () => policy,
        getStatus: () => status,
        refresh,
        subscribe(listener) {
            if (typeof listener !== 'function') return () => undefined;
            listeners.add(listener);
            if (policy) queueMicrotask(() => listener(policy, { policy, status, attempt, kind: 'initial' }));
            return () => listeners.delete(listener);
        },
        destroy() {
            destroyed = true;
            clearRetry();
            abort.abort();
            listeners.clear();
        },
    };
    window.NEXOWATT_EOS_POLICY_CLIENT = api;

    // One shared, throttled DOM observer for branding, role and security layers.
    // Multiple full-page observers were a major source of long tasks and sporadic clicks.
    const previousDomCoordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
    previousDomCoordinator?.destroy?.();
    const domListeners = new Set();
    let domObserver = null;
    let domScheduled = false;
    let domMutations = [];
    let domDestroyed = false;

    const flushDom = () => {
        domScheduled = false;
        if (domDestroyed) return;
        const batch = domMutations;
        domMutations = [];
        domListeners.forEach(listener => {
            try { listener(batch, { initial: false }); } catch (_) { /* isolated subscriber */ }
        });
    };

    const scheduleDom = () => {
        if (domScheduled || domDestroyed) return;
        domScheduled = true;
        if ('requestAnimationFrame' in window) window.requestAnimationFrame(flushDom);
        else window.setTimeout(flushDom, 16);
    };

    const startDomObserver = () => {
        if (domObserver || domDestroyed || !document.documentElement) return;
        domObserver = new MutationObserver(mutations => {
            // Bound the queue. Subscribers only need the newest scopes when a large
            // virtualized table updates hundreds of rows in one frame.
            if (domMutations.length + mutations.length > 600) domMutations = mutations.slice(-300);
            else domMutations.push(...mutations);
            scheduleDom();
        });
        domObserver.observe(document.documentElement, { childList: true, subtree: true });
    };

    window.NEXOWATT_EOS_DOM_COORDINATOR = {
        version: VERSION,
        subscribe(listener) {
            if (typeof listener !== 'function') return () => undefined;
            domListeners.add(listener);
            queueMicrotask(() => {
                if (!domDestroyed && domListeners.has(listener)) listener([], { initial: true });
            });
            return () => domListeners.delete(listener);
        },
        request: scheduleDom,
        destroy() {
            domDestroyed = true;
            domObserver?.disconnect();
            domObserver = null;
            domListeners.clear();
            domMutations = [];
        },
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDomObserver, { once: true });
    else startDomObserver();

    window.addEventListener('online', () => void refresh(), { signal: abort.signal });
    window.addEventListener('focus', () => {
        if (status !== 'ready') void refresh();
    }, { signal: abort.signal });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && status !== 'ready') void refresh();
    }, { signal: abort.signal });

    void refresh();
})();
