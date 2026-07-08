(() => {
    'use strict';

    /**
     * v54: passive objects helper.
     *
     * Do not capture value-cell clicks, do not rewrite ObjectBrowser titles and
     * do not run MutationObserver scans on the datapoints table. The ioBroker
     * ObjectBrowser is responsible for read/write handling via common.write.
     */
    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_VERSION = 'v54-native-admin-datapoints';
    window.NEXOWATT_EOS_OBJECTS_STATE_TOOLS_MODE = 'passive-native-objectbrowser';

    try {
        delete window.NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED;
    } catch {
        window.NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED = undefined;
    }
})();
