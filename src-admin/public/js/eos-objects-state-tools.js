(() => {
    'use strict';

    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_VERSION = 'v64-cache-build-consistency-hardening';
    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_MODE = 'passive-native-objectbrowser';

    // Keep this file intentionally passive. The datapoints page must use the
    // native ioBroker ObjectBrowser and ObjectBrowserValue dialog semantics:
    // common.write === false => read-only, otherwise writable.
    delete window.NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED;
    delete window.NEXOWATT_EOS_FORCE_DP_WRITE_DIALOG;
    delete window.NEXOWATT_EOS_DP_WRITE_CAPTURE;

    document.documentElement.classList.add('eos-native-objectbrowser-write');
})();
