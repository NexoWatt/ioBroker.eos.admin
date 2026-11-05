# Admin 8: Schutz manueller Datenpunktschreibvorgänge und Dokumentationsanzeige

Stand: 4. November 2026. Geltungsbereich: EOS-Frontend auf der im Repository festgelegten offiziellen Admin-8.3.5-Basis mit `@iobroker/gui-components` 10.3.14.

## Ursache und Änderungen

Die bisherige EOS-7-Auslieferung enthielt Sicherheits- und Bedienkorrekturen direkt im bereits minifizierten gemeinsamen ObjectBrowser-Bundle. Ein unveränderter Neubau mit dem neuen Admin-8-Komponentenpaket hätte diese Korrekturen verloren. Das ursprüngliche Admin-8-Verhalten erlaubte außerdem im Expertenmodus das Öffnen von Werten mit `common.write=false`; der Dialog schloss vor Abschluss des Schreibversuchs, und direkte Schalter verwendeten einen möglicherweise veralteten Cache sowie JavaScript-Wahrheitswerte.

Der neue Build verwendet einen überprüften Quellmodul-Overlay vor der Bündelung. `src-admin/build-tools/eos-object-browser-transform.mjs` prüft die exakte Paketversion und SHA-256-Hashes von vier **unminifizierten** upstream Modulen (`renderLeaf.js`, `ObjectBrowserClass.js`, `dialogs.js`, `contextMenu.js`). Die geprüften, jeweils eindeutig verankerten Änderungen stehen vollständig in `eos-object-browser-patches.json`. Weder `node_modules` noch fertige minifizierte Dateien werden verändert. Eine abweichende Paketversion, veränderte Eingabebytes, mehrdeutige Ersetzung oder ein nicht tatsächlich eingebundenes Schutzmodul bricht den Build ab. Ein Update des GUI-Pakets verlangt eine erneute fachliche Prüfung des Overlays; Hashwerte dürfen nicht ungeprüft aktualisiert werden.

Die eigentliche EOS-Interaktionslogik liegt typisiert in `src-admin/src/components/Object/eosObjectBrowserWrite.ts`; der eigentliche Wertedialog wurde gegen Admin 8 zusammengeführt. Der fertige Build schreibt `eos-object-browser-guards.json`. Die Releaseprüfungen verknüpfen diesen Beleg mit der tatsächlichen Modul-/Chunk-Zuordnung in `NEXOWATT_EOS_FRONTEND_MANIFEST.json`. Sie hängen nicht mehr von alten Vite-Dateinamen oder Minifier-Variablennamen ab.

## Erhaltene und verstärkte Schutzfunktionen

- Fehlende Policy, Nicht-State-Objekt, `common.write=false` oder schreibgeschützte ObjectBrowser-Ansicht sperren Schreibaktionen; auch Expertenmodus umgeht diese Sperren nicht.
- Die bestehende EOS-Policy entscheidet weiterhin zwischen Dialog, Taster, binärem Schalter und ausschließlich im Admin-Expertenmodus zulässigen Eingriffen. Der Server bleibt die maßgebliche Autorisierungsgrenze.
- Schalter lesen den aktuellen Wert vor dem Umschalten; numerische und textuelle Zustandswerte bleiben typgerecht. Nach dem asynchronen Lesen wird die Bearbeitungsberechtigung erneut geprüft. Die vorhandene Policy für Cache-Ersatz bei Lesefehlern und Schreibwarteschlangen bleibt erhalten.
- Eine gemeinsame Klickstrecke bedient Maus und Tastatur; Kopieren löst keinen Schreibzugriff aus. `mousedown` unterdrückt den anschließenden Klick nicht. Erfolgreiche Schalteränderungen invalidieren den neuen Admin-8-Zeilencache; Taster erzeugen keinen künstlichen Dauerzustand.
- Noch nie gesetzte und nur schreibbare Datenpunkte behalten eine bedienbare Wertzelle. Alte, textuelle `common.states`-Definitionen werden normalisiert.
- Der Dialog wartet auf das tatsächliche Schreibversprechen, bleibt bei Fehlern geöffnet und blockiert paralleles Absenden synchron. JSON-Fehler, ungültige Zahlen und Min-/Max-Verletzungen werden auch bei Tastaturbedienung geprüft. Abbrechen während eines ausstehenden Dialogschreibvorgangs ist gesperrt.
- State-URLs werden auf HTTP/HTTPS begrenzt; neue Fenster erhalten `noopener,noreferrer`.

## Dokumentationsanzeige

