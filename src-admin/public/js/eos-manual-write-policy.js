/* NexoWatt EOS manual datapoint write policy v7.9.75 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (!root) return;

    root.NEXOWATT_EOS_MANUAL_WRITE_POLICY_VERSION = 'v75-type-aware-manual-controls';
    root.NEXOWATT_EOS_GET_WRITE_BEHAVIOR = api.getWriteBehavior;
    root.NEXOWATT_EOS_IS_EXPERT_ONLY_STATE = api.isExpertOnlyState;
    root.NEXOWATT_EOS_COERCE_BOOLEAN = api.toBoolean;
    root.NEXOWATT_EOS_WRITE_MANUAL_STATE = api.writeManualState;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null, function () {
    'use strict';

    const pendingWrites = new Map();

    const normalizeText = value => String(value == null ? '' : value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const flattenTranslatedText = value => {
        if (value == null) return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') return Object.values(value).map(flattenTranslatedText).join(' ');
        return '';
    };

    const getExplicitExpertOnly = obj => {
        const common = obj && obj.common ? obj.common : {};
        const native = obj && obj.native ? obj.native : {};
        const custom = common.custom || {};
        const candidates = [
            common.manualWriteExpertOnly,
            common.expertOnly,
            native.manualWriteExpertOnly,
            native.nexowatt && native.nexowatt.manualWriteExpertOnly,
            custom.nexowatt && custom.nexowatt.manualWriteExpertOnly,
            custom['nexowatt.eos'] && custom['nexowatt.eos'].manualWriteExpertOnly,
            custom['eos-admin'] && custom['eos-admin'].manualWriteExpertOnly,
        ];
        for (const value of candidates) {
            if (typeof value === 'boolean') return value;
        }
        return undefined;
    };

    const isExpertOnlyState = (id, obj) => {
        const explicit = getExplicitExpertOnly(obj);
        if (explicit !== undefined) return explicit;

        const common = obj && obj.common ? obj.common : {};
        const role = normalizeText(common.role);
        const text = normalizeText([
            id,
            role,
            common.type,
            flattenTranslatedText(common.name),
            flattenTranslatedText(common.desc),
        ].join(' '));
        const compact = text.replace(/[^a-z0-9]+/g, '');

        // Writable raw power/current commands are never exposed in normal mode.
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
        const normalized = normalizeText(value).trim();
        if (['true', '1', 'on', 'yes', 'ja', 'enabled', 'active'].includes(normalized)) return true;
        if (['false', '0', 'off', 'no', 'nein', 'disabled', 'inactive', '', 'null', '(null)'].includes(normalized)) return false;
        return Boolean(value);
    };

    const getWriteBehavior = (id, obj, item, expertMode) => {
        if (!obj || obj.type !== 'state') return 'readonly';
        const common = obj.common || {};
        if (common.write === false) return 'readonly';
        if (isExpertOnlyState(id, obj) && !expertMode) return 'expert-only';
        if (common.type === 'file') return 'file';

        const role = normalizeText(common.role);
        const data = item && item.data ? item.data : {};
        const isButton = Boolean(data.button) || role === 'button' || role.startsWith('button.') || role === 'action' || role.startsWith('action.');
        if (isButton) return 'button';
        if (Boolean(data.switch) || role === 'switch' || role.startsWith('switch.') || common.type === 'boolean') return 'switch';
        return 'dialog';
    };

    const writeManualState = (socket, id, value) => {
        if (!socket || typeof socket.setState !== 'function') {
            return Promise.reject(new Error('ioBroker socket is not ready'));
        }
        const key = String(id || '');
        if (!key) return Promise.reject(new Error('Missing datapoint ID'));
        if (pendingWrites.has(key)) return pendingWrites.get(key);

        let timeoutHandle;
        const operation = Promise.resolve().then(() => socket.setState(key, { val: value, ack: false, q: 0 }));
        const timeout = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(`Write timeout for ${key}`)), 15000);
        });
        const promise = Promise.race([operation, timeout])
            .finally(() => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                pendingWrites.delete(key);
            });
        pendingWrites.set(key, promise);
        return promise;
    };

    return {
        getExplicitExpertOnly,
        isExpertOnlyState,
        getWriteBehavior,
        toBoolean,
        writeManualState,
    };
});
