(() => {
    'use strict';
    window.NEXOWATT_EOS_CONSOLE_QUIET_VERSION = 'v79-direct-control-runtime-fix';
    // Diagnostic output is intentionally left untouched in the stability release.
    // Suppressing broad console prefixes hid important performance and runtime clues.
    window.NEXOWATT_EOS_RESTORE_CONSOLE = () => undefined;
})();
