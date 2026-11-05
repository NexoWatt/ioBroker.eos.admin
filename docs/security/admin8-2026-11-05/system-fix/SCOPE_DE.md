# Änderungsumfang 8.0.2 – Systembereich

Stand: 05.11.2026. Ausgangspunkt: vollständiges Repository 8.0.1, ZIP-SHA256 `9cd68249663cd0d99db79abe28d0383585a249f133d58dfbab01fbea2cf4cc64`.

## Nutzerbefund und Sollverhalten

Dominique bestätigt die funktionierende Anmeldung mit 8.0.1. Danach meldet er fehlenden Expertenmodus und fehlenden Systembereich. Seine Referenz zeigt die vorhandenen ioBroker-Basiseinstellungen mit Anlagenname, Standort, Sprache und Expertenmodus. Der schwebende EOS-Lizenzknopf soll in diesen Systembereich eingeordnet werden.

Die Standort-/Kundendaten werden weder neu angelegt noch migriert. Der bisher für den Kundennamen verwendete Anlagenname bleibt `system.config.common.siteName`. Bestehende Home-/Pro-Lizenzen, UUID-Bindung, verschlüsselte Ablage und Passwortprüfung bleiben erhalten.

## Sicherheitsanforderungen und Prüfumfang

- System-/Expertenbedienung bleibt auf die vorgesehenen authentifizierten Rollen beschränkt; unbekannte Rollen erhalten keine Freigabe. Eine sichtbare Schaltfläche ersetzt keine serverseitige Autorisierung.
- Lizenzstatus und Aktivierung nutzen die vorhandenen Admin-Endpunkte, Transport-, Same-Origin-/CSRF- und Größenbeschränkungen. Keine Speicherung des Aktivierungstokens in Browser-Speichern oder Protokollen.
- Lizenzentfernung benötigt eine bewusste Bestätigung. Bestehende Lizenzdaten werden beim Seitenwechsel nicht geändert.
- Standort-/Konfigurationsänderungen verwenden weiterhin die bestehende ioBroker-Objekt- und ACL-Schnittstelle. Lade-/Speicherfehler müssen sichtbar sein; kein vorgetäuschter Speichererfolg.
- Gruppenidentität basiert auf technischen Objekt-IDs, nicht auf übersetzbaren Anzeigenamen. Fehlerhafte Gruppendaten dürfen keine Rechte vergeben.
- Tests umfassen sichtbare/bedienbare System- und Expertenelemente, bewahrte Konfiguration, Lizenzanzeige/-fehler, Rollenbegrenzung und den unveränderten Login-Widerrufspfad.
- Vollständige Repository-ZIP, vorgebautes Front-/Backend, aktualisierte Komponenten-/Buildnachweise sowie Kopierübernahme und Publish-Dry-Run gehören zum Lieferstand. Node 22 bleibt unterstützt.

IEC 62443-4-1/4-2 und OWASP ASVS dienen als Entwicklungs- und Prüfbezug für Authentifizierung, Autorisierung, Datenvalidierung und Fehlerbehandlung. Dieser Änderungsumfang ist keine vollständige Normprüfung, CRA-Konformitätsbewertung oder Zertifizierung. Ergebnisse und offene Grenzen stehen im abschließenden Prüfvermerk; Nutzerbeobachtung, Simulation und echte Komponentenprüfung werden getrennt ausgewiesen.
