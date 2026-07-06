(() => {
    'use strict';

    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_VERSION = 'v52-fast-unrestricted-dp-write';

    const ACTIVE_CLASS = 'eos-objects-surface';
    const DIALOG_CLASS = 'eos-dp-write-backdrop';
    const busyIds = new Set();

    const safe = fn => { try { return fn(); } catch (_) { return undefined; } };
    const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));

    const isObjectsRoute = () => {
        const hash = String(window.location.hash || '');
        if (/#\/?tab-objects\b|#tab-objects\b/.test(hash)) return true;
        return /[?&]tab=objects/.test(String(window.location.href || ''));
    };

    const setSurfaceState = () => {
        const active = isObjectsRoute();
        document.documentElement.classList.toggle(ACTIVE_CLASS, active);
        document.body?.classList.toggle(ACTIVE_CLASS, active);
        return active;
    };

    const valueCellSelector = [
        '.eos-object-value-cell',
        '[data-eos-object-value-cell]',
        '[title*="Wert klicken"]',
        '[title*="Wert schreiben"]',
        '[title*="Write value"]'
    ].join(',');

    const interactiveIgnoreSelector = [
        `.${DIALOG_CLASS}`,
        'button',
        '[role="button"]',
        'a[href]',
        'input',
        'select',
        'textarea',
        '.MuiIconButton-root',
        '.MuiCheckbox-root',
        '.MuiMenuItem-root',
        '.MuiAutocomplete-option',
        '.copyButton'
    ].join(',');

    const normalizeText = value => String(value ?? '').replace(/\s+/g, ' ').trim();

    const getSocket = () =>
        window.NEXOWATT_EOS_OBJECTS_SOCKET ||
        window.NEXOWATT_EOS_SOCKET ||
        window.socket ||
        null;

    const waitForSocket = async () => {
        for (let i = 0; i < 40; i += 1) {
            const socket = getSocket();
            if (socket && (typeof socket.sendTo === 'function' || typeof socket.setState === 'function')) return socket;
            await delay(50);
        }
        throw new Error('Socket ist noch nicht bereit');
    };

    const withTimeout = async (promise, ms, fallback = null) => {
        let timer;
        try {
            return await Promise.race([
                Promise.resolve(promise),
                new Promise(resolve => { timer = window.setTimeout(() => resolve(fallback), ms); }),
            ]);
        } finally {
            if (timer) window.clearTimeout(timer);
        }
    };

    const parseBoolean = value => {
        if (value === true || value === 1) return true;
        if (value === false || value === 0 || value == null) return false;
        const normalized = String(value).trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes' || normalized === 'ja' || normalized === 'ein';
    };

    const isNullToken = value => /^\s*(\(null\)|null|undefined)?\s*$/i.test(String(value ?? ''));

    const stripUnit = value => String(value ?? '')
        .replace(/^\s*\((null|undefined)\)\s*$/i, '$1')
        .replace(/\s+(?:%|°C|°F|K|W|kW|Wh|kWh|VA|VAr|A|V|Hz|bar|mbar|Pa|hPa|l|L|m³|m3|s|min|h|d)$/i, '')
        .trim();

    const inferTypeFromValue = value => {
        const text = stripUnit(value);
        if (/^(true|false|0|1|on|off|yes|no|ja|nein|ein|aus)$/i.test(text)) return 'boolean';
        if (/^-?\d+(?:[.,]\d+)?$/.test(text)) return 'number';
        if (/^\s*[\[{]/.test(String(value || ''))) return 'json';
        return 'string';
    };

    const coerceValue = (rawValue, type) => {
        const raw = String(rawValue ?? '');
        if (isNullToken(raw) && type !== 'string' && type !== 'json') return null;
        if (type === 'boolean') return parseBoolean(raw);
        if (type === 'number') {
            const normalized = stripUnit(raw).replace(',', '.');
            const number = Number(normalized);
            if (!Number.isFinite(number)) throw new Error(`Ungültige Zahl: ${raw}`);
            return number;
        }
        if (type === 'json' || type === 'object') {
            if (isNullToken(raw)) return null;
            return JSON.parse(raw);
        }
        return raw;
    };

    const stateToString = value => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'object') {
            try { return JSON.stringify(value, null, 2); } catch (_) { return String(value); }
        }
        return String(value);
    };

    const formatWriteError = error => {
        if (!error) return 'unbekannter Fehler';
        if (typeof error === 'string') return error;
        if (error.message) return error.message;
        try { return JSON.stringify(error); } catch (_) { return String(error); }
    };

    let cachedEosAdminInstance = null;
    const normalizeInstanceId = value => {
        if (!value) return null;
        if (typeof value === 'string') {
            const id = value.replace(/^system\.adapter\./, '').trim();
            return /^eos-admin\.\d+$/.test(id) ? id : null;
        }
        if (typeof value === 'object') return normalizeInstanceId(value._id || value.id || value.instance || value.namespace);
        return null;
    };

    const resolveEosAdminInstance = async socket => {
        if (cachedEosAdminInstance) return cachedEosAdminInstance;
        const explicit = normalizeInstanceId(window.NEXOWATT_EOS_ADMIN_INSTANCE || window.adminInstance || window.adapterInstance);
        if (explicit) return (cachedEosAdminInstance = explicit);
        if (socket && typeof socket.getCurrentInstance === 'function') {
            try {
                const current = normalizeInstanceId(await withTimeout(socket.getCurrentInstance(), 700, null));
                if (current) return (cachedEosAdminInstance = current);
            } catch (_) { /* fallback below */ }
        }
        if (socket && typeof socket.getAdapterInstances === 'function') {
            try {
                const instances = await withTimeout(socket.getAdapterInstances('eos-admin'), 900, []);
                const list = Array.isArray(instances) ? instances : [];
                const alive = list.find(instance => normalizeInstanceId(instance) && instance?.common?.enabled !== false);
                const id = normalizeInstanceId(alive || list[0]);
                if (id) return (cachedEosAdminInstance = id);
            } catch (_) { /* fallback below */ }
        }
        return (cachedEosAdminInstance = 'eos-admin.0');
    };

    const callEosAdmin = async (socket, command, message) => {
        const instance = await resolveEosAdminInstance(socket);
        if (!instance) throw new Error('EOS Admin Instanz konnte nicht ermittelt werden');

        if (socket && typeof socket.sendTo === 'function') {
            const result = socket.sendTo(instance, command, message);
            if (result && typeof result.then === 'function') return await withTimeout(result, 7000, { ok: false, error: 'sendTo Timeout' });
            if (result !== undefined) return result;
        }

        const rawSocket = socket?._socket || socket?.socket || window.socket;
        if (rawSocket && typeof rawSocket.emit === 'function') {
            return await withTimeout(new Promise((resolve, reject) => {
                try {
                    rawSocket.emit('sendTo', instance, command, message, response => resolve(response));
                } catch (error) {
                    reject(error);
                }
            }), 7000, { ok: false, error: 'raw sendTo Timeout' });
        }

        throw new Error('socket.sendTo ist nicht verfügbar');
    };

    const writeStateUnrestricted = async (socket, id, state) => {
        if (!socket) throw new Error('Socket ist nicht bereit');

        let backendError = null;
        try {
            const response = await callEosAdmin(socket, 'eos:writeState', { id, state });
            if (response === 'permissionError') throw new Error('sendTo permissionError');
            if (response && response.ok === false) throw new Error(response.error || 'EOS Backend hat das Schreiben abgelehnt');
            if (response && response.error) throw new Error(response.error);
            return { ok: true, via: 'eos-admin' };
        } catch (error) {
            backendError = error;
        }

        if (typeof socket.setState === 'function') {
            try {
                await withTimeout(socket.setState(id, state), 7000);
                return { ok: true, via: 'socket' };
            } catch (directError) {
                throw new Error(`EOS-Backend: ${formatWriteError(backendError)}\nDirekt: ${formatWriteError(directError)}`);
            }
        }

        throw new Error(`EOS-Backend: ${formatWriteError(backendError)}\nDirekt: socket.setState ist nicht verfügbar`);
    };

    window.NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED = writeStateUnrestricted;

    const injectDialogStyle = () => {
        if (document.getElementById('eos-dp-write-style')) return;
        const style = document.createElement('style');
        style.id = 'eos-dp-write-style';
        style.textContent = `
            html.${ACTIVE_CLASS} .eos-object-value-cell,[data-eos-object-value-cell]{pointer-events:auto!important;cursor:pointer!important}
            .eos-dp-write-backdrop{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Roboto,Arial,sans-serif}.eos-dp-write-dialog{width:min(640px,calc(100vw - 36px));max-height:calc(100vh - 36px);overflow:auto;background:#061827;color:#fff;border:1px solid rgba(0,255,180,.45);border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.65),0 0 34px rgba(0,255,180,.22);padding:18px}.eos-dp-write-dialog h3{margin:0 0 8px;font-size:19px;color:#18f4c0}.eos-dp-write-id{font-family:monospace;font-size:12px;opacity:.82;word-break:break-all;margin-bottom:12px}.eos-dp-write-meta{font-size:12px;opacity:.76;margin-bottom:12px}.eos-dp-write-dialog label{display:block;font-size:13px;margin:12px 0 6px}.eos-dp-write-dialog input[type=text],.eos-dp-write-dialog textarea,.eos-dp-write-dialog select{box-sizing:border-box;width:100%;background:#07111d;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:8px;padding:10px;font-size:15px;outline:none}.eos-dp-write-dialog textarea{min-height:130px;font-family:monospace}.eos-dp-write-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}.eos-dp-write-actions button{border:0;border-radius:10px;padding:9px 16px;font-weight:700;cursor:pointer}.eos-dp-write-primary{background:#00d6a1;color:#03130f}.eos-dp-write-secondary{background:#273746;color:#fff}.eos-dp-write-actions button:disabled{opacity:.55;cursor:wait}.eos-dp-write-error{color:#ff7676;margin-top:10px;font-size:13px;white-space:pre-wrap}.eos-dp-write-hint{font-size:12px;opacity:.72;margin-top:8px}.eos-dp-write-toast{position:fixed;right:18px;bottom:84px;z-index:9050;background:#05251e;border:1px solid rgba(0,255,180,.45);box-shadow:0 8px 28px rgba(0,0,0,.45);color:#fff;border-radius:12px;padding:10px 14px;font:13px Roboto,Arial,sans-serif}.eos-object-value-cell.eos-dp-write-pulse{outline:2px solid #00d6a1;outline-offset:-2px}`;
        document.head.appendChild(style);
    };

    const showToast = (message, ms = 1800) => {
        injectDialogStyle();
        document.querySelectorAll('.eos-dp-write-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'eos-dp-write-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), ms);
    };

    const closeExistingDialog = () => document.querySelector(`.${DIALOG_CLASS}`)?.remove();

    const resolveIdFromCell = cell => {
        if (!cell) return '';
        const direct = cell.getAttribute?.('data-eos-object-value-cell') || cell.closest?.('[data-eos-object-value-cell]')?.getAttribute('data-eos-object-value-cell');
        if (direct) return direct.trim();
        const row = cell.closest?.('[data-eos-object-id],[data-id],[data-nodeid],[role="treeitem"],[role="row"],tr,li');
        const attrs = ['data-eos-object-id', 'data-id', 'data-nodeid', 'id'];
        for (const attr of attrs) {
            const value = row?.getAttribute?.(attr);
            if (value && value.includes('.')) return value.replace(/^.*?(?=(?:system|alias|enum|javascript|mqtt|modbus|e3dc|0_userdata|nexowatt|ems|hm-rpc|zigbee|shelly|sonoff|mihome|knx|fhem|sql|influxdb)\.)/, '').trim();
        }
        return '';
    };

    const readObjectAndState = async (socket, id, visibleValue) => {
        const objectPromise = typeof socket.getObject === 'function' ? socket.getObject(id) : Promise.resolve(null);
        const statePromise = typeof socket.getState === 'function' ? socket.getState(id) : Promise.resolve(null);
        const [objResult, stateResult] = await Promise.allSettled([
            withTimeout(objectPromise, 1800, null),
            withTimeout(statePromise, 1800, null),
        ]);
        const obj = objResult.status === 'fulfilled' ? objResult.value : null;
        const state = stateResult.status === 'fulfilled' ? stateResult.value : null;
        const common = obj?.common || {};
        const current = state && Object.prototype.hasOwnProperty.call(state, 'val') ? state.val : stripUnit(visibleValue);
        let type = common.type || typeof current;
        if (!type || type === 'undefined' || type === 'object') type = type === 'object' ? 'json' : inferTypeFromValue(current);
        if (type === 'array') type = 'json';
        const role = String(common.role || '');
        const states = common.states && typeof common.states === 'object' ? common.states : null;
        return { obj, state, common, current, type, role, states };
    };

    const openWriteDialog = async (cell, event) => {
        const id = resolveIdFromCell(cell);
        if (!id || busyIds.has(id)) return;
        busyIds.add(id);
        injectDialogStyle();
        cell?.classList?.add('eos-dp-write-pulse');
        window.setTimeout(() => cell?.classList?.remove('eos-dp-write-pulse'), 650);

        try {
            const socket = await waitForSocket();
            const visibleValue = normalizeText(cell?.textContent || '');
            const meta = await readObjectAndState(socket, id, visibleValue);
            const { obj, common, current, type, role, states } = meta;

            if (obj && obj.type && obj.type !== 'state') {
                showToast(`EOS: "${id}" ist kein State (${obj.type})`);
                busyIds.delete(id);
                return;
            }
            if (common.type === 'file') {
                showToast('EOS: Datei-Datenpunkte werden nicht als normaler State-Wert geschrieben.');
                busyIds.delete(id);
                return;
            }

            if (/^button/.test(role) && (type === 'boolean' || type === 'string' || !type)) {
                await writeStateUnrestricted(socket, id, { val: true, ack: false, q: 0 });
                showToast(`Befehl geschrieben: ${id}`);
                busyIds.delete(id);
                return;
            }

            closeExistingDialog();
            const backdrop = document.createElement('div');
            backdrop.className = DIALOG_CLASS;
            const dialog = document.createElement('div');
            dialog.className = 'eos-dp-write-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.innerHTML = `
                <h3>Datenpunkt schreiben</h3>
                <div class="eos-dp-write-id"></div>
                <div class="eos-dp-write-meta"></div>
                <label class="eos-dp-write-label">Neuer Wert</label>
                <div class="eos-dp-write-input-wrap"></div>
                <label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input class="eos-dp-write-ack" type="checkbox"> ack=true schreiben</label>
                <div class="eos-dp-write-hint">EOS schreibt direkt über die Backend-Bridge. common.write/read blockiert hier nicht mehr.</div>
                <div class="eos-dp-write-error" hidden></div>
                <div class="eos-dp-write-actions"><button class="eos-dp-write-secondary" type="button">Abbrechen</button><button class="eos-dp-write-primary" type="button">Schreiben</button></div>`;
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            dialog.querySelector('.eos-dp-write-id').textContent = id;
            dialog.querySelector('.eos-dp-write-meta').textContent = `Typ: ${type}${role ? ` · Rolle: ${role}` : ''}${common.unit ? ` · Einheit: ${common.unit}` : ''}${obj ? '' : ' · Objekt lädt langsam / Fallback aktiv'}`;

            const inputWrap = dialog.querySelector('.eos-dp-write-input-wrap');
            let input;
            if (states) {
                input = document.createElement('select');
                Object.keys(states).forEach(key => {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = `${states[key]} (${key})`;
                    input.appendChild(option);
                });
                input.value = current == null ? Object.keys(states)[0] || '' : String(current);
            } else if (type === 'boolean') {
                input = document.createElement('select');
                input.innerHTML = '<option value="true">true</option><option value="false">false</option><option value="null">null</option>';
                input.value = current == null ? 'null' : (parseBoolean(current) ? 'true' : 'false');
            } else if (type === 'json') {
                input = document.createElement('textarea');
                input.value = stateToString(current);
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.value = stateToString(current);
            }
            input.className = 'eos-dp-write-input';
            inputWrap.appendChild(input);

            const errorEl = dialog.querySelector('.eos-dp-write-error');
            const cancelBtn = dialog.querySelector('.eos-dp-write-secondary');
            const writeBtn = dialog.querySelector('.eos-dp-write-primary');
            const ackInput = dialog.querySelector('.eos-dp-write-ack');

            const close = () => {
                backdrop.remove();
                busyIds.delete(id);
            };

            const write = async () => {
                errorEl.hidden = true;
                writeBtn.disabled = true;
                cancelBtn.disabled = true;
                try {
                    const effectiveType = states ? (common.type || type) : type;
                    const value = coerceValue(input.value, effectiveType);
                    await writeStateUnrestricted(socket, id, { val: value, ack: !!ackInput.checked, q: 0 });
                    close();
                    showToast(`Geschrieben: ${id}`);
                } catch (error) {
                    errorEl.textContent = `Schreiben fehlgeschlagen:\n${error?.message || error}`;
                    errorEl.hidden = false;
                    writeBtn.disabled = false;
                    cancelBtn.disabled = false;
                }
            };

            cancelBtn.addEventListener('click', close);
            writeBtn.addEventListener('click', write);
            backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
            input.addEventListener('keydown', e => {
                if ((e.key === 'Enter' && type !== 'json') || (e.key === 'Enter' && e.ctrlKey)) {
                    e.preventDefault();
                    write();
                }
                if (e.key === 'Escape') close();
            });
            window.setTimeout(() => input.focus(), 30);
        } catch (error) {
            busyIds.delete(id);
            window.alert(`EOS: Datenpunkt konnte nicht geschrieben werden:\n${error?.message || error}`);
        }
    };

    const handleClickCapture = event => {
        if (!setSurfaceState()) return;
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target?.closest?.(`.${DIALOG_CLASS}`)) return;
        if (event.target?.closest?.(interactiveIgnoreSelector) && !event.target?.closest?.(valueCellSelector)) return;
        const cell = event.target?.closest?.(valueCellSelector);
        if (!cell) return;
        const id = resolveIdFromCell(cell);
        if (!id) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openWriteDialog(cell, event);
    };

    const handleKeydownCapture = event => {
        if (!setSurfaceState() || event.key !== 'Enter') return;
        const cell = event.target?.closest?.(valueCellSelector);
        if (!cell) return;
        const id = resolveIdFromCell(cell);
        if (!id) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openWriteDialog(cell, event);
    };

    const handlePointerOver = event => {
        if (!setSurfaceState()) return;
        const cell = event.target?.closest?.(valueCellSelector);
        if (cell && resolveIdFromCell(cell)) {
            cell.classList.add('eos-object-value-cell');
            cell.setAttribute('tabindex', '0');
            if (!cell.getAttribute('title')) cell.setAttribute('title', 'Klicken: Wert schreiben');
        }
    };

    const start = () => {
        setSurfaceState();
        injectDialogStyle();
        document.addEventListener('click', handleClickCapture, true);
        document.addEventListener('keydown', handleKeydownCapture, true);
        document.addEventListener('pointerover', handlePointerOver, true);
        window.addEventListener('hashchange', setSurfaceState);
        window.addEventListener('popstate', setSurfaceState);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
