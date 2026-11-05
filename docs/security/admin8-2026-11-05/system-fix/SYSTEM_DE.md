# EOS Admin 8.0.2 – Systembereich und Lizenzverwaltung

Stand: 05.11.2026. Ausgangsstand: vollständiges EOS-Admin-8.0.1-Repository mit Login-Korrektur. Nutzerbericht: Anmeldung funktioniert, Expertenmodus und Systemeinstellungen fehlen. Die Navigations-/Rollenkorrektur wird separat in diesem Nachweisverzeichnis beschrieben.

## Gewünschtes und erhaltenes Verhalten

- Der native Systemdialog bleibt erhalten: Kunden-/Anlagenname, Sprache, Temperatur, Währung, Datums-/Zahlenformat, Historie, Expertenmodus, Standort mit Land/Stadt/Koordinaten, sowie die vorhandenen System-Unterbereiche.
- Der im Screenshot für den Kundennamen verwendete Anlagenname bleibt unverändert in `system.config.common.siteName`. Nur die Beschriftung wird deutlicher. Es gibt keine neue Kundendatenablage, kein Überschreiben vorhandener Standortwerte und keine Migration von Namen.
- Der eigene Systemreiter **EOS Home / Pro** enthält die zentrale Lizenzverwaltung. Der frühere schwebende Link wird nicht mehr erzeugt. Die bestehende direkte Verwaltungsadresse bleibt als Kompatibilitäts-/Wartungsweg erhalten.
- Die bisherige Plattform-Lizenzansicht bleibt als **Adapter-Lizenzen** bestehen, soweit der Controller diese unterstützt. EOS-Lizenzen werden nicht dort abgelegt.
- Fehler beim Laden lassen den Dialog nicht dauerhaft im Ladezustand hängen. Eine erneute Ladeaktion ist möglich. Nach einem Speicherfehler bleibt der bearbeitete Entwurf erhalten und die Bedienung wird wieder freigegeben; die Meldung berücksichtigt, dass der bestehende Speichervorgang mehrere Objekte schreibt und ein Teil bereits gespeichert sein kann.
- Der EOS-Lizenzreiter kann auch bei fehlgeschlagenem Laden anderer Systemeinstellungen geöffnet werden. Lizenzaktionen erfolgen unmittelbar, unabhängig von „Speichern und schließen“.

## Sicherheitsgrenzen

