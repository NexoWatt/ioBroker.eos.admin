# Typisierte GUI-8-Dialoganbindung

Die sechs unsicheren Doppelcasts auf `React.ComponentType<any>` in `src-admin/src/tabs/Objects.tsx` sind entfernt. Jeder Erweiterungspunkt wird nun direkt aus `React.ComponentProps<typeof ObjectBrowser>` abgeleitet und durch eine stabile, vom Compiler geprüfte Komponente bedient. Die eigenen Dialoge bekommen die tatsächliche AdminConnection des Tabs; sie müssen keinen allgemeineren Connection-Parameter ungeprüft als AdminConnection behandeln. Optionale Bildschirmbreite bekommt den definierten Standard `md`.

Der Dateibetrachter benötigt vom Objekt nur `_id`; sein Vertrag drückt jetzt genau das aus. Der Aliaseditor akzeptiert die tatsächliche Tabelle allgemeiner ioBroker-Objekte und liest Aliase nur aus State-Objekten. Ein als Aliasziel übergebenes Nicht-State-Objekt wird vor dem Editor mit einer schließbaren Meldung abgewiesen. Gültige State-/Aliasbedienung, Wertdialog, manuelle Schreibprüfung und die Rollenfreigaben bleiben erhalten.

Auch die bisherigen expliziten `any` im Objects-Tab sind durch genaue Löschdialog-/Filter-/Übersetzungstypen und den vorhandenen Window-Storage-Vertrag ersetzt. Gespeicherte Filter werden als unbekannte Daten angenommen und nur nach Typprüfung in den GUI-Vertrag übernommen. Es werden weder unbekannte Filterfelder noch falsche Werteformen übernommen. Die Dialogimplementierungen für Wertschreiben und Objektspeicherung wurden dadurch nicht geändert.

Tatsächlich durchgeführt: vollständige Frontend-TypeScript-Prüfung (`npm run check-ts`), ESLint auf den drei geänderten Dateien ohne Fehler oder Warnungen, sowie bestehende ObjectBrowser-Regression mit 55 Assertions bestanden. Browser-/Anlagennachweise erfolgen im Gesamtnachweis nach dem abschließenden Frontend-Neubuild; diese Typprüfung ersetzt sie nicht.

Zusätzlich wurde die native Proxydatei ohne Lint-Unterdrückungen formatiert: identische Steuerzeichen-Abweisung jetzt ohne problematische Kontrollzeichen-RegEx, Fehlernormalisierung an der Promise-Grenze und eindeutig geordnete Cleanup-Funktionen. Proxy-ESLint und strikte TypeScript-Einzelprüfung bestanden; alle elf lokalen Transporttests wurden danach erneut erfolgreich ausgeführt.
