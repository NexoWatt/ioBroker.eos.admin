# EOS Admin 7.10.11 – HTTP-/Datei-/Browserprüfung

Prüfdatum: 25.10.2026 UTC. Prüfgegenstand: wiederhergestelltes vollständiges
Repository aus `NexoWatt_EOS_Admin_7.10.11_SECURITY_LICENSE_FULL_REPOSITORY.zip`,
SHA-256 `c58a4c03b3f3113455bf1a3492b942307902deabf3fd8f670670ff16955f9a92`.
Quellen und mitgelieferte JavaScript-Runtime wurden geprüft. Keine Änderung an
Produktionscode, keine Prüfung einer installierten Anlage, kein Angriff auf einen
externen Dienst. Node.js der Prüfumgebung: v24.22.1.

## Bestätigte Befunde

### SURFACE-01 – Dateizugriff ohne hinreichende Autorisierung (hoch)

`src/lib/web.ts:2073–2079` nimmt beliebige URL-Pfade mit Endung `.ico` oder
`manifest.json` von der Anmeldepflicht aus. Der spätere `/files/`-Handler decodiert
den gesamten URL-String und trennt erst danach ein Fragezeichen ab. Dadurch wird
beispielsweise die synthetische Anfrage
`/files/vis.0/private.json%3F.ico` im globalen Gate als Icon behandelt, im
Dateihandler jedoch als `vis.0/private.json`.

`src/lib/web.ts:2602–2603` ruft `fileExists` und `readFileAsync` ohne Identität des
anfragenden Benutzers auf. Auch für angemeldete Endbenutzer fehlt damit an dieser
HTTP-Grenze die benutzerbezogene Datei-ACL-Prüfung; `accessLimit` prüft lediglich
die speziellen Namen `index.html`, `index_m.html`, `tab.html` und `tab_m.html`.
Dies ist kein Beleg für beliebiges Lesen von Betriebssystemdateien oder
Objekt-/State-Daten. Betroffen sind Dateien in ioBroker-Dateinamespaces, soweit
der Adapterprozess darauf zugreifen kann. Das gleiche Fehlen einer individuellen
Identität ist bei `/adapter/` in Zeile 2535 erkennbar; dort muss zwischen bewusst
öffentlichen statischen Adapterassets und geschützten Inhalten unterschieden werden.

Nachweis: `surface-repro.cjs` führt die unveränderten Handlerfragmente aus
`build/lib/web.js` in einer VM aus. Eine Anfrage ohne `req.user` und mit
`isAuthenticated() === false` passiert das EOS-Gate; der anschließende echte
Dateihandler liefert eine ausschließlich für den Test erzeugte private JSON-Datei.
Ein zweiter Fall zeigt denselben fehlenden Nutzerkontext für `guest` selbst bei
aktivem `accessLimit`. Die Datenbank ist simuliert. Das vorgelagerte originale
OAuth-/Express-Routing sowie reales Controller-ACL-Verhalten müssen mit den
Belegen der separaten Auth-Prüfung zusammengeführt werden; dieser Teilnachweis
allein ist kein vollständiger Netzwerktest.

Abhilfe: Öffentliche Loginressourcen anhand einer kleinen, exakten Pfadliste
freigeben. Datenrouten unabhängig von einem globalen Loginfilter authentifizieren;
URL einmal konsistent parsen, mehrdeutige codierte Trenner ablehnen; alle Datei-
und Verzeichnisoperationen mit geprüfter Benutzeridentität und ACL ausführen.
Regressionen müssen auch `.ico`, `manifest.json`, `%3F`, gemischte Großschreibung,
fehlende Sitzungen und Endbenutzerzugriff abdecken. Ein Dateiname ist kein
Autorisierungsmerkmal.

### SURFACE-02 – JavaScript-Ausführung aus Newsbedingungen im ausgelieferten Browsercode (hoch, bedingt)

`src-admin/src/dialogs/NewsAdminDialog.tsx:299–301` verarbeitet
`message['number-of-objects']` mit `eval`. Derselbe Ausdruck steht unverändert im
ausgelieferten Bundle `adminWww/assets/bootstrap-COulQZax-v84.js`.

