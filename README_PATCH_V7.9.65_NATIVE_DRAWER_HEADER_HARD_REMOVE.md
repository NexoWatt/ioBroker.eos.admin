# NexoWatt EOS Admin v7.9.65 – Native Drawer Header Hard Remove

The small floating NexoWatt tab at the upper-left was the original desktop ioBroker Drawer header.

This release removes it at three levels:

1. React source: desktop `Drawer.getHeader()` returns `null`.
2. Active compiled bootstrap: the same desktop render path is disabled.
3. Branding fallback: every MUI drawer is scanned by the exact `/#easy` link plus chevron structure and hidden if an older cached runtime recreates it.

The independent round EOS navigation toggle remains active. Mobile swipeable drawers retain their native close header.
