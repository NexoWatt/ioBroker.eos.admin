(() => {
    'use strict';
    window.NEXOWATT_EOS_PERFORMANCE_GUARD_VERSION = 'v58-admin-stability-delete-version-fix-noop';
    // No-op compatibility shim. Older v53/v52 files installed aggressive DOM
    // observers here. Keeping the filename neutralizes stale ioBroker file-cache
    // references without touching ObjectBrowser, tooltips, clicks or state writes.
})();
