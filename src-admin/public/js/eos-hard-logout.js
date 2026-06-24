(function () {
    'use strict';

    const LOG_PREFIX = '[NexoWatt EOS hard logout]';
    const VERSION = '35';
    const MIN_POLL_MS = 15_000;
    const MAX_TIMER_MS = 2_147_000_000;
    const MIN_TTL_SEC = 5;
    const STORAGE_KEY = `nexowatt:eos:hardLogoutAt:${location.host}:${location.pathname.split('/')[1] || 'root'}`;
    let logoutTimer = null;
    let pollTimer = null;
    let logoutStarted = false;

    function isLoginPage() {
        const path = String(window.location.pathname || '').toLowerCase();
        const search = String(window.location.search || '').toLowerCase();
        return path.endsWith('/login') || path.includes('/login/') || search.includes('login');
    }

    function clearStoredTokens() {
        const storages = [window.localStorage, window.sessionStorage, window._localStorage, window._sessionStorage]
            .filter(Boolean)
            .filter((storage, index, array) => array.indexOf(storage) === index);
        const tokenKeyPattern = /(access[_-]?token|refresh[_-]?token|token[_-]?expires|expires[_-]?in|oauth|bearer|auth|connection)/i;
        for (const storage of storages) {
            try {
                const keys = [];
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key && (tokenKeyPattern.test(key) || key === STORAGE_KEY)) {
                        keys.push(key);
                    }
                }
                keys.forEach(key => storage.removeItem(key));
            } catch (e) {
                // ignore blocked storage
            }
        }
    }

    function clearAuthCookies() {
        const cookieNames = ['access_token', 'refresh_token', 'connect.sid', 'ioBroker.sid'];
        const paths = ['/', window.location.pathname.replace(/\/[^/]*$/, '/') || '/'];
        for (const name of cookieNames) {
            for (const path of paths) {
                document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; SameSite=Lax`;
            }
        }
    }

    function readDeadline() {
        try {
            const value = Number(window.localStorage.getItem(STORAGE_KEY));
            return Number.isFinite(value) && value > 0 ? value : 0;
        } catch (e) {
            return 0;
        }
    }

    function writeDeadline(deadline) {
        try {
            window.localStorage.setItem(STORAGE_KEY, String(deadline));
        } catch (e) {
            // ignore blocked storage
        }
    }

    function hardLogout(reason) {
        if (logoutStarted || isLoginPage()) return;
        logoutStarted = true;
        try { console.warn(LOG_PREFIX, reason || 'session expired'); } catch (e) {}
        if (logoutTimer) {
            clearTimeout(logoutTimer);
            logoutTimer = null;
        }
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        clearStoredTokens();
        clearAuthCookies();
        const origin = encodeURIComponent((window.location.pathname || '/') + (window.location.search || '') + (window.location.hash || ''));
        window.location.href = './logout?origin=' + origin + '&hard=1';
    }

    function scheduleHardLogout(deadline) {
        const ms = Math.min(Math.max(deadline - Date.now() + 250, 250), MAX_TIMER_MS);
        if (logoutTimer) clearTimeout(logoutTimer);
        logoutTimer = setTimeout(() => hardLogout('configured login timeout reached'), ms);
    }

    function applyServerExpiration(expireInSec) {
        const seconds = Number(expireInSec);
        if (!Number.isFinite(seconds)) return;
        if (seconds <= 0) {
            hardLogout('server reported expired session');
            return;
        }
        if (seconds < MIN_TTL_SEC) return;

        const now = Date.now();
        const candidateDeadline = now + seconds * 1000;
        const storedDeadline = readDeadline();

        // Set the hard deadline once. If the server reports an earlier expiration later,
        // tighten the deadline. Never extend it through refresh-token based renewal.
        const deadline = !storedDeadline || candidateDeadline < storedDeadline - 5000 ? candidateDeadline : storedDeadline;
        if (deadline !== storedDeadline) writeDeadline(deadline);

        if (now >= deadline) {
            hardLogout('stored hard deadline reached');
        } else {
            scheduleHardLogout(deadline);
        }
    }

    async function checkSession() {
        if (logoutStarted) return;
        if (isLoginPage()) {
            clearStoredTokens();
            clearAuthCookies();
            return;
        }

        const storedDeadline = readDeadline();
        if (storedDeadline && Date.now() >= storedDeadline) {
            hardLogout('stored hard deadline reached');
            return;
        }

        try {
            const response = await fetch('./session?hard=1&ts=' + Date.now(), {
                credentials: 'include',
                cache: 'no-store',
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) return;
            const session = await response.json();
            if (typeof session.expireInSec === 'number') {
                applyServerExpiration(session.expireInSec);
            }
        } catch (e) {
            // During update/restart the endpoint can be unavailable. Do not logout just because of a network error.
        }
    }

    function start() {
        checkSession();
        pollTimer = setInterval(checkSession, MIN_POLL_MS);
        window.addEventListener('focus', checkSession, { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) checkSession();
        });
    }

    window.NEXOWATT_EOS_HARD_LOGOUT = { version: VERSION, checkSession, hardLogout, clearStoredTokens, clearAuthCookies };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
