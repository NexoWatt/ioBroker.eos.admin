(function () {
    'use strict';
    // NexoWatt EOS v36: compatibility stub.
    // The custom hard-logout timer was removed because it could expire sessions
    // earlier than the configured admin TTL and broke native adapter dialogs.
    // Session handling is now delegated to the same OAuth/session flow as the
    // upstream ioBroker Admin.
    const VERSION = '36';
    function noop() {}
    window.NEXOWATT_EOS_HARD_LOGOUT = {
        version: VERSION,
        checkSession: noop,
        hardLogout: noop,
        clearStoredTokens: noop,
        clearAuthCookies: noop,
        disabled: true,
    };
})();
