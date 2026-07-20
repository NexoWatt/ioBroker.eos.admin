# NexoWatt EOS Admin v7.9.66

The unwanted top-left tab was traced to `App.renderToolbar()`: the upstream desktop `MenuIcon` and compact `/#easy` logo identity. Previous versions targeted the wrong `Drawer.getHeader()` element. v66 removes the exact source in TypeScript, the active frontend bundle, and a precise runtime/CSS fallback. Mobile navigation remains intact.
