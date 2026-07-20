(() => {
    'use strict';

    window.NEXOWATT_EOS_TOOLBAR_CLEANUP_VERSION = 'v69-v57-header-restore';

    const PRIMARY_SELECTOR = '.eos-brand-badge, .eos-system-brand, [data-eos-primary-brand="true"]';
    const HIDDEN_CLASS = 'eos-native-compact-identity-hidden';

    const hide = element => {
        if (!element || element.matches?.(PRIMARY_SELECTOR) || element.closest?.(PRIMARY_SELECTOR) || element.querySelector?.(PRIMARY_SELECTOR)) return;
        const text = `${element.textContent || ''} ${element.getAttribute?.('aria-label') || ''} ${element.getAttribute?.('title') || ''}`.toLowerCase();
        if (text.includes('nexowatt eos') || text.includes('energy operation system')) return;
        element.classList.add(HIDDEN_CLASS);
        element.setAttribute('aria-hidden', 'true');
        element.setAttribute('inert', '');
        element.querySelectorAll?.('a,button,[role="button"],input,select,textarea').forEach(control => {
            control.setAttribute('tabindex', '-1');
            control.setAttribute('aria-hidden', 'true');
        });
    };

    const directChild = (container, node) => {
        let current = node;
        while (current?.parentElement && current.parentElement !== container) current = current.parentElement;
        return current?.parentElement === container ? current : null;
    };

    const cleanToolbar = toolbar => {
        if (!toolbar) return;
        const children = Array.from(toolbar.children || []);
        children.forEach((child, index) => {
            if (!child?.querySelector || child.matches(PRIMARY_SELECTOR) || child.querySelector(PRIMARY_SELECTOR)) return;
            const easy = child.querySelector('a[href*="#easy"], a[href*="/easy"]');
            if (!easy) return;
            hide(child);

            const previous = children[index - 1];
            if (previous && !previous.matches(PRIMARY_SELECTOR) && !previous.querySelector?.(PRIMARY_SELECTOR)) {
                const rect = previous.getBoundingClientRect?.();
                const isSmallControl = previous.matches?.('button,.MuiIconButton-root') || !!previous.querySelector?.('button,.MuiIconButton-root');
                const hasMenuOrChevron = !!previous.querySelector?.('svg[data-testid="MenuIcon"],svg[data-testid="ChevronLeftIcon"],svg[data-testid="ChevronRightIcon"]');
                if (isSmallControl && (hasMenuOrChevron || !rect || (rect.width <= 72 && rect.height <= 72))) hide(previous);
            }
        });
    };

    const cleanDrawer = drawer => {
        if (!drawer) return;
        drawer.querySelectorAll('a[href*="#easy"], a[href*="/easy"]').forEach(link => {
            const child = directChild(drawer, link);
            if (!child || child.classList?.contains('MuiList-root') || child.querySelector?.('.MuiListItemButton-root')) return;
            hide(child);
        });
    };

    const cleanByGeometry = () => {
        if (!window.matchMedia('(min-width: 901px)').matches) return;
        document.querySelectorAll('a[href*="#easy"], a[href*="/easy"]').forEach(link => {
            if (link.closest(PRIMARY_SELECTOR)) return;
            const rect = link.getBoundingClientRect?.();
            const alt = Array.from(link.querySelectorAll?.('img') || []).map(img => img.alt || '').join(' ').toLowerCase();
            const text = `${link.textContent || ''} ${alt}`.trim().toLowerCase();
            if (!rect || rect.top > 105 || rect.left > 240 || rect.width > 220 || rect.height > 90) return;
            if (text.includes('nexowatt eos') || text.includes('energy operation system')) return;
            let candidate = link;
            for (let i = 0; i < 5 && candidate.parentElement; i += 1) {
                const parent = candidate.parentElement;
                if (parent.matches(PRIMARY_SELECTOR) || parent.querySelector(PRIMARY_SELECTOR)) break;
                const r = parent.getBoundingClientRect?.();
                if (!r || r.top > 105 || r.left > 240 || r.width > 240 || r.height > 95) break;
                candidate = parent;
                if (parent.matches('.MuiToolbar-root,.MuiDrawer-paper,.MuiAppBar-root')) break;
            }
            if (!candidate.matches('.MuiToolbar-root,.MuiDrawer-paper,.MuiAppBar-root')) hide(candidate);
        });
    };

    let scheduled = false;
    const run = () => {
        scheduled = false;
        if (!document.getElementById('app-paper')) return;
        document.querySelectorAll('.MuiAppBar-root .MuiToolbar-root, header .MuiToolbar-root').forEach(cleanToolbar);
        document.querySelectorAll('.MuiDrawer-paper, .MuiSwipeableDrawer-paper').forEach(cleanDrawer);
        cleanByGeometry();
    };
    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(run);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
    else schedule();

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('hashchange', schedule, { passive: true });
    setTimeout(schedule, 250);
    setTimeout(schedule, 1000);
    setTimeout(schedule, 3000);
})();
