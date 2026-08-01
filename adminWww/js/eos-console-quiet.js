(() => {
    'use strict';
    window.NEXOWATT_EOS_CONSOLE_QUIET_VERSION = 'v73-runtime';
    // Diagnostic output is intentionally left untouched in the stability release.
    // Suppressing broad console prefixes hid important performance and runtime clues.
    window.NEXOWATT_EOS_RESTORE_CONSOLE = () => undefined;
})();
