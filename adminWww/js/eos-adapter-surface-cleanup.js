(() => {
    'use strict';

    const VERSION = 'v65-native-drawer-header-hard-remove';
    window.NEXOWATT_EOS_ADAPTER_SURFACE_CLEANUP_VERSION = VERSION;

    const previous = window.__NEXOWATT_EOS_ADAPTER_SURFACE_CLEANUP_RUNTIME__;
    if (previous?.version === VERSION) return;
    previous?.stop?.();

    const controller = new AbortController();
    const signal = controller.signal;
    let observer = null;
    let timer = 0;

    const routeIsAdapters = () => /tab-adapters\b/.test(String(window.location.hash || '').toLowerCase());
    const safe = fn => { try { return fn(); } catch { return undefined; } };
    const text = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();

    const SORT_NEEDLE = /\b(Titel|Title|Name|Beliebte zuerst|Popular first|Kürzlich aktualisiert|Kuerzlich aktualisiert|Recently updated|Description A-Z|Name A-Z)\b/i;
    const CATEGORY_NEEDLE = /\b(Alle|All|Kommunikation|Communication|Energie|Energy|Fahrzeug|Vehicle|Garten|Garden|Geoposition|Hardware|Haushalt|Household|Infrastruktur|Infrastructure|Logik|Logic|Messung|Metering|Multimedia|Netzwerk|Network|Protokolle|Protocols|Sonstige|General|Visualisierung|Visualization|Visualisierungssymbole|visualization-icons|Messaging|Klima|Climate)\b/i;

    const paperOf = root => root?.querySelector?.('.MuiMenu-paper,.MuiPopover-paper,.MuiPaper-root,[role="menu"],[role="listbox"]') || root;
    const itemsOf = root => Array.from(root?.querySelectorAll?.('.MuiMenuItem-root,[role="menuitem"],li') || []);

    const isAdapterFilterMenu = root => {
        if (!root || !routeIsAdapters()) return false;
        if (root.closest?.('.MuiDialog-root,.MuiDialog-paper,[role="dialog"]')) return false;
        const items = itemsOf(root);
        if (!items.length) return false;
        const hasTagCard = items.some(item => Array.from(item.classList || []).some(cls => cls.startsWith('tag-card-')));
        const content = text(root);
        return hasTagCard || SORT_NEEDLE.test(content) || (items.length > 8 && CATEGORY_NEEDLE.test(content));
    };

    const isOrphanedOrMisplaced = root => {
        const paper = paperOf(root);
        const rect = paper?.getBoundingClientRect?.();
        if (!rect) return false;
        const content = text(root);
        const hasSort = SORT_NEEDLE.test(content);
        const hasCategory = CATEGORY_NEEDLE.test(content)
            || itemsOf(root).some(item => Array.from(item.classList || []).some(cls => cls.startsWith('tag-card-')));
        const nearLeftNavigation = rect.left < 230;
        const nearTopHeader = rect.top < 165;
        const tooTallLeftRail = hasCategory && nearLeftNavigation && rect.height > 160;
        const wrongTopSortBox = hasSort && nearLeftNavigation && nearTopHeader;
        const disconnectedAnchorSymptom = nearLeftNavigation && (hasSort || hasCategory) && rect.width <= 260;
        return tooTallLeftRail || wrongTopSortBox || disconnectedAnchorSymptom;
    };

    const suppressRoot = root => safe(() => {
        root.classList.add('eos-adapter-filter-menu-stale');
        root.setAttribute('aria-hidden', 'true');
        root.style.pointerEvents = 'none';
        root.style.visibility = 'hidden';
        root.style.opacity = '0';
        root.style.display = 'none';
        const paper = paperOf(root);
        if (paper && paper !== root) {
            paper.classList.add('eos-adapter-filter-menu-stale-paper');
            paper.style.pointerEvents = 'none';
            paper.style.visibility = 'hidden';
            paper.style.opacity = '0';
            paper.style.display = 'none';
        }
    });

    const releaseRoot = root => safe(() => {
        if (!root.classList.contains('eos-adapter-filter-menu-stale')) return;
        root.classList.remove('eos-adapter-filter-menu-stale');
        root.removeAttribute('aria-hidden');
        ['pointerEvents', 'visibility', 'opacity', 'display'].forEach(prop => { root.style[prop] = ''; });
        const paper = paperOf(root);
        if (paper && paper !== root) {
            paper.classList.remove('eos-adapter-filter-menu-stale-paper');
            ['pointerEvents', 'visibility', 'opacity', 'display'].forEach(prop => { paper.style[prop] = ''; });
        }
    });

    const cleanupAdapterMenus = () => safe(() => {
        if (!routeIsAdapters()) return;
        const roots = Array.from(document.querySelectorAll('.MuiMenu-root,.MuiPopover-root,body > [role="presentation"]'));
        roots.forEach(root => {
            if (!isAdapterFilterMenu(root)) {
                releaseRoot(root);
                return;
            }
            root.classList.add('eos-adapter-filter-menu');
            if (isOrphanedOrMisplaced(root)) suppressRoot(root);
            else releaseRoot(root);
        });
    });

    const schedule = (delay = 0) => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            timer = 0;
            cleanupAdapterMenus();
        }, delay);
    };

    const onHashChange = () => schedule(0);
    const onResize = () => schedule(100);
    const onScroll = () => { if (routeIsAdapters()) schedule(120); };
    const onClick = () => { if (routeIsAdapters()) schedule(0); };
    const onKeyUp = event => { if (event.key === 'Escape' && routeIsAdapters()) schedule(0); };

    const install = () => {
        schedule(0);
        schedule(250);
        schedule(1000);
        window.addEventListener('hashchange', onHashChange, { signal });
        window.addEventListener('resize', onResize, { passive: true, signal });
        window.addEventListener('scroll', onScroll, { capture: true, passive: true, signal });
        document.addEventListener('click', onClick, { capture: true, signal });
        document.addEventListener('keyup', onKeyUp, { capture: true, signal });
        observer = new MutationObserver(mutations => {
            if (!routeIsAdapters()) return;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes?.length) {
                    schedule(40);
                    break;
                }
            }
        });
        observer.observe(document.documentElement, { subtree: true, childList: true });
    };

    const stop = () => {
        if (timer) window.clearTimeout(timer);
        timer = 0;
        observer?.disconnect();
        observer = null;
        controller.abort();
    };
    window.__NEXOWATT_EOS_ADAPTER_SURFACE_CLEANUP_RUNTIME__ = { version: VERSION, stop };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true, signal });
    else install();
})();
