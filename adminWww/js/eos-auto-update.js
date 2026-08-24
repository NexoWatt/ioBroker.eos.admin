(() => {
    'use strict';
    const VERSION = 'v7100-nexowatt-stable-auto-update';
    const ROOT_ID = 'eos-nexowatt-auto-update';
    const script = document.currentScript;
    const API = new URL('../nexowatt/updates/', script?.src || document.baseURI).href;
    let busy = false;
    let lastLoad = 0;
    let pollTimer = 0;

    const role = () => String(window.NEXOWATT_EOS_ACCESS_ROLE || 'admin').toLowerCase();
    const introActive = () => String(location.hash || '').replace(/^#\/?/, '').split(/[/?&]/)[0] === 'tab-intro';
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
    const formatTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '–';

    const ensureRoot = () => {
        if (role() !== 'admin' || !introActive()) { document.getElementById(ROOT_ID)?.remove(); return null; }
        let root = document.getElementById(ROOT_ID);
        if (root) return root;
        root = document.createElement('section');
        root.id = ROOT_ID;
        root.className = 'eos-nexowatt-auto-update';
        const hero = document.getElementById('eos-native-overview-hero');
        const ems = document.getElementById('eos-ems-overview-runtime');
        const parent = ems?.parentElement || hero?.parentElement || document.getElementById('app-paper');
        if (!parent) return null;
        if (ems) parent.insertBefore(root, ems); else if (hero?.nextSibling) parent.insertBefore(root, hero.nextSibling); else parent.append(root);
        return root;
    };

    const render = status => {
        const root = ensureRoot(); if (!root) return;
        const enabled = status?.enabled !== false;
        const managed = Array.isArray(status?.managedAdapters) ? status.managedAdapters : [];
        const error = String(status?.error || '');
        root.dataset.enabled = String(enabled);
        root.innerHTML = `<div class="eos-nau-copy"><span class="eos-nau-eyebrow">NexoWatt Stable</span><h2>Automatische Adapter-Updates</h2><p>${enabled ? 'Installierte NexoWatt-Adapter werden automatisch aktualisiert, sobald im erkannten Stable-Repository eine neuere stabile Version verfügbar ist.' : 'Automatische NexoWatt-Updates sind deaktiviert. Vorherige ioBroker-Update-Richtlinien wurden wiederhergestellt.'}</p><div class="eos-nau-meta"><span>Repository: <strong>${esc(status?.repository || 'wird erkannt')}</strong></span><span>Letzter Abgleich: <strong>${esc(formatTime(status?.lastSync))}</strong></span><span>Richtlinie: <strong>alle neueren Stable-Versionen</strong></span></div>${managed.length ? `<div class="eos-nau-adapters">${managed.map(name => `<span>${esc(name)}</span>`).join('')}</div>` : ''}${error ? `<div class="eos-nau-error">${esc(error)}</div>` : ''}</div><label class="eos-nau-switch"><input type="checkbox" ${enabled ? 'checked' : ''} ${busy ? 'disabled' : ''}><span class="eos-nau-track"><span class="eos-nau-thumb"></span></span><strong>${enabled ? 'Aktiv' : 'Deaktiviert'}</strong><small>jederzeit änderbar</small></label>`;
        root.querySelector('input')?.addEventListener('change', event => void save(Boolean(event.currentTarget.checked)));
    };

    const request = async (path, options = {}) => {
        const response = await fetch(new URL(path, API), { cache: 'no-store', credentials: 'same-origin', ...options });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    };
    const load = async (force = false) => {
        if (role() !== 'admin' || !introActive()) return;
        if (!force && Date.now() - lastLoad < 5000) return;
        lastLoad = Date.now();
        try { render(await request('status')); }
        catch (error) { render({ enabled: true, error: error?.message || error }); }
    };
    const save = async enabled => {
        if (busy) return;
        busy = true;
        try {
            render({ enabled });
            const status = await request('settings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NexoWatt-EOS-Auto-Update': '1' }, body: JSON.stringify({ enabled }) });
            render(status);
        } catch (error) {
            render({ enabled: !enabled, error: error?.message || error });
        } finally { busy = false; }
    };

    let scheduled = false;
    const schedule = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; void load(); }); };
    const start = () => {
        void load();
        window.addEventListener('hashchange', () => { lastLoad = 0; schedule(); });
        window.addEventListener('nexowatt-eos-admin-socket-ready', schedule);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(); });
        new MutationObserver(() => { if (!document.getElementById(ROOT_ID) && introActive()) schedule(); }).observe(document.documentElement, { childList: true, subtree: true });
        pollTimer = window.setInterval(() => void load(true), 30000);
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start, { once: true }) : start();
    window.NEXOWATT_EOS_AUTO_UPDATE_UI = Object.freeze({ version: VERSION, refresh: load });
})();
