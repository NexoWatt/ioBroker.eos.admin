# Release Notes – NexoWatt EOS Admin 7.9.98

## Übersicht und Bedienung

- Der Cockpit-Inhalt kann jetzt bis zum letzten Element vertikal gescrollt werden.
- Header und Hauptnavigation bleiben währenddessen stehen.
- Die EMS-Live-Diagnose, aktuelle Regelentscheidungen, Ereignisse und nachfolgende Adapterkarten werden nicht mehr am unteren Fensterrand abgeschnitten.

## Anmeldung

- Überlappende MUI-Feldbeschriftungen wurden entfernt.
- Loginname und Passwort verwenden klar erkennbare Platzhalter.
- Die Anmeldekarte wurde nur moderat vergrößert und wächst bei einer Fehlermeldung automatisch.
- Innere horizontale und vertikale Scrollleisten bleiben ausgeschlossen.

## Konten und Kennwörter

- Ein Kontoreset schreibt das reale ioBroker-Kontopasswort auf `nexowatt`.
- Der Passwortschreibvorgang wird mit der Controller-Passwortprüfung verifiziert, bevor Erfolg gemeldet wird.
- Die EOS-Erstanmeldungsmerkmale werden ausschließlich als Metadaten erweitert; der zuvor geschriebene Passwort-Hash wird nicht durch ein altes Benutzerobjekt überschrieben.
- Admin/Service darf verwaltete Installateur- und Endkundenkonten zurücksetzen.
- Installateure dürfen ausschließlich ausdrücklich zugeordnete Endkundenkonten zurücksetzen.
- Admin-, Eigen-, deaktivierte und nicht verwaltete Konten werden weiterhin abgewiesen.
- Die persönliche Passwortvergabe nach der Anmeldung mit `nexowatt` schreibt und prüft ebenfalls das reale Benutzerkennwort.
- Nach erfolgreicher Passwortvergabe werden vorhandene Anmeldesitzungen beendet und der Erstanmeldungsstatus entfernt.

## Stabilität und Aktualisierung

- Paket-, Lockfile-, io-package-, Frontend- und Repository-Versionen werden vor der Veröffentlichung auf `7.9.98` synchronisiert.
- Alte Stable-Laufzeitdateien wie v97 werden beim Merge-Update automatisch entfernt.
- Die EMS-Live-Diagnose bleibt read-only.
- EOS Assist bleibt deaktiviert.