Nachweis: Der Test extrahiert genau diesen Ausdruck aus dem ausgelieferten Bundle
und führt ihn mit einer synthetischen Newsbedingung aus. Diese setzt lediglich
einen lokalen Auditmarker und liefert `true`; Codeausführung ist damit für den
Ausdruck bestätigt. Es wurde kein Browser angegriffen, keine Sitzung ausgelesen
und kein Netzwerkzugriff durchgeführt. Voraussetzung für die Sicherheitsfolge
ist Kontrolle eines verarbeiteten Newsdatensatzes (etwa kompromittierter Feed
oder entsprechend berechtigter lokaler Schreiber); dies ist keine allgemeine
anonyme Remote-Ausführung. Die Backendvariante desselben Problems wird im
Hauptaudit gesondert behandelt.

Die Haupt-Weboberfläche setzt im untersuchten Backend keine CSP, die `eval`
unterbinden würde. Die restriktive CSP von `src/lib/eosLicenseHttp.js:49` gilt
nur für die Lizenzseite. Eine vorgeschaltete externe Proxy-CSP wurde nicht geprüft.

Abhilfe: Backend und Frontend auf einen gemeinsamen, strikt begrenzten
Vergleichsparser umstellen, etwa erlaubte Vergleichsoperatoren plus endliche
Zahlen. Ungültige Ausdrücke verwerfen. Frontend vollständig neu bauen und den
ausgelieferten Bundlepfad erneut prüfen. CSP ohne `unsafe-eval` als zusätzliche
Schutzschicht, nicht als Ersatz für die Entfernung des dynamischen Auswertens.

### SURFACE-03 – HTML-Injektion in Adapter-OAuth-Rückmeldungen (mittel bis hoch, bedingt)

`src/lib/web.ts:2696,2702` setzt `_result.error` bzw. `_result.result` eines
Adapter-Callbacks unverändert in `public/oauthError.html` bzw.
`public/oauthSuccess.html` ein und liefert `text/html`. Im ausgelieferten Backend
ist dasselbe Verhalten vorhanden. Die Route hat selbst keine zusätzliche CSP.

Nachweis: Der echte gebaute Handler wird mit einem simulierten Adapter ausgeführt,
der einen harmlosen HTML-Marker zurückliefert. Sowohl Erfolgs- als auch Fehlerpfad
liefern das ungefilterte Markup. Der Test belegt den HTML-Sink, nicht die Kontrolle
über einen beliebigen real installierten Adapter. Bei einem Adapter, der fremde
OAuth-Fehlermeldungen oder Parameter unbereinigt zurückgibt, oder einem
kompromittierten Adapter kann daraus JavaScript im Admin-Ursprung entstehen.
Ein Opfer muss die betroffene Rückrufseite öffnen. Die Nutzlastkontrolle ist
produkt-/adapterabhängig.

Abhilfe: Ergebnis- und Fehlertexte HTML-escapen bzw. ausschließlich als Text
rendern; feste Fehlercodes/übersetzte Meldungen bevorzugen. Rückrufe an die
erwartete Adapterinstanz und einen serverseitig gebundenen Einmalzustand koppeln.
Eine restriktive CSP und isolierte Darstellung fremder HTML/SVG-Dateien ergänzen.

### SURFACE-04 – Unbegrenzter Verzeichnisexport im Arbeitsspeicher (mittel, Verfügbarkeit)

`readFolderRecursive` (`src/lib/web.ts:128–151`) lädt rekursiv sämtliche Dateien
als Buffer. `/files/` (`2626–2643`) hält anschließend zusätzlich das gesamte
ZIP-Ergebnis in einem Array und kopiert es mit `Buffer.concat`. Es gibt auf diesem
Pfad keine Begrenzung für Bytezahl, Einträge, Tiefe, parallele Exporte oder
Gesamtlaufzeit; ein Clientabbruch beendet den Auftrag nicht ausdrücklich.

