/* NexoWatt EOS manual datapoint write policy v7.9.76 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (!root) return;

    root.NEXOWATT_EOS_MANUAL_WRITE_POLICY_VERSION = 'v76-universal-manual-write';
    root.NEXOWATT_EOS_GET_WRITE_BEHAVIOR = api.getWriteBehavior;
    root.NEXOWATT_EOS_IS_EXPERT_ONLY_STATE = api.isExpertOnlyState;
    root.NEXOWATT_EOS_COERCE_BOOLEAN = api.toBoolean;
    root.NEXOWATT_EOS_WRITE_MANUAL_STATE = api.writeManualState;
    root.NEXOWATT_EOS_RESOLVE_EDITOR_TYPE = api.resolveEditorType;
    root.NEXOWATT_EOS_PREPARE_EDITOR_VALUE = api.prepareEditorValue;
    root.NEXOWATT_EOS_COERCE_WRITE_VALUE = api.coerceWriteValue;
    root.NEXOWATT_EOS_GET_DIRECT_WRITE_VALUE = api.getDirectWriteValue;
    root.NEXOWATT_EOS_GET_WRITE_LABEL = api.getWriteLabel;
    root.NEXOWATT_EOS_NORMALIZE_STATES = api.normalizeStates;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null, function () {
    'use strict';

    // Manual writes are serialized per datapoint. A second command is queued
    // instead of being silently dropped while the previous write is pending.
    const writeQueues = new Map();

    const normalizeText = value => String(value == null ? '' : value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const flattenTranslatedText = value => {
        if (value == null) return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') return Object.values(value).map(flattenTranslatedText).filter(Boolean).join(' ');
        return '';
    };

    const getCommon = obj => (obj && obj.common && typeof obj.common === 'object' ? obj.common : {});
    const getNative = obj => (obj && obj.native && typeof obj.native === 'object' ? obj.native : {});

    const getExplicitValue = (obj, name) => {
        const common = getCommon(obj);
        const native = getNative(obj);
        const custom = common.custom || {};
        const candidates = [
            common[name],
            native[name],
            native.nexowatt && native.nexowatt[name],
            custom.nexowatt && custom.nexowatt[name],
            custom['nexowatt.eos'] && custom['nexowatt.eos'][name],
            custom['eos-admin'] && custom['eos-admin'][name],
        ];
        for (const value of candidates) {
            if (value !== undefined) return value;
        }
        return undefined;
    };

    const getExplicitExpertOnly = obj => {
        const candidates = [getExplicitValue(obj, 'manualWriteExpertOnly'), getExplicitValue(obj, 'expertOnly')];
        for (const value of candidates) {
            if (typeof value === 'boolean') return value;
        }
        return undefined;
    };

    const isExpertOnlyState = (id, obj) => {
        const explicit = getExplicitExpertOnly(obj);
        if (explicit !== undefined) return explicit;

        const common = getCommon(obj);
        const role = normalizeText(common.role);
        const text = normalizeText([
            id,
            role,
            common.type,
            flattenTranslatedText(common.name),
            flattenTranslatedText(common.desc),
        ].join(' '));
        const compact = text.replace(/[^a-z0-9]+/g, '');

        // Conservative safety policy for commands that can reset equipment,
        // open contactors or materially change charging/power/current limits.
        if (/^(?:level\.)?(?:power|current)(?:\.|$)/.test(role)) return true;
        if (/^(?:value\.)?(?:power|current)\.setpoint(?:\.|$)/.test(role)) return true;

        const exactRiskTokens = [
            'hardreset', 'softreset', 'factoryreset', 'factorydefault', 'reboot', 'restartdevice', 'shutdown',
            'emergencystop', 'notaus', 'contactor', 'unlockconnector', 'remotestart', 'remotestop',
            'starttransaction', 'stoptransaction', 'chargepower', 'chargingpower', 'dischargepower',
            'chargecurrent', 'chargingcurrent', 'currentlimit', 'safecurrent', 'setchargingcurrent',
            'exportlimit', 'feedinlimit', 'powerlimit', 'powersetpoint', 'pvpowerlimit', 'gridlimit',
            'controlmode', 'operatingmode', 'batterymode', 'gridmode', 'firmwareupdate',
            'ladeleistung', 'entladeleistung', 'ladestrom', 'stromlimit', 'leistungsgrenze',
            'leistungssollwert', 'einspeiselimit', 'ruecksetzen', 'neustart',
        ];
        if (exactRiskTokens.some(token => compact.includes(token))) return true;

        const powerCommand = /(?:charge|charging|discharge|export|feedin|grid|netz|pv|lade|entlade|einspeise)[\s._/-]{0,6}(?:power|current|leistung|strom).{0,28}(?:limit|setpoint|target|command|override|control|grenze|soll|vorgabe)/;
        const inversePowerCommand = /(?:limit|setpoint|target|command|override|control|grenze|soll|vorgabe).{0,28}(?:charge|charging|discharge|export|feedin|grid|netz|pv|lade|entlade|einspeise|power|current|leistung|strom)/;
        return powerCommand.test(text) || inversePowerCommand.test(text);
    };

    const toBoolean = value => {
        if (value === true || value === 1) return true;
        if (value === false || value === 0 || value == null) return false;
        const normalized = normalizeText(value);
        if (['true', '1', 'on', 'yes', 'ja', 'enabled', 'enable', 'active', 'start', 'open', 'ein', 'an'].includes(normalized)) return true;
        if (['false', '0', 'off', 'no', 'nein', 'disabled', 'disable', 'inactive', 'stop', 'closed', 'aus', '', 'null', '(null)'].includes(normalized)) return false;
        return Boolean(value);
    };

    const normalizeSingleCommonType = value => {
        const type = normalizeText(value);
        if (type === 'int' || type === 'integer' || type === 'float' || type === 'double') return 'number';
        if (type === 'bool') return 'boolean';
        if (type === 'object' || type === 'array') return type;
        if (type === 'json') return 'json';
        if (type === 'number' || type === 'boolean' || type === 'string' || type === 'mixed' || type === 'file') return type;
        return '';
    };

    const normalizeCommonType = value => {
        if (Array.isArray(value)) {
            const types = [...new Set(value.map(normalizeSingleCommonType).filter(Boolean))];
            return types.length === 1 ? types[0] : types.length ? 'mixed' : '';
        }
        return normalizeSingleCommonType(value);
    };

    const inferPrimitiveType = value => {
        if (Array.isArray(value)) return 'array';
        if (value !== null && typeof value === 'object') return 'object';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'string') return 'string';
        return '';
    };

    const normalizeStates = states => {
        if (!states) return null;
        if (Array.isArray(states)) {
            const result = {};
            states.forEach((value, index) => { result[String(index)] = flattenTranslatedText(value); });
            return result;
        }
        if (typeof states === 'string') {
            const result = {};
            states.split(/[;,]/).map(part => part.trim()).filter(Boolean).forEach(part => {
                const separator = part.includes(':') ? ':' : part.includes('=') ? '=' : '';
                if (!separator) return;
                const index = part.indexOf(separator);
                const key = part.slice(0, index).trim();
                const label = part.slice(index + 1).trim();
                if (key) result[key] = label || key;
            });
            return Object.keys(result).length ? result : null;
        }
        if (typeof states === 'object') {
            const result = {};
            Object.keys(states).forEach(key => { result[String(key)] = flattenTranslatedText(states[key]); });
            return result;
        }
        return null;
    };

    const resolveEditorType = (obj, currentValue, states) => {
        const common = getCommon(obj);
        const normalizedStates = normalizeStates(states || common.states);
        if (normalizedStates && Object.keys(normalizedStates).length) return 'states';

        const declared = normalizeCommonType(common.type);
        if (declared === 'file') return 'file';
        if (declared === 'object' || declared === 'array' || declared === 'json') return 'json';
        if (declared === 'number' || declared === 'boolean' || declared === 'string') return declared;

        const candidate = currentValue !== undefined && currentValue !== null ? currentValue : common.def;
        const inferred = inferPrimitiveType(candidate);
        if (inferred === 'object' || inferred === 'array') return 'json';
        if (inferred) return inferred;
        return 'string';
    };

    const stringifyJsonValue = value => {
        if (typeof value === 'string') {
            try {
                return JSON.stringify(JSON.parse(value), null, 2);
            } catch {
                return value;
            }
        }
        if (value === undefined || value === null) return '';
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    };

    const isNumberInRange = (value, common) => {
        if (value === '') return false;
        const number = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value);
        if (!Number.isFinite(number)) return false;
        if (typeof common.min === 'number' && number < common.min) return false;
        if (typeof common.max === 'number' && number > common.max) return false;
        return true;
    };

    const prepareEditorValue = (obj, currentValue, states) => {
        const common = getCommon(obj);
        const type = resolveEditorType(obj, currentValue, states);
        const hasCurrentValue = currentValue !== undefined && currentValue !== null;
        const hasDefault = common.def !== undefined && common.def !== null;
        let value = hasCurrentValue ? currentValue : hasDefault ? common.def : undefined;
        let valid = true;

        if (type === 'number') {
            if (value === undefined || value === '') {
                value = '';
                valid = false;
            } else {
                const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
                const parsed = Number(normalized);
                if (Number.isFinite(parsed)) {
                    value = parsed;
                    valid = isNumberInRange(parsed, common);
                } else {
                    value = String(value);
                    valid = false;
                }
            }
        } else if (type === 'boolean') {
            value = toBoolean(value);
        } else if (type === 'json') {
            const declared = normalizeCommonType(common.type);
            if (value === undefined) value = declared === 'array' ? '[]' : declared === 'object' ? '{}' : '';
            value = stringifyJsonValue(value);
            try {
                JSON.parse(value);
                valid = true;
            } catch {
                valid = false;
            }
        } else if (type === 'states') {
            value = value === undefined ? '' : value;
            const normalizedStates = normalizeStates(states || common.states) || {};
            valid = value !== '' && Object.prototype.hasOwnProperty.call(normalizedStates, String(value));
        } else {
            value = value === undefined ? '' : String(value);
        }

        return { type, value, propsValue: value, valid };
    };

    const parseNumber = (value, common) => {
        if (value === null || value === 'null') return null;
        const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
        if (normalized === '') throw new Error('Der Zahlenwert darf nicht leer sein.');
        const number = Number(normalized);
        if (!Number.isFinite(number)) throw new Error(`Ungültiger Zahlenwert: ${String(value)}`);
        if (typeof common.min === 'number' && number < common.min) throw new Error(`Wert liegt unter dem Minimum ${common.min}.`);
        if (typeof common.max === 'number' && number > common.max) throw new Error(`Wert liegt über dem Maximum ${common.max}.`);
        return number;
    };

    const parseJsonStateValue = (value, declared) => {
        const raw = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
        if (!raw.trim()) throw new Error('Der JSON-Wert darf nicht leer sein.');
        const parsed = JSON.parse(raw);
        if (declared === 'array' && !Array.isArray(parsed)) throw new Error('Der Datenpunkt erwartet ein JSON-Array.');
        if (declared === 'object' && (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))) {
            throw new Error('Der Datenpunkt erwartet ein JSON-Objekt.');
        }
        // ioBroker StateValue is scalar. Structured values are therefore stored
        // as a validated JSON string instead of passing an unsupported object.
        return raw;
    };

    const coerceByDeclaredType = (obj, value, currentValue) => {
        const common = getCommon(obj);
        const declared = normalizeCommonType(common.type);
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) value = value.value;

        if (declared === 'number') return parseNumber(value, common);
        if (declared === 'boolean') return value === null || value === 'null' ? null : toBoolean(value);
        if (declared === 'string') return value === null ? '' : String(value);
        if (declared === 'object' || declared === 'array' || declared === 'json') return parseJsonStateValue(value, declared);

        // mixed or missing type: preserve the current/default primitive type where possible.
        const candidate = currentValue !== undefined && currentValue !== null ? currentValue : common.def;
        const inferred = inferPrimitiveType(candidate);
        if (inferred === 'number') return parseNumber(value, common);
        if (inferred === 'boolean') return value === null || value === 'null' ? null : toBoolean(value);
        if (inferred === 'object' || inferred === 'array') return parseJsonStateValue(value, inferred);
        if (typeof value === 'string' && value.trim() === 'null') return null;
        return value == null ? '' : value;
    };

    const coerceStateKey = (obj, value, currentValue) => {
        const raw = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : value;
        return coerceByDeclaredType(obj, raw, currentValue);
    };

    const coerceWriteValue = (obj, rawValue, editorType, originalType, currentValue) => {
        const common = getCommon(obj);
        if (common.write === false) throw new Error('common.write=false');

        if (editorType === 'states') return coerceStateKey(obj, rawValue, currentValue);
        if (editorType === 'number') return parseNumber(rawValue, common);
        if (editorType === 'boolean') return rawValue === null || rawValue === 'null' ? null : toBoolean(rawValue);
        if (editorType === 'json') return parseJsonStateValue(rawValue, normalizeCommonType(common.type));
        if (editorType === 'string') return rawValue == null ? '' : String(rawValue);
        return coerceByDeclaredType(obj, rawValue, currentValue);
    };

    const booleanTokens = {
        true: ['true', '1', 'on', 'yes', 'ja', 'enabled', 'enable', 'active', 'start', 'open', 'ein', 'an'],
        false: ['false', '0', 'off', 'no', 'nein', 'disabled', 'disable', 'inactive', 'stop', 'closed', 'aus'],
    };

    const stringTogglePairs = [
        ['off', 'on'], ['false', 'true'], ['0', '1'], ['disabled', 'enabled'], ['disable', 'enable'],
        ['inactive', 'active'], ['stop', 'start'], ['closed', 'open'], ['aus', 'ein'], ['nein', 'ja'],
    ];

    const findBooleanStateKey = (states, desired) => {
        const normalized = normalizeStates(states);
        if (!normalized) return undefined;
        const tokens = desired ? booleanTokens.true : booleanTokens.false;
        for (const [key, label] of Object.entries(normalized)) {
            if (tokens.includes(normalizeText(key)) || tokens.includes(normalizeText(label))) return key;
        }
        return undefined;
    };

    const getStringToggleValue = (currentValue, desired) => {
        const raw = String(currentValue == null ? '' : currentValue).trim();
        const current = normalizeText(raw);
        let result = desired ? 'true' : 'false';
        for (const [falseToken, trueToken] of stringTogglePairs) {
            if (current === falseToken || current === trueToken) {
                result = desired ? trueToken : falseToken;
                break;
            }
        }
        if (raw && raw === raw.toUpperCase()) return result.toUpperCase();
        if (raw && raw[0] === raw[0].toUpperCase() && raw.slice(1) === raw.slice(1).toLowerCase()) {
            return result.charAt(0).toUpperCase() + result.slice(1);
        }
        return result;
    };

    const getDirectWriteValue = (id, obj, item, behavior, currentValue) => {
        const common = getCommon(obj);
        const desired = behavior === 'button' ? true : !toBoolean(currentValue);
        const explicitName = behavior === 'button' ? 'manualTriggerValue' : desired ? 'manualTrueValue' : 'manualFalseValue';
        const explicit = getExplicitValue(obj, explicitName);
        if (explicit !== undefined) return coerceByDeclaredType(obj, explicit, currentValue);

        const stateKey = findBooleanStateKey(common.states, desired);
        if (stateKey !== undefined) return coerceStateKey(obj, stateKey, currentValue);

        if (behavior === 'button' && common.def !== undefined && common.def !== null) {
            return coerceByDeclaredType(obj, common.def, currentValue);
        }

        const declared = normalizeCommonType(common.type);
        if (declared === 'number') {
            if (behavior === 'switch') {
                if (desired && typeof common.max === 'number') return common.max;
                if (!desired && typeof common.min === 'number') return common.min;
            }
            return desired ? 1 : 0;
        }
        if (declared === 'string') return getStringToggleValue(currentValue, desired);
        if (declared === 'object' || declared === 'array' || declared === 'json') {
            throw new Error('Objekt-/Array-Befehle müssen über den Wertdialog gesetzt werden.');
        }
        if (declared === 'mixed') {
            if (typeof currentValue === 'number') return desired ? 1 : 0;
            if (typeof currentValue === 'string') return getStringToggleValue(currentValue, desired);
        }
        return desired;
    };

    const getWriteBehavior = (id, obj, item, expertMode) => {
        if (!obj || obj.type !== 'state') return 'readonly';
        const common = getCommon(obj);
        if (common.write === false) return 'readonly';
        if (isExpertOnlyState(id, obj) && !expertMode) return 'expert-only';
        if (normalizeCommonType(common.type) === 'file') return 'file';

        const role = normalizeText(common.role);
        const data = item && item.data ? item.data : {};
        const declared = normalizeCommonType(common.type);
        const explicitControl = normalizeText(
            getExplicitValue(obj, 'manualWriteControl') !== undefined
                ? getExplicitValue(obj, 'manualWriteControl')
                : getExplicitValue(obj, 'manualControl'),
        );
        if (['button', 'trigger', 'action'].includes(explicitControl) && !['object', 'array', 'json'].includes(declared)) return 'button';
        if (['dialog', 'value', 'editor'].includes(explicitControl)) return 'dialog';
        if (['switch', 'toggle'].includes(explicitControl)) return 'switch';

        const normalizedStates = normalizeStates(common.states);
        const stateCount = normalizedStates ? Object.keys(normalizedStates).length : 0;
        const isButton = Boolean(data.button) || role === 'button' || role.startsWith('button.') || role === 'action' || role.startsWith('action.') || role === 'trigger' || role.startsWith('trigger.');
        if (isButton && declared !== 'object' && declared !== 'array' && declared !== 'json') return 'button';
        if (declared === 'boolean') return 'switch';
        // A numeric/string mode with more than two states is a selector, not a
        // toggle. Treating it as a switch would make only two of its values reachable.
        if ((Boolean(data.switch) || role === 'switch' || role.startsWith('switch.')) && stateCount <= 2) return 'switch';
        return 'dialog';
    };

    const getWriteLabel = (id, obj, behavior, expertMode, hasState) => {
        if (behavior === 'readonly') return 'Nur lesbar';
        if (behavior === 'expert-only') return 'Nur im Expertenmodus beschreibbar';
        if (behavior === 'button') return 'Befehl auslösen';
        if (behavior === 'switch') return 'Schalten';
        if (!hasState) return 'Wert setzen (schreibender Datenpunkt ohne aktuellen Lesewert)';
        return 'Wert bearbeiten';
    };

    const writeManualState = (socket, id, value) => {
        if (!socket || typeof socket.setState !== 'function') {
            return Promise.reject(new Error('ioBroker socket is not ready'));
        }
        const key = String(id || '');
        if (!key) return Promise.reject(new Error('Missing datapoint ID'));
        if (value === undefined) return Promise.reject(new Error(`Undefined is not a valid state value for ${key}`));
        if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
            return Promise.reject(new Error(`Unsupported state value type for ${key}: ${typeof value}`));
        }

        const previous = writeQueues.get(key) || Promise.resolve();
        const operation = previous.catch(() => undefined).then(() => {
            let timeoutHandle;
            const write = Promise.resolve().then(() => socket.setState(key, { val: value, ack: false, q: 0 }));
            const timeout = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error(`Write timeout for ${key}`)), 15000);
            });
            return Promise.race([write, timeout]).finally(() => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
            });
        });
        const tail = operation.finally(() => {
            if (writeQueues.get(key) === tail) writeQueues.delete(key);
        });
        writeQueues.set(key, tail);
        return operation;
    };

    return {
        getExplicitExpertOnly,
        isExpertOnlyState,
        getWriteBehavior,
        getWriteLabel,
        resolveEditorType,
        prepareEditorValue,
        coerceWriteValue,
        getDirectWriteValue,
        toBoolean,
        writeManualState,
        normalizeStates,
        normalizeCommonType,
    };
});
