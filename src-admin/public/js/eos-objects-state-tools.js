(() => {
    'use strict';

    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_VERSION = 'v51-unrestricted-dp-write-fix';

    const ACTIVE_CLASS = 'eos-objects-surface';
    const safe = fn => { try { return fn(); } catch (_) { return undefined; } };
    const busyIds = new Set();

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
        '[title*="Wert klicken"]',
        '[title*="Button sofort testen"]'
    ].join(',');

    const collect = (base, selector) => {
        const out = [];
        if (!base) return out;
        if (base.nodeType === Node.ELEMENT_NODE && base.matches?.(selector)) out.push(base);
        if (base.querySelectorAll) out.push(...Array.from(base.querySelectorAll(selector)));
        return out;
    };

    const getSocket = () => window.NEXOWATT_EOS_OBJECTS_SOCKET || window.NEXOWATT_EOS_SOCKET || window.socket || null;

    const normalizeText = value => String(value ?? '').replace(/\s+/g, ' ').trim();

    const isWritableCell = cell => {
        if (!cell) return false;
        // v51: the React ObjectBrowser now marks every state value cell as writable.
        // Do not treat common.write=false as an EOS-side lock; the socket/ACL layer is
        // the only authority that may reject a write.
        if (cell.getAttribute('data-eos-object-writable') === '1') return true;
        if (cell.hasAttribute('data-eos-object-value-cell') && cell.getAttribute('data-eos-object-writable') !== '0') return true;
        const title = `${cell.getAttribute('title') || ''} ${cell.textContent || ''}`;
        return /wert\s*(klicken|schreiben)|write\s*value|sofort\s*testen/i.test(title);
    };

    const isStateValueCandidate = cell => !!cell && (
        cell.hasAttribute?.('data-eos-object-value-cell') ||
        cell.classList?.contains('eos-object-value-cell') ||
        isWritableCell(cell)
    );

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
            const writable = isWritableCell(cell);
            const visibleValue = normalizeText(cell.textContent || '') || '(leer)';
            const cache = `${id}|${writable ? 1 : 0}|${visibleValue}`;

            cell.style.pointerEvents = 'auto';
            cell.style.cursor = writable ? 'pointer' : 'default';
            cell.classList.add('eos-object-value-cell');
            cell.classList.toggle('eos-object-value-writable', writable);
            cell.classList.toggle('eos-object-value-readonly', !writable);
            if (writable) cell.setAttribute('tabindex', '0');

            if (cell.getAttribute('data-eos-value-cache') !== cache) {
                cell.setAttribute('data-eos-value-cache', cache);
                cell.setAttribute('data-eos-current-visible-value', visibleValue);
                const nextTitle = [
                    id ? `ID: ${id}` : null,
                    `Aktueller Wert: ${visibleValue}`,
                    `Status: ${writable ? 'beschreibbar' : 'nur lesbar'}`,
                    writable ? 'Klicken: Wert schreiben' : 'Nur lesbarer Wert'
                ].filter(Boolean).join('\n');
                if (cell.getAttribute('title') !== nextTitle) cell.setAttribute('title', nextTitle);
            }
        });
    });

    const parseBoolean = value => {
        if (value === true || value === 1) return true;
        if (value === false || value === 0 || value == null) return false;
        const normalized = String(value).trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes' || normalized === 'ja';
    };

    const isNullToken = value => /^\s*(\(null\)|null|undefined)?\s*$/i.test(String(value ?? ''));

    const coerceValue = (rawValue, type) => {
        const raw = String(rawValue ?? '');
        if (isNullToken(raw) && type !== 'string' && type !== 'json') return null;
        if (type === 'boolean') return parseBoolean(raw);
        if (type === 'number') {
            const normalized = raw.replace(',', '.').trim();
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

    const hasNativeWriteDialog = () => {
        const dialogs = Array.from(document.querySelectorAll('.MuiDialog-root,[role="dialog"]'));
        return dialogs.some(dialog => /write value|wert schreiben|set value|wert setzen/i.test(dialog.textContent || ''));
    };


    let cachedEosAdminInstance = null;

    const formatWriteError = error => {
        if (!error) return 'unbekannter Fehler';
        if (typeof error === 'string') return error;
        if (error.message) return error.message;
        try { return JSON.stringify(error); } catch (_) { return String(error); }
    };

    const normalizeInstanceId = value => {
        if (!value) return null;
        if (typeof value === 'string') {
            const id = value.replace(/^system\.adapter\./, '').trim();
            return /^eos-admin\.\d+$/.test(id) ? id : null;
        }
        if (typeof value === 'object') {
            return normalizeInstanceId(value._id || value.id || value.instance || value.namespace);
        }
        return null;
    };

    const resolveEosAdminInstance = async socket => {
        if (cachedEosAdminInstance) return cachedEosAdminInstance;
        const explicit = normalizeInstanceId(window.NEXOWATT_EOS_ADMIN_INSTANCE || window.adminInstance || window.adapterInstance);
        if (explicit) return (cachedEosAdminInstance = explicit);

        if (socket && typeof socket.getCurrentInstance === 'function') {
            try {
                const current = normalizeInstanceId(await socket.getCurrentInstance());
                if (current) return (cachedEosAdminInstance = current);
            } catch (_) {
                // ignore and try instance list/fallback
            }
        }

        if (socket && typeof socket.getAdapterInstances === 'function') {
            try {
                const instances = await socket.getAdapterInstances('eos-admin');
                const list = Array.isArray(instances) ? instances : [];
                const alive = list.find(instance => normalizeInstanceId(instance) && instance?.common?.enabled !== false);
                const id = normalizeInstanceId(alive || list[0]);
                if (id) return (cachedEosAdminInstance = id);
            } catch (_) {
                // ignore and use default
            }
        }

        return (cachedEosAdminInstance = 'eos-admin.0');
    };

    const callEosAdmin = async (socket, command, message) => {
        const instance = await resolveEosAdminInstance(socket);
        if (!instance) throw new Error('EOS Admin Instanz konnte nicht ermittelt werden');

        if (socket && typeof socket.sendTo === 'function') {
            const result = socket.sendTo(instance, command, message);
            if (result && typeof result.then === 'function') return result;
            if (result !== undefined) return result;
        }

        const rawSocket = socket?._socket || socket?.socket || window.socket;
        if (rawSocket && typeof rawSocket.emit === 'function') {
            return await new Promise((resolve, reject) => {
                try {
                    rawSocket.emit('sendTo', instance, command, message, response => resolve(response));
                } catch (error) {
                    reject(error);
                }
            });
        }

        throw new Error('socket.sendTo ist nicht verfügbar');
    };

    const writeStateUnrestricted = async (socket, id, state) => {
        let directError = null;
        if (!socket) throw new Error('Socket ist nicht bereit');

        if (typeof socket.setState === 'function') {
            try {
                await socket.setState(id, state);
                return { ok: true, via: 'socket' };
            } catch (error) {
                directError = error;
            }
        } else {
            directError = new Error('socket.setState ist nicht verfügbar');
        }

        try {
            const response = await callEosAdmin(socket, 'eos:writeState', { id, state });
            if (response === 'permissionError') throw new Error('sendTo permissionError');
            if (response && response.ok === false) throw new Error(response.error || 'EOS Backend hat das Schreiben abgelehnt');
            if (response && response.error) throw new Error(response.error);
            return { ok: true, via: 'eos-admin' };
        } catch (backendError) {
            throw new Error(`Direkt: ${formatWriteError(directError)}\nEOS-Backend: ${formatWriteError(backendError)}`);
        }
    };

    window.NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED = writeStateUnrestricted;

    const injectDialogStyle = () => {
        if (document.getElementById('eos-dp-write-style')) return;
        const style = document.createElement('style');
        style.id = 'eos-dp-write-style';
        style.textContent = `
            .eos-dp-write-backdrop{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Roboto,Arial,sans-serif}.eos-dp-write-dialog{width:min(620px,calc(100vw - 36px));max-height:calc(100vh - 36px);overflow:auto;background:#061827;color:#fff;border:1px solid rgba(0,255,180,.45);border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.65),0 0 34px rgba(0,255,180,.22);padding:18px}.eos-dp-write-dialog h3{margin:0 0 8px;font-size:19px;color:#18f4c0}.eos-dp-write-id{font-family:monospace;font-size:12px;opacity:.82;word-break:break-all;margin-bottom:12px}.eos-dp-write-meta{font-size:12px;opacity:.76;margin-bottom:12px}.eos-dp-write-dialog label{display:block;font-size:13px;margin:12px 0 6px}.eos-dp-write-dialog input[type=text],.eos-dp-write-dialog textarea,.eos-dp-write-dialog select{box-sizing:border-box;width:100%;background:#07111d;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:8px;padding:10px;font-size:15px;outline:none}.eos-dp-write-dialog textarea{min-height:130px;font-family:monospace}.eos-dp-write-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}.eos-dp-write-actions button{border:0;border-radius:10px;padding:9px 16px;font-weight:700;cursor:pointer}.eos-dp-write-primary{background:#00d6a1;color:#03130f}.eos-dp-write-secondary{background:#273746;color:#fff}.eos-dp-write-actions button:disabled{opacity:.55;cursor:wait}.eos-dp-write-error{color:#ff7676;margin-top:10px;font-size:13px;white-space:pre-wrap}.eos-object-value-cell.eos-dp-write-pulse{outline:2px solid #00d6a1;outline-offset:-2px}`;
        document.head.appendChild(style);
    };

    const closeExistingDialog = () => document.querySelector('.eos-dp-write-backdrop')?.remove();

    const openWriteDialog = async (cell, event) => {
        const id = cell?.getAttribute('data-eos-object-value-cell') || cell?.closest?.('[id]')?.id || '';
        if (!id || busyIds.has(id)) return;
        const socket = getSocket();
        if (!socket || typeof socket.setState !== 'function') {
            window.alert('EOS: Socket für Datenpunkt-Schreiben ist noch nicht bereit. Bitte Seite einmal hart neu laden (Strg+F5).');
            return;
        }

        busyIds.add(id);
        cell?.classList.add('eos-dp-write-pulse');
        window.setTimeout(() => cell?.classList.remove('eos-dp-write-pulse'), 900);

        try {
            const [objResult, stateResult] = await Promise.allSettled([
                typeof socket.getObject === 'function' ? socket.getObject(id) : Promise.resolve(null),
                typeof socket.getState === 'function' ? socket.getState(id) : Promise.resolve(null),
            ]);
            const obj = objResult.status === 'fulfilled' ? objResult.value : null;
            const state = stateResult.status === 'fulfilled' ? stateResult.value : null;
            if (!obj || obj.type !== 'state') {
                busyIds.delete(id);
                return;
            }
            const common = obj?.common || {};
            if (common.type === 'file') {
                busyIds.delete(id);
                window.alert('EOS: Datei-Datenpunkte werden über die Datei-/Objektansicht geöffnet und nicht als State-Wert geschrieben.');
                return;
            }
            const role = String(common.role || '');
            let type = common.type || typeof state?.val;
            if (!type || type === 'undefined') type = 'string';
            if (type === 'object') type = 'json';
            const current = state?.val;
            const states = common.states && typeof common.states === 'object' ? common.states : null;

            if (/^button/.test(role)) {
                await writeStateUnrestricted(socket, id, { val: true, ack: false, q: 0 });
                busyIds.delete(id);
                return;
            }

            injectDialogStyle();
            closeExistingDialog();

            const backdrop = document.createElement('div');
            backdrop.className = 'eos-dp-write-backdrop';
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
                <div class="eos-dp-write-error" hidden></div>
                <div class="eos-dp-write-actions"><button class="eos-dp-write-secondary" type="button">Abbrechen</button><button class="eos-dp-write-primary" type="button">Schreiben</button></div>`;
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            dialog.querySelector('.eos-dp-write-id').textContent = id;
            dialog.querySelector('.eos-dp-write-meta').textContent = `Typ: ${type}${role ? ` · Rolle: ${role}` : ''}${common.unit ? ` · Einheit: ${common.unit}` : ''}`;

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
                input.innerHTML = '<option value="true">true</option><option value="false">false</option>';
                input.value = parseBoolean(current) ? 'true' : 'false';
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
                    let value = input.value;
                    const effectiveType = states ? (common.type || type) : type;
                    value = coerceValue(value, effectiveType);
                    await writeStateUnrestricted(socket, id, { val: value, ack: !!ackInput.checked, q: 0 });
                    close();
                } catch (error) {
                    errorEl.textContent = `Schreiben fehlgeschlagen: ${error?.message || error}`;
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
            window.alert(`EOS: Datenpunkt konnte nicht geschrieben werden: ${error?.message || error}`);
        }
    };

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
            roots.slice(0, 80).forEach(run);
        };
        if ('requestIdleCallback' in window) window.requestIdleCallback(execute, { timeout: 500 });
        else window.requestAnimationFrame(execute);
    };

    const handlePointerAssist = event => {
        if (!setSurfaceState()) return;
        const cell = event.target?.closest?.('.eos-object-value-cell');
        if (isWritableCell(cell)) cell.classList.add('eos-object-value-hover');
    };

    const handlePointerLeave = event => {
        event.target?.closest?.('.eos-object-value-cell')?.classList.remove('eos-object-value-hover');
    };

    const shouldSkipFallback = cell => !!cell?.querySelector?.('.MuiSwitch-root,.admin-button,button,.copyButton');

    const scheduleFallbackWriter = event => {
        if (!setSurfaceState()) return;
        const cell = event.target?.closest?.('.eos-object-value-cell,[data-eos-object-value-cell]');
        if (!cell || !isStateValueCandidate(cell) || shouldSkipFallback(cell)) return;
        const id = cell.getAttribute('data-eos-object-value-cell') || '';
        if (!id) return;
        window.setTimeout(() => {
            if (!setSurfaceState()) return;
            if (!cell.isConnected || hasNativeWriteDialog()) return;
            openWriteDialog(cell, event);
        }, 180);
    };

    window.addEventListener('hashchange', () => window.setTimeout(() => schedule(document), 30));
    window.addEventListener('popstate', () => window.setTimeout(() => schedule(document), 30));
    document.addEventListener('mouseover', handlePointerAssist, true);
    document.addEventListener('mouseout', handlePointerLeave, true);
    document.addEventListener('click', event => {
        if (!setSurfaceState()) return;
        const cell = event.target?.closest?.('.eos-object-value-cell,[data-eos-object-value-cell]');
        if (cell) {
            releaseNativeControls(cell);
            scheduleFallbackWriter(event);
        }
    }, true);
    document.addEventListener('click', event => {
        if (!setSurfaceState()) return;
        const nativeInteractive = event.target?.closest?.(`${interactiveSelector},${nativeLayerSelector},.eos-object-value-cell,[data-eos-object-value-cell]`);
        if (nativeInteractive) {
            releaseNativeControls(nativeInteractive);
            scheduleFallbackWriter(event);
            window.setTimeout(() => schedule(nativeInteractive), 80);
        }
    }, false);
    document.addEventListener('keydown', event => {
        if (!setSurfaceState()) return;
        if (event.key !== 'Enter') return;
        const cell = event.target?.closest?.('.eos-object-value-cell,[data-eos-object-value-cell]');
        if (!cell || !isStateValueCandidate(cell) || shouldSkipFallback(cell)) return;
        event.preventDefault();
        openWriteDialog(cell, event);
    }, true);

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
        window.setInterval(() => schedule(document), 60000);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
