(() => {
    'use strict';

    /**
     * v53: native ObjectBrowser write mode
     *
     * The earlier EOS fast-write fallback captured value-cell clicks before the
     * ioBroker ObjectBrowser could process them. That made the UI look writable
     * for every state and caused unreliable writes on large object trees.
     *
     * From v53 on, this helper is intentionally passive: it only publishes a
     * version marker and removes the unrestricted writer from older cached
     * sessions. The original ioBroker ObjectBrowser decides writability via
     * common.write and performs the state write through socket.setState.
     */
    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_VERSION = 'v53-native-objectbrowser-write';
    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_MODE = 'native-objectbrowser';

    try {
        delete window.NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED;
    } catch {
        window.NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED = undefined;
    }

    try {
        document.documentElement.classList.remove('eos-dp-write-ready');
    } catch {
        // ignore
    }
})();
