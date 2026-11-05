# Direkter Upload aus VS Code – EOS Admin 7.10.12

25.10.2026, EOS-RELEASE-003; Fortsetzung von EOS-RELEASE-002 und EOS-DEP-001.

## Anforderung und Änderung

Der Nutzer veröffentlicht wie bisher aus dem integrierten VS-Code-Terminal
mit `npm publish`. Ein zusätzlicher manueller Reparaturschritt soll entfallen.
Der vorhandene `repair:eos-lock`-Ablauf ist deshalb nach der Versionssynchronisation
in `prepublishOnly` eingebunden. Er ergänzt fehlende Angaben exakter gesperrter
Paketversionen, aktualisiert die Lock-Referenzinventare und führt anschließend
die echte Lock-Prüfung aus. Erst danach folgen die bisherigen Paket- und
Stabilitätsprüfungen und der normale npm-Upload.

Die beiden Validatoren prüfen jetzt auch die genaue Reparatur-/Inventar-/Gate-
Verkettung. Fehler brechen den Ablauf ab. Es gibt keinen neuen Bypass, keine
Versionsanhebung von Abhängigkeiten und keinen automatischen Neuaufbau oder
Neuversiegelung von Produktcode beim Publish. Die vorhandene Reparatur wird
weiterverwendet; geändert ist nur ihr Aufruf und der Fehlerhinweis für den
normalen erneuten Versuch mit `npm publish`.

Vollständige Lockdateien benötigen keine erneuten Metadatenabrufe. Die vorherigen
TLS-, Zeit-, Größen-, Identitäts-, Konflikt- und Rückfallprüfungen bleiben aktiv.
Direkter HTTPS-Zugriff auf die öffentliche npm-Registry ist weiterhin erforderlich;
die Reparatur übernimmt keine npm-Proxykonfiguration. Die normale npm-Anmeldung
und gegebenenfalls Bestätigung bleiben Aufgabe der lokalen npm-CLI.

## Tatsächliche Prüfung

Umgebung: Linux, Node.js 24.22.1, npm 11.9.0. Rohbelege unter
`2026-10-25-direct-publish/`; interner separater Review unter `review/`.

| Prüfung | Ergebnis |
| --- | --- |
| Zwei neue Tests mit echtem `npm publish --dry-run` in isolierter Fixture | Bestanden: erfolgreiche automatische Reparatur vor Inventar, Gate und Paketierung; zweiter Aufruf ohne neue Registryabfrage; Registryfehler erhält Locks und stoppt Folgephasen |
| Vollständige vorhandene Paket-/Stabilitätskette | Bestanden; finaler Sicherheitssammellauf 155/155 bestanden |
| Echter `npm publish --dry-run` im gelieferten Repository | Automatische Reparatur erreicht; Exit 1 mit REGISTRY_UNAVAILABLE in dieser Umgebung; beide Lockdateien unverändert |
| Bytevergleich des Produktcodes gegen vorherige ZIP | Unverändert; zusätzlich README.md weiterhin identisch mit LICENSE |

Die isolierten Tests verwenden die echten Reparatur-, Inventar- und Gatefunktionen
mit injizierten Registrydaten. Die übrigen Lifecycleprüfungen sind dort Marker;
ihre echte Ausführung wird durch den separaten vollständigen Stabilitätslauf
belegt. Fixturepfade enthalten Leerzeichen; npm wird über seine JavaScript-CLI
gestartet. Das ist eine Portabilitätsprüfung, kein echter Windows- oder VS-Code-
GUI-Test. Es wurde kein Paket hochgeladen und keine Anlage verändert.

## Lieferstand, Einordnung und Restarbeit

Ausgangs-ZIP SHA-256:
`121b45fb5d360cce735116420a544439d2be87d06c401d9e2b0c880c123102ce`.
Produktversion bleibt 7.10.12. Geändert sind Publish-Verkettung, Validatoren,
Diagnosehinweis, Tests, Dokumentation und zugehörige Nachweise; der Admin-7-
Produktcode einschließlich Home/Pro-Lizenzverhalten bleibt bytegleich.
`NEXOWATT_EOS_PREBUILT_MANIFEST.json` bindet die geprüften Werkzeug-/Teständerungen.
`release-manifests/full-repository-files.json` bindet den vollständigen Lieferstand.

Der erfolgreiche Online-Abgleich der 563 fehlenden Backend-Lockeinträge bleibt
auf dem Nutzerrechner erforderlich und erfolgt jetzt automatisch. Ein echter
Registryerfolg, Upload, Windows-Lauf oder vollständiger neuer Produktbuild wird
nicht behauptet. Die übrigen offenen Sicherheits-, Build-, Anlagen- und
Lizenzbefunde aus der Sicherheitsprüfung bleiben bestehen.

Änderung und Prüfbelege werden entsprechend der NexoWatt-Entwicklungsvorgabe
gemeinsam geführt. Diese begrenzte Werkzeugkorrektur stellt keine vollständige
IEC-/CRA-Konformitätsprüfung oder Serienfreigabe dar. Die Bedienungsanleitung
`NPM_PUBLISH_FIX_7.10.12.md` und der Einstieg `START_HERE_7.10.12.md` sind aktualisiert.

Offizielle Lifecycle-Dokumentation, am 25.10.2026 abgeglichen:
https://docs.npmjs.com/cli/v11/using-npm/scripts/