- Der EOS-Reiter wird nur für die vom Server ermittelte Rolle `admin` angeboten. Die vorhandene serverseitige Lizenzautorisierung bleibt entscheidend und unverändert; versteckte Bedienelemente sind kein Zugriffsschutz.
- Bestehende API: `/nexowatt/license/status`, `/activate`, `/remove`; Cookie-Authentifizierung, HTTPS außerhalb Loopback, Prüfung desselben Ursprungs und `X-EOS-License: 1` für Schreibaktionen, Raten-/Körperlimits. Die native Oberfläche verwendet relative lokale Endpunkte und erhält damit ein vorhandenes URL-Präfix des Admins.
- Home/Pro, UUID, Gültigkeit und Freigaben werden ausschließlich aus der Antwort der bestehenden Lizenzprüfung dargestellt. Kein neuer Schlüssel, Lizenzspeicher oder Prüfmechanismus. Signatur-/UUID-Prüfung und verschlüsselte Speicherung bleiben im vorhandenen Backend.
- Aktivierungscodes werden nicht in Browser-Speicher geschrieben; nach Auslösen der Aktivierung wird das Eingabefeld geleert. Gespeicherte Codes und Schlüsselmaterial werden nicht angezeigt. Die Antwort wird auf bekannte öffentliche Statusfelder projiziert.
- Ein HTTP-/Format-/Transportfehler erzeugt **keinen** erfundenen „keine Lizenz“-Status. Der Status wird als unbestätigt angezeigt. Ein ungültiger Import ersetzt weiterhin keine gültige Lizenz im Backend. Ohne gültige Antwort wird keine Aktivierung als erfolgreich gemeldet.
- Fünf Sekunden Gesamtbudget inklusive Antwortkörper, aktiver Abbruch, maximal 64 KiB Antwort, keine Weiterleitungen, Abbruch beim Verlassen des Reiters und Verwerfen verspäteter Antworten. Entfernung erfordert eine explizite Bestätigung mit Hinweis auf die Adapterfreigabe.
- Vorhandene entfernte Kartendienste im Systemdialog sind unverändert. Die lokale Systemkonfiguration und Lizenzverwaltung benötigen dafür keinen neuen Cloud-Dienst.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis | Beleg / Grenze |
| --- | --- | --- |
| ESLint für geänderte/neue System-TS/TSX-Dateien | bestanden | projektkonforme Regeln, kein neues Lint-Problem |
| Frontend-Typprüfung mit dem festgelegten Frontend-TypeScript | bestanden | `node src-admin/node_modules/typescript/bin/tsc --project src-admin/tsconfig.json --noEmit` |
| 11 Verhaltenstests Node.js 22.23.4 | 11 bestanden, 0 ausgelassen | `license-ui-tests-node22.log` |
| 11 Verhaltenstests Node.js 24.22.1 | 11 bestanden, 0 ausgelassen | `license-ui-tests-node24.log` |
| Echter HTTP-Antwortstrom bei Gesamtdeadline | bestanden | Abbruch nach ca. 5 Sekunden; Transport geschlossen; Bestandteil beider Testläufe |
| Abbruch beim Schließen | bestanden | echter HTTP-Strom vor Ablauf der Deadline geschlossen |
| Statusprojektion, Home/Pro, fehlerhafte Daten, Größenlimit, HTTPS-/Rollenfehler, Endpunkte/CSRF-Körper, fehlgeschlagene Aktivierung | bestanden | `test/eos-system-license-ui.test.cjs` |
| Unabhängige Prüfung der verschachtelten Plattform-Lizenz-Speicherfehler | 4 bestanden | `test/eos-system-save.test.cjs`: Verschlüsselung, Objektablage und Aktualisierung dürfen keinen falschen Speichererfolg melden; erfolgreicher Gegenfall geprüft |
| Gebaute Oberfläche / Speicherung / Rückfragen | gesonderter Nachweis | Browserprüfung des Gesamtstands in diesem Verzeichnis; synthetische Datenbank/API getrennt vom Live-System ausweisen |

Die vorhandenen serverseitigen Lizenztests bleiben Teil der Gesamtprüfung; dieser Vermerk ersetzt sie nicht. Die Tests verwenden synthetische UUIDs/Lizenzcodes und keine Kundenschlüssel. Ein tatsächlicher Lizenzimport mit Dominiques Key-Generator oder ein Test an einer Kundenanlage wird hier nicht als durchgeführt behauptet.

## Abnahme auf der Anlage

Nach Sicherung und Installation des vollständigen geprüften Stands: mit dem bestehenden Administratorkonto anmelden; System öffnen; vorhandenen Namen und Standort kontrollieren; eine beabsichtigte Änderung speichern und erneut öffnen; Abbrechen muss den Entwurf verwerfen. Im Systemreiter EOS Home / Pro muss der tatsächliche Lizenzstatus sichtbar sein. Bei HTTP-Aufruf wird eine HTTPS-Anforderung angezeigt; dafür keinen Zugriffsschutz abschalten. Home-/Pro-Freigaben mit einer zur tatsächlichen UUID passenden Testlizenz prüfen. Die Entfernung nur bewusst bei sicherem Anlagenzustand erproben.

Keine Aussage über vollständige IEC-/CRA-Konformität oder Fehlerfreiheit. Die Änderung unterstützt die bestehenden Anforderungen an Zugriffsschutz, vertrauliche Lizenzdaten, konsistente Fehlerbehandlung und nachvollziehbare Prüfung; reale Anlagen-/Serienfreigaben bleiben gesondert.
