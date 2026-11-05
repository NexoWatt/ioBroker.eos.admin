# Admin 8: Instanzproxy und unabhängige Prüfung der Frontend-Ausgabe

## Änderung

Der Proxy ist als native Node-Implementierung in `src/lib/instanceProxy.ts` ergänzt. Die Sicherheitsgrenze und Betriebsprofile stehen in `../ADMIN8_INSTANCE_PROXY_2026-11-04.md`. Die zugehörigen tatsächlichen HTTP-/HTTPS-/SSE-/WebSocket-Prüfungen stehen in `proxy-tests.log` (elf bestanden, keine übersprungen). `proxy-typecheck.log` gehört zur erfolgreichen strikten TypeScript-Einzelprüfung; eine leere Datei bedeutet hier Exitcode 0. Die Web-/Session-Einbindung und der Gesamtbuild werden separat im Gesamtnachweis geprüft.

Die alten Releaseprüfungen erwarteten fest codierte Admin-7-Dateinamen wie `index-CQZugZ1z-v85.js`. Sie werten jetzt die tatsächliche Admin-8-Buildquittung `NEXOWATT_EOS_FRONTEND_MANIFEST.json` aus. Diese bindet Quelldateien, gebündelte Module und zusätzliche Federation-Einstiegsassets. Die Kontrolle erwartet weiterhin einen einzigen, nach der EOS-Rollenermittlung geladenen Anwendungseinstieg; `hostInit` wird innerhalb dieses geschützten Einstiegs geladen. Das manuelle Schreibregelwerk kommt vor dem Rollenbootstrap, danach folgen Policy, Shell, Sicherheits-/Rollenoberfläche und Auto-Update in der festgelegten Reihenfolge.

`tools/nexowatt-frontend-artifacts.cjs` validiert Größen, Schema, Pfade, Symlink-Grenzen, Modulzuordnung, Asset-Hashes, echte Importkanten, Vite-Preload-Ressourcen und Federation-Verweise. Übersetzte Texte werden nicht mehr fälschlich als Importcode behandelt. Dazu wird ausschließlich der unveränderte Acorn-8.17.0-Parser aus dem gesperrten Abhängigkeitsstand verwendet. Seine CJS-Distribution und MIT-Lizenz liegen samt Registry-Integrität und SHA-256-Provenienz unter `tools/vendor/acorn`. Der Validator prüft die vendorten Bytes vor dem Laden; er führt keine geprüfte Browserdatei aus. Damit benötigen die vorbereiteten Veröffentlichungsprüfungen weder `node_modules` noch ein global installiertes Parserpaket.

Geändert: Entrypoint-Smoke, Frontend-Graph, Import-Integrität, ESM-Syntax und Legacy-Runtime-Bereinigung. ESM und klassische Skripte werden weiterhin mit dem Node-Parser kontrolliert. Die Bereinigung nutzt bei Admin 8 das Manifest, entfernt veraltete versionierte sowie nicht erfasste gehashte JS-Bundles und erhält aktuelle Federation-/Source-Assets. Der historische Admin-7-Bereinigungsregressionstest bleibt unterstützt; der neue Test prüft die echte Admin-8-Struktur.

## Tatsächliche Ergebnisse

- Elf lokale Proxyintegrationstests bestanden; synthetische Objekt-/Sessiondaten, echte lokale HTTP-/HTTPS-/Express-/SSE-/WebSocket-Verbindungen. Keine Hausanlage und kein vollständiger Controller.
- Vier gezielte Receipt-/Parser-Tests bestanden: echte Imports gegen Übersetzungstext, keine Ausführung der geprüften Module, unsichere Pfade/fehlende Ziele/geänderte Assetbytes, alte Runtime-Bereinigung, Parser ohne installierte Abhängigkeiten sowie Abweisung veränderter Parserbytes vor Ausführung.
- Fünf Prüfbefehle gegen die tatsächlich kopierte Admin-8-Ausgabe bestanden: 18 Einstiegsskripte; 73 erfasste und erreichbare JS-Module; genau eine HTML5-Backend-Implementierung; vollständige Import-/Preload-/Federation-Ziele; ESM-/Classic-Syntax; Bereinigungs-Vorschau ohne Altdateien.
- Die gesonderte Quell-/Build-Provenienzprüfung erkannte anschließend eine Abweichung in `src-admin/src/version.json`. Dieses Ergebnis wird ausdrücklich als Fehler aufbewahrt. Vor abschließender Versiegelung muss die Versionssynchronisation vor dem Frontend-Build laufen und die vollständig neu erzeugte Quittung wieder geprüft werden. Der Gesamtnachweis muss den erfolgreichen abschließenden Lauf enthalten; die Quittung darf nicht nachträglich passend umgeschrieben werden.

Der JSON-Nachweis enthält Befehle, Exitcodes, Quell-/Toolhashes und Protokollhashes. Der Proxytest benötigt im Entwicklungs-/Buildprüfschritt die gesperrten Express- und Controller/node-forge-Abhängigkeiten. Er setzt kein externes OpenSSL-Programm voraus. Die vorbereitete Veröffentlichung prüft dafür den bereits erzeugten, quellgebundenen Buildprüfnachweis; sie darf keinen nicht ausgeführten Integrationstest als bestanden melden.

Dieser begrenzte Nachweis ersetzt weder Browser-/Anlagenabnahme noch unabhängige Sicherheitsprüfung oder Zertifizierung.
