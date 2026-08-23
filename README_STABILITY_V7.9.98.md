# NexoWatt EOS Admin 7.9.98 – Stable-Verkaufskandidat

Version 7.9.98 beseitigt die vier zuletzt auf dem realen EOS-Testsystem festgestellten Verkaufsblocker, ohne die funktionierende EMS-Live-Diagnose oder die bestehenden Rollenrechte zu erweitern.

## Korrigierte Bereiche

- **Cockpit vollständig bedienbar:** Der Kopf- und Navigationsbereich bleibt stehen; ausschließlich der Inhaltsbereich der Übersicht erhält einen vertikalen Scrollbereich. Dadurch sind auch lange EMS-Ereignislisten und die unteren Adapterkarten erreichbar.
- **Saubere Anmeldung:** Loginname und Passwort verwenden feste Platzhalter statt kollidierender Floating Labels. Die Karte ist moderat größer, wächst bei Fehlermeldungen automatisch und besitzt keine innere horizontale oder vertikale Scrollleiste.
- **Reales Kontopasswort beim Reset:** Ein zulässiger Reset schreibt das Startpasswort `nexowatt` mit der ioBroker-Passwortschnittstelle in das tatsächliche Benutzerkonto. Die EOS-Erstanmeldungsmerkmale werden getrennt davon aktualisiert, damit der neue Passwort-Hash nicht wieder überschrieben wird.
- **Persönliches Passwort nach der ersten Anmeldung:** Das neue Kennwort wird serverseitig validiert, in das reale Benutzerkonto geschrieben, anschließend geprüft und erst danach wird der Erstanmeldungsstatus beendet.
- **Saubere Rollenbegrenzung:** Admin/Service darf verwaltete Installateur- und Endkundenkonten zurücksetzen. Installateure dürfen ausschließlich ausdrücklich zugeordnete Endkundenkonten zurücksetzen. Admin-, Eigen-, deaktivierte und nicht verwaltete Konten bleiben geschützt.

## Unveränderte Produktregeln

- Die EMS-Live-Kachel ist ausschließlich lesend und verändert keine Regelung, Geräte- oder Sollwerte.
- Der NexoWatt UI Adapter stellt die Diagnosewerte weiterhin unter `nexowatt-ui.*.info.adminOverview.*` bereit.
- EOS Assist bleibt bis zur vollständigen Neuimplementierung deaktiviert.
- Standardport des EOS Admin bleibt `8081`.

## Freigabestatus

Alle paketinternen Prüfungen, die isolierte Browser-Geometrieprüfung, der simulierte Passwortablauf und der npm-Publish-Dry-Run müssen erfolgreich sein. Vor dem Verkauf ist zusätzlich die Checkliste in `RELEASE_ACCEPTANCE_V7.9.98.md` einmal auf einem realen EOS-Testcontroller abzuarbeiten.