`Markdown.tsx` verwendet jetzt `SafeMarkdownView.tsx` mit den bereits installierten Paketen `react-markdown` und `remark-gfm`. Die frühere Erzeugung von HTML-Strings für `CustomLink`/`CustomH` entfällt. React-Komponenten erzeugen Verweise und Überschriften, rohe HTML-Blöcke werden nicht interpretiert. HTTP-/HTTPS-Verweise, Mailverweise, Bilder, relative GitHub-Dokumentverweise, Überschriftennavigation und GFM-Tabellen/Listen/Durchstreichung bleiben verfügbar. Relative Bilder verwenden weiterhin die Rohdateiadresse. Skript-/Daten-URLs, Zugangsdaten in URLs und protokollrelative Adressen werden abgewiesen. Bilder erhalten `referrerPolicy=no-referrer`, externe Links keinen Zugriff auf den öffnenden Tab.

Absichtliche Darstellungsgrenze: Beliebiges HTML sowie die alten Showdown-spezifischen HTML-/Emoji-/Bilddimensions-Erweiterungen werden nicht ausgeführt. Inhalte sollen Standard-Markdown/GFM verwenden. Dies ist eine Schutzentscheidung für fremde Adapter-Dokumentation, kein vollständiger Website-HTML-Renderer.

## Durchgeführte Prüfungen

Im Arbeitsstand wurden erfolgreich ausgeführt:

1. Vollständige Frontend-Typprüfung: `node src-admin/node_modules/typescript/bin/tsc -p src-admin/tsconfig.json --noEmit --pretty false` — keine Fehler.
2. ESLint für `ObjectBrowserValue.tsx`, `eosObjectBrowserWrite.ts`, `Markdown.tsx`, `SafeMarkdownView.tsx` — keine Fehler.
3. `node tools/nexowatt-admin8-objectbrowser-fixtures.mjs --check` — exakte Übereinstimmung der eingecheckten Dialog-Kompilation und GUI-Fixtures mit dem aktuellen Compiler und den geprüften Abhängigkeitsdateien. `node tools/nexowatt-admin8-objectbrowser-selftest.mjs` — 55 Assertions einschließlich echter Helper-/Dialogmethoden, fehlender Policy, Berechtigungswechsel, veralteter Werte, binärer Enums, direkter Taster, Tastatur/Kopieren, Schreibfehler, Doppelabsenden und absichtlicher Hashabweichung.
4. `node tools/nexowatt-manual-write-policy-selftest.cjs` — bestehende umfangreiche Policy-Prüfung unverändert erfolgreich, einschließlich Objekt-/Array-/Mixed-Werten und Warteschlangenverhalten.
5. `node tools/nexowatt-markdown-security-selftest.mjs` — tatsächliches React-Serverrendering gegen HTML-/URL-/Attribut-Injektionsfälle sowie Verweise, Bilder, Überschriften und GFM-Inhalte erfolgreich.

Die Test-VM führt ausschließlich die lokal erzeugte, eingecheckte Kompilation des Wertedialogs im lokalen Testprozess aus. Vor jeder Ausführung werden ihr Hash, der Hash der aktuellen TSX-Quelle und die Herkunft der unveränderten GUI-Fixtures geprüft. Im Entwicklungs-/Build-Gate wird zusätzlich die frische Compiler-Ausgabe bytegenau verglichen. `tools/fixtures/admin8-objectbrowser` enthält hierfür die MIT-Lizenz und Herkunfts-/Hashdaten. Der Veröffentlichungstest benötigt ausschließlich Node 24; alle 55 Assertions liefen zusätzlich in einer isolierten Kopie ohne Root- oder Frontend-`node_modules` erfolgreich. Der React-SSR-Markdown-Test benötigt dagegen Entwicklungsabhängigkeiten und gehört in das vollständige Build-Gate; beim Veröffentlichen werden die gebundenen Build-Belege geprüft. Sie ist kein Bestandteil des ausgelieferten Browsers. Das isolierte Transpilieren der Testkomponente ersetzt ausdrücklich nicht die oben zusätzlich ausgeführte vollständige Typprüfung und den normalen Vite-Build.

Die aktualisierten bestehenden Prüfungen `nexowatt-datapoint-selftest.cjs`, `nexowatt-datapoint-interaction-selftest.cjs`, `nexowatt-module-popup-selftest.cjs` und `nexowatt-value-column-selftest.cjs` wurden zusätzlich gegen die neu gebauten und nach `adminWww` übernommenen Artefakte erfolgreich ausgeführt. Der allgemeine Build-/Releasebericht dokumentiert das Gesamtergebnis sowie die visuelle Integration. Kein Testbericht dieses Teilbereichs behauptet eine IEC-Zertifizierung, abgeschlossene CRA-Konformitätsbewertung oder generelle Fehlerfreiheit. Geräte-, Serverberechtigungs- und Rollentests auf dem Zielsystem bleiben eigene Nachweise.