Dies ist eine Codeanalyse, kein Last-/Speicherausfalltest. Große oder gleichzeitig
angeforderte Dateibestände können den gemeinsamen Adminprozess erschöpfen.
Die Zugriffsvoraussetzung hängt von SURFACE-01 bzw. dessen Behebung ab.

Abhilfe: Autorisierung zuerst, harte Eintrags-/Byte-/Tiefen-/Zeitlimits und kleines
gemeinsames Parallelitätsbudget; ZIP mit Rückstau direkt streamen, Abbruchsignal
an Datei-/ZIP-Arbeit weitergeben. Keine unbeschränkte `Buffer.concat`-Sammlung.

### SURFACE-05 – Ein externer Abruf umgeht das 5-s-Sicherheitsprofil (mittel)

`src/main.ts:2914` und `build/main.js:2603` rufen den Node.js-Releaseindex weiterhin
direkt mit `axios(url)` auf. Es werden keine Timeout-, Größen- oder
Weiterleitungsgrenzen gesetzt; im untersuchten Projekt ist für diesen Aufruf
auch kein entsprechender Axios-Default eingerichtet. Der Aufruf startet aus
`updateNews` ohne Coalescing (`src/main.ts:2602`). Daher ist die umfassende Aussage,
alle externen Abrufe hätten das NexoWatt-Gesamtbudget, für diesen Stand nicht belegt.

Ein kompromittierter DNS-Pfad allein überwindet HTTPS nicht. Relevante Risiken
sind hängende Verbindungen, übergroße/komprimierte Antworten und Weiterleitungen
des vertrauenswürdigen Endpunkts; kein erfolgreicher SSRF-Angriff wurde gezeigt.

Abhilfe: Auch diesen Abruf über den vorhandenen hostgebundenen, begrenzten
`requestHttpsJson`-Transport führen; Datenstruktur prüfen, parallele Prüfungen
zusammenfassen, Fehlertexte begrenzen. Gesamtbudget für DNS, TLS, Antwortkörper und
alle Folgearbeit beachten.

## Bereits vorhandene wirksame Schutzmaßnahmen

Die bestehenden Ressourcenprüfungen wurden unverändert erneut ausgeführt:
18 Fälle an `src/lib` und dieselben 18 Fälle an `build/lib` bestanden. Das sind
18 einzigartige Fälle in zwei Laufzeitvarianten, nicht 36 unterschiedliche Fälle.
Sie prüfen u. a. HTTPS-Hostbindung/TLS/Deadline/Größe, HTTP-Loopbackgrenze,
gzip-Grenzen, Uploadadmission und Abbruch sowie Restore-Symlinkschutz.

Uploadrouten haben ihre technische Rollen-/Originprüfung vor dem Multipartparser;
der Helper begrenzt Dateigröße, Parallelität und temporären Speicher. Diese
Ergebnisse widerlegen die neu gefundenen Risiken nicht: Insbesondere ist der
Verzeichnisexport ein anderer Datenpfad. Die Multipart-Parserintegration und
Quota über mehrere Prozesse hinweg wurden hier nicht neu live geprüft.

## Testbelege und Grenzen

`raw/results.json` enthält Kommandos, Umgebungsauswahl, UTC-Start und Rückgabecodes.
`raw/surface-repro.log`: 4/4 Befundreproduktionen bestanden. Das bedeutet,
die beschriebenen unsicheren Verhaltensweisen wurden reproduziert, nicht behoben.
`raw/web-resources-source.log` und `raw/web-resources-build.log`: jeweils 18/18.
`source-hashes.json` bindet die untersuchten zentralen Dateien.

Alle Tests laufen isoliert, mit simulierten Adapter-/Datenbank-/HTTP-Grenzen.
Sie ersetzen keinen realen Controller-, Browser-, TLS-/Proxy- oder Lasttest.
IEC-62443-Prüfbereiche: Identifikation/Authentifizierung, Nutzungskontrolle,
Eingabevalidierung/Systemintegrität, Datenvertraulichkeit und Ressourcenverfügbarkeit.
Die Zuordnung ist ein technischer Prüfhinweis; daraus folgt weder ein
Security-Level noch eine Zertifizierung oder CRA-Konformität.
