'use strict';
// Compatibility resource for cached Admin HTML. License management now lives in System → EOS Home / Pro.
// Do not create another floating control or independently fetch authentication state.
(() => {
    const removeLegacyLink = () => {
        document.querySelectorAll('a[href="/nexowatt/license"]').forEach(link => {
            if (link.style.position === 'fixed') link.remove();
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', removeLegacyLink, { once: true });
    else removeLegacyLink();
})();
