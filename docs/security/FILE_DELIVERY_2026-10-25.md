# Dateiübertragung: Sicherheitsänderung vom 25.10.2026

Die HTTP-Dateiroute `/files/` darf nur nach erfolgreicher erneuter
Benutzerauthentifizierung auf ioBroker-Dateien zugreifen. Die Integration in
`web.ts` verantwortet die Sitzungsprüfung; `eosFileTransferSecurity.js` lehnt
zusätzlich fehlende oder fehlerhafte vollständige Benutzer-IDs ab. Sowohl die
Metadatenabfrage als auch der eigentliche Dateiabruf übergeben `{ user }` an
die Controller-API. Die Optionen entsprechen der öffentlich dokumentierten
Signatur von `readDirAsync` und `readFileAsync` im ioBroker-js-controller.

Der Parser trennt eine wirkliche URL-Abfrage vor der Decodierung ab. Codierte
Trenner, Mehrfachcodierung, Rückwärtsschrägstriche, Steuerzeichen, relative
Pfadsegmente und überlange bzw. zu tiefe Pfade werden verworfen. Eine
Dateiendung kann keine Anmeldung ersetzen.

Die neue Dateiübertragung hat folgende Grenzen:

- Zwei aktive Dateioperationen pro Node-Prozess; es gibt keine unbegrenzte Warteschlange.
- Höchstens fünf Sekunden Gesamtzeit für Metadatenabfrage, Dateiabruf und HTTP-Ausgabe. Ein langsamer Antwortempfänger hält seinen Platz bis `finish`/`close`; die Deadline zerstört eine dann noch offene Antwortverbindung.
- Höchstens 1.000 Einträge in der gelesenen Elternliste und 16 MiB zugelassene Dateigröße.
- Vorherige Größenprüfung anhand `stats.size` und erneute Prüfung des tatsächlichen Inhalts.
- Eine nicht abbrechbare, hängende Controller-Operation hält ihren Platz bis zur Erledigung belegt, auch wenn die HTTP-Anfrage bereits abgewiesen wurde. Dadurch erzeugen Wiederholungen keine unbegrenzte Zahl weiterer Datenbankaufrufe. Zwei dauerhaft hängende Operationen sperren weitere Dateiabrufe bis zur Erledigung bzw. zum geordneten Neustart; andere Adminrouten werden dadurch nicht absichtlich gesperrt.
- Bei Clientabbruch beginnt keine weitere Dateioperation und es erfolgt keine späte Antwort.

**Technische Grenze:** Die Controller-API liefert vollständige Buffer bzw.
Strings. Eine zwischen Metadatenprüfung und Abruf vergrößerte Datei kann deshalb
bereits innerhalb der Controller-Implementierung Speicher belegen, bevor die
nachträgliche Größenprüfung sie abweist. Dies ist kein vollständig begrenzter
Streamingtransport. Für einen harten prozessübergreifenden Schutz sind eine
Controller-Streamingfunktion bzw. OS-Speicher-/Dateiquoten erforderlich.

Die frühere rekursive ZIP-Erzeugung im Arbeitsspeicher ist entfernt. Ein
Verzeichnisabruf wird mit `DIRECTORY_EXPORT_DISABLED` verweigert. Einzeldateien
bleiben innerhalb der Grenzen abrufbar. Ein neuer sicherer Verzeichnisexport
wurde nicht implementiert; vorhandene Administrator-/Backupverfahren sind
gesondert zu prüfen, bevor sie als Ersatz eingesetzt werden.

HTML, SVG, JavaScript, XML, PDF und sonstige nicht freigegebene Dateitypen werden
als Download mit `application/octet-stream`, `nosniff` und einer isolierenden
CSP ausgeliefert. Rasterbilder bleiben mit fest zugeordnetetem Bildtyp und
Text/JSON/CSV/Log-Dateien als Klartext darstellbar. Ein Datenbank-MIME-Typ kann
keine aktive Darstellung auf dem Admin-Ursprung erzwingen. Diese Regel betrifft
die Datenroute `/files/`, nicht die geprüften statischen UI-Skripte von `/adapter/`.
GET löscht keine Einmal-ZIP-Datei mehr automatisch; Aufbewahrung und Löschung
müssen durch einen ausdrücklich autorisierten Vorgang geschehen.

## Prüfung

`node --test test/eos-file-transfer-security.test.cjs` enthält dreizehn Fälle:
Parserpositive/-negative, Identität und ACL-Weitergabe, Verzeichnisverweigerung,
Metadaten-/Byte-/Eintragsgrenzen, aktive Inhaltstypen, generische Fehler,
Parallelitätsreservierung bei Zeitüberschreitung und Clientabbruch, langsame
HTTP-Ausgabe sowie Benutzernamen mit `@`. Die
Deadlineprüfung kontrolliert den konfigurierten Wert 5.000 ms und löst den
Timer im isolierten Harness deterministisch aus. Controller und HTTP-Objekte
sind dabei simuliert. `EOS_TEST_RUNTIME=build` wählt dieselben Prüfungen gegen
die gebaute Helperdatei aus; der finale Buildnachweis wird vom Gesamtprüflauf
festgehalten. Ein echter Controller-/Express-Integrationstest bleibt erforderlich.

Der neue Helper adressiert die Befunde SURFACE-01 und SURFACE-04 sowie die
aktive Darstellung fremder Dateiinhalte. Die gesamte Kette benötigt zusätzlich
den korrigierten globalen Loginfilter und die routeeigene Sitzungsprüfung in
`web.ts`. Ein bestandener Helpertest allein beweist diese Verdrahtung nicht.
