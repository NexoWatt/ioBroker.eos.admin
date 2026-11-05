# Verbindliche Entwicklungsrichtlinie für alle eigenen Softwareprojekte

**Verantwortlich:** Dominique Manteufel / NexoWatt  
**Version:** 1.0.0  
**Stand und Quellenprüfung:** 25.10.2026; einschließlich der ergänzten Drei-Säulen-Checkliste  
**Geltungsbereich:** NexoWatt EOS, alle eigenen und unterstützten ioBroker-Adapter sowie weitere gemeinsam entwickelte oder gepflegte Softwareprojekte, einschließlich Backends, Weboberflächen, Desktop-Anwendungen, Dienste, Installer, Updates und Build-Werkzeuge.  
**Status:** Verbindliche Arbeitsvorgabe. Diese Datei ist kein Prüfbericht über den vorhandenen Code und keine Produktfreigabe.

**Geschäftspartner und Kunden:** Hohe Sicherheitsstandards sind eine verbindliche Entwicklungs- und Freigabeanforderung. Gegenüber Firmen dürfen nur tatsächlich belegte Sicherheits-, Funktions- und Konformitätsaussagen gemacht werden. Zusätzliche vertraglich vereinbarte Anforderungen werden je Produkt aufgenommen und nachgewiesen; siehe Abschnitt 15.

## 0. Unmittelbar anzuwendende Regeln

1. **Sicherheit von Anfang an:** Sicherheitsanforderungen vor der Umsetzung bestimmen. Keine Hintertüren, gemeinsamen Standardpasswörter, unkontrollierten Befehlswege oder bewussten Umgehungen von Schutzmaßnahmen einbauen.
2. **Bestehende Funktionen erhalten:** Vor Änderungen das gültige Sollverhalten feststellen. Funktionen, Regelungen, Datenpunkte und Schnittstellen dürfen nicht unbeabsichtigt verändert oder entfernt werden.
3. **Ohne Root im Betrieb:** Eigene Anwendungsprozesse, Adapter, Controller und Regelungen müssen mit normalen Dienstkonten funktionieren. Kein verstecktes `sudo`, keine Administratorgruppe und kein gleichwertiger indirekter Vollzugriff.
4. **JavaScript und TypeScript sauber prüfen:** Typprüfung, verbindliches Linting, verständliche Module, explizite Fehlerbehandlung und Laufzeitvalidierung externer Daten sind Pflicht. TypeScript allein macht Daten nicht vertrauenswürdig.
5. **Sicheres Verhalten bei Fehlern:** Ungültige oder veraltete Daten, Kommunikationsverlust, Neustarts und Teilfehler müssen zu vorher festgelegten, betrieblich sicheren Reaktionen führen.
6. **Änderung und Nachweis gehören zusammen:** Betroffene Dokumentation, passende Tests, offene Befunde und ein nachvollziehbarer Änderungs- und Prüfvermerk entstehen im selben Arbeitsstand.
7. **Aktuelle, gepflegte Grundlagen verwenden:** Offizielle Sicherheitsmeldungen, veröffentlichte Standards, unterstützte Laufzeiten und Abhängigkeiten prüfen. Neue Versionen kontrolliert übernehmen und die Kompatibilität nachweisen.
8. **Keine bekannte ausnutzbare Lücke freigeben:** Bekannte im vorgesehenen Einsatz ausnutzbare Schwachstellen, ungeklärte Integritätsprobleme und fehlgeschlagene kritische Prüfungen verhindern die Produktionsfreigabe.
9. **Prüfergebnisse ehrlich ausweisen:** Nicht ausgeführt bedeutet offen. Simulation, Mocktest, Codeprüfung und realer Gerätetest sind unterschiedliche Nachweise. Keine erfundenen Ergebnisse oder Freigaben.
10. **Keine unbelegten Garantien:** Ziel sind sichere und zuverlässig funktionierende Produkte. Aussagen wie „100 % fehlerfrei“, „keine Sicherheitslücke möglich“ oder „CRA-zertifiziert“ dürfen ohne entsprechende Grundlage nicht gemacht werden.

## Inhaltsübersicht

- [1. Verbindlichkeit und Anwendung](#1-verbindlichkeit-und-anwendung)
- [2. Standards und Aktualität](#2-standards-und-aktualität)
- [3. Arbeitsablauf bei jeder Änderung](#3-arbeitsablauf-bei-jeder-änderung)
- [4. Architektur und Vertrauensgrenzen](#4-architektur-und-vertrauensgrenzen)
- [5. JavaScript, TypeScript und Codequalität](#5-javascript-typescript-und-codequalität)
- [6. Daten, Schnittstellen und Kommunikation](#6-daten-schnittstellen-und-kommunikation)
- [7. Anmeldung, Rechte, Geheimnisse und Lizenzen](#7-anmeldung-rechte-geheimnisse-und-lizenzen)
- [8. Betrieb ohne Root- und Administratorrechte](#8-betrieb-ohne-root--und-administratorrechte)
- [9. Zusätzliche Regeln für EOS und ioBroker](#9-zusätzliche-regeln-für-eos-und-iobroker)
- [10. Funktions- und Regelungssicherheit](#10-funktions--und-regelungssicherheit)
- [11. Verifikation und Regressionstests](#11-verifikation-und-regressionstests)
- [12. Abhängigkeiten, CI und Lieferkette](#12-abhängigkeiten-ci-und-lieferkette)
- [13. Updates, Sicherungen und Wiederherstellung](#13-updates-sicherungen-und-wiederherstellung)
- [14. Schwachstellen, Support und CRA](#14-schwachstellen-support-und-cra)
- [15. Dokumentation und Freigaben](#15-dokumentation-und-freigaben)
- [16. Einführung in vorhandene Projekte](#16-einführung-in-vorhandene-projekte)
- [17. Vorlage für den Änderungs- und Prüfvermerk](#17-vorlage-für-den-änderungs--und-prüfvermerk)
- [18. Offizielle Quellen](#18-offizielle-quellen)

## 1. Verbindlichkeit und Anwendung

**MUSS** bezeichnet eine verbindliche Anforderung. **SOLL** erlaubt eine begründete, dokumentierte Abweichung. **DARF NICHT** bezeichnet ein Verbot. Nicht anwendbare Anforderungen müssen mit einem konkreten Grund gekennzeichnet werden.

Diese Vorgabe gilt bei Neuentwicklung, Erweiterung, Fehlerbehebung, Refactoring, Sicherheitsprüfung, Abhängigkeitswechsel, Build, Paketierung und Release. Sie gilt auch für kleine Änderungen und KI-erzeugten Code. Für reine Textkorrekturen genügt eine angemessene Inhaltsprüfung; hierfür sind keine künstlichen Programmtests erforderlich.

Die allgemeinen Regeln gelten projektübergreifend. EOS-, ioBroker- und energietechnische Zusatzregeln gelten nur, wenn das jeweilige Projekt oder die betroffene Funktion dazu gehört. Bei unterstützter Fremdsoftware sind diese Regeln Prüf- und Integrationsmaßstab. Fehlender Einfluss auf deren Quellcode ist als Grenze zu dokumentieren und darf nicht als erfüllte Anforderung dargestellt werden.

Vorhandene, strengere Projektvorgaben bleiben erhalten. Neuere ausdrückliche Nutzerentscheidungen und höherrangige Vorgaben sind zu beachten. Widersprüche müssen benannt und vor der betroffenen Umsetzung geklärt werden. Diese Datei erteilt keine eigenständige Berechtigung für Veröffentlichungen, Produktivänderungen, Datenlöschung oder neue privilegierte Dienste.

Eine Abweichung muss Anforderung, Grund, Auswirkung, Gegenmaßnahmen, Verantwortlichkeit, Gültigkeitsdauer und Rückführung enthalten. Entwickler oder KI dürfen zentrale Schutzanforderungen nicht selbst außer Kraft setzen, um einen Build grün zu bekommen. Bereits autorisierte Routinearbeiten benötigen keine zusätzliche Grundsatzfreigabe.

**Anwendung durch Entwicklungsassistenten:** Diese Datei zu Beginn einer passenden Projektarbeit lesen und ihre Anforderungen während Entwurf, Umsetzung, Prüfung und Übergabe anwenden. Nachweise nennen, statt die vollständige Richtlinie bei jeder Antwort zu wiederholen. Eine bloß gespeicherte Markdown-Datei richtet keine CI-Prüfung, Überwachung oder Hintergrundautomation ein.

## 2. Standards und Aktualität

Die folgenden Bezüge bilden die fachliche Ausgangsbasis. Interne Anforderungen dieser Richtlinie sind nicht automatisch wörtliche Normanforderungen. Vollständige Normerfüllung erfordert eine eigene Zuordnung und belastbare Nachweise.

| Bezug | Am 25.10.2026 verifizierter Stand | Verwendung |
| --- | --- | --- |
| OWASP ASVS | 5.0.0, stabile Fassung vom 30.05.2025 | Web- und API-Anforderungen; Level 2 als interne Ausgangsbasis, zusätzliche Level-3-Anforderungen nach Risiko. [Q01] |
| OWASP Top 10 | Ausgabe 2025 | Ergänzender Risikokatalog; kein vollständiger Abnahmekatalog. [Q02] |
| NIST SSDF | SP 800-218, Version 1.1, Final, Februar 2022 | Sicherer Entwicklungslebenszyklus und Schwachstellenbehandlung. [Q03] |
| NIST SSDF 1.2 | SP 800-218 Rev. 1, Initial Public Draft vom 17.12.2025 | Entwicklung beobachten; nicht als finale Fassung ausgeben. [Q04] |
| IEC 62443-4-1 | IEC-Basisfassung 2018 | Sicherer Entwicklungsprozess für anwendbare industrielle Produkte. [Q05] |
| IEC 62443-4-2 | IEC-Basisfassung 2019 | Anwendbare technische Komponentenanforderungen. [Q06] |
| IEC 62443-3-2 und -3-3 | Basisfassungen 2020 bzw. 2013; bei -3-3 ist das Korrigendum 2014 enthalten | Systemrisiken, Zonen, Kommunikationsverbindungen und Systemanforderungen. [Q07, Q08] |
| Cyber Resilience Act | Verordnung (EU) 2024/2847 | Produktbezogene gesetzliche Pflichten, soweit anwendbar; siehe Abschnitt 14. [Q09, Q10] |

Die IEC-Angaben wurden anhand der offiziellen Katalogbeschreibungen geprüft. Eine vollständige Prüfung der kostenpflichtigen Normtexte ist damit nicht erfolgt. Europäische oder nationale Übernahmen, Änderungen und tatsächlich harmonisierte Normverweise müssen bei einer konkreten Konformitätsbewertung zusätzlich geprüft werden.

Vor jeder Produktionsfreigabe und bei relevanten Sicherheitsmeldungen müssen die verwendeten Fassungen, Advisories und Supportstände erneut anhand offizieller Quellen geprüft werden. Für laufend gepflegte Projekte SOLL zusätzlich mindestens monatlich ein dokumentierter Abgleich erfolgen. Dies ist eine Arbeitsanforderung und keine durch diese Datei bereits eingerichtete Automation.

„Aktuell“ bedeutet: gepflegt, für das Zielsystem geeignet, nachvollziehbar versioniert und geprüft. Eine ungetestete neue Hauptversion ist keine automatische Sicherheitsverbesserung. Entwürfe und Vorabversionen sind ausdrücklich zu kennzeichnen.

Ergänzung auf ausdrückliche Nutzerentscheidung vom 05.11.2026: EOS Admin unterstützt auch bestehende Anlagen mit Node.js 22. Für diesen Adapter gelten die geprüften Sicherheitsprofile Node.js >=22.23.4 <23 oder >=24.22.1 <25; ein Wechsel der Hauptversion ist für Node-22-Anlagen nicht allein wegen des Admin-Updates erforderlich. Die historische Festlegung von Node.js 24 als Mindest-Hauptversion wird für EOS Admin damit ersetzt. Eingesetzt wird eine unterstützte und für EOS geprüfte LTS-Linie mit geprüftem Sicherheits-Patchstand. Die allgemeine Auswahl gepflegter Laufzeiten gilt auch für andere Projekte; deren Versionsvorgaben sind projektspezifisch festzulegen. Betriebssystem, Controller, Datenbank, Frameworks und Gerätefirmware gehören ebenfalls ins Versionsregister. [Q11]

## 3. Arbeitsablauf bei jeder Änderung

1. **Ausgangslage feststellen:** Repository, Branch, Quellstand, lokale Änderungen, Projektanweisungen, vorhandene Berichte und offene Befunde lesen. Keine aktuelle Funktions- oder Sicherheitsbewertung aus alten Chat-Aussagen ableiten.
2. **Sollverhalten sichern:** Betroffene Funktionen, Nutzerabläufe, Datenpunkte, Einheiten, Grenzwerte, Zustandsübergänge, unterstützte Geräte und Abhängigkeiten erfassen. Bestehende Fehler nicht als gewolltes Verhalten konservieren.
3. **Risiko bestimmen:** Eingaben, Rechte, Kommunikationswege, Geheimnisse, Datenverlust, Verfügbarkeit und mögliche physische Folgen betrachten. Prüfumfang vor der Änderung festlegen.
4. **Gezielt umsetzen:** Kleine, nachvollziehbare Änderungen vornehmen. Sicherheitsmaßnahmen müssen zur Architektur passen. Keine ungefragte Komplettmigration bei einer kleinen Korrektur.
5. **Nachweisen:** Relevante positive, negative und Regressionstests ausführen. Sicherheitskritische Wechselwirkungen und den Betrieb mit eingeschränkten Rechten prüfen.
6. **Dokumentieren:** Änderung, Sicherheitswirkung, tatsächliche Tests, offene Punkte und betroffene Unterlagen im gleichen Stand aktualisieren.
7. **Ehrlich übergeben:** Lieferstand und Prüfstand eindeutig zuordnen. Fehlende Hardware- oder Integrationstests als offen ausweisen und eine passende Testanleitung mitliefern.

Ein Fehlerfix MUSS einen reproduzierenden Test erhalten, wenn sich das Fehlerbild sinnvoll automatisiert prüfen lässt. Tests sollen gefordertes Verhalten und relevante Fehlerfälle prüfen; sie dürfen nicht lediglich die Implementierung abschreiben.

## 4. Architektur und Vertrauensgrenzen

- Für jedes Produkt ein angemessenes Bedrohungsmodell mit geschützten Werten, Angreifermöglichkeiten, Datenflüssen und Vertrauensgrenzen führen. Auch lokale Benutzer, kompromittierte Geräte, fremde Adapter, manipulierte Updates und gestohlene Zugangsdaten berücksichtigen.
- UI, API, fachliche Logik, Gerätezugriff, Persistenz und Systemverwaltung klar abgrenzen. Sicherheitsentscheidungen serverseitig treffen. Eine ausgeblendete Schaltfläche ersetzt keine Berechtigungsprüfung.
- Minimale Rechte und sichere Voreinstellungen verwenden. Nicht benötigte Listener, Protokolle, Debugschnittstellen und Schreibfunktionen deaktivieren. Netzwerkfreigaben, Ziele und Ports explizit dokumentieren.
- Unvertrauenswürdige Erweiterungen nicht als sicher isoliert betrachten, nur weil sie in einem separaten JavaScript-Modul laufen. Gemeinsame UID, Dateirechte, Datenbankzugänge und IPC-Verbindungen können gemeinsame Schadensbereiche schaffen.
- Node.js-Berechtigungsmodelle sind eine zusätzliche Begrenzung für vertrauenswürdigen Code und keine belastbare Sandbox gegen bösartigen Code. Betriebssystemgrenzen bleiben erforderlich. [Q12]
- Kontrollebene und zeitkritische Regelung so entkoppeln, dass UI-, Cloud-, Update- oder Diagnosefehler die lokale Regelung nicht unkontrolliert blockieren.
- Betriebssystem- und Hardware-Schutzfunktionen nicht durch eine Softwarebehauptung ersetzen. Schutzgeräte und notwendige unabhängige Anlagenbegrenzungen müssen wirksam bleiben.

### 4.1 Drei Säulen für Steuerungs- und Energiemanagementsysteme

| Säule | Ziel | Verbindlicher Nachweis |
| --- | --- | --- |
| Funktionale Sicherheit | Personen und Sachen bei gefährlichen Fehlern schützen | Risikobeurteilung, geeignete unabhängige Schutzfunktionen und Prüfung der gesamten Sicherheitskette |
| Codequalität und funktionale Korrektheit | Verlässliche Berechnungen, Zustände und Bedienabläufe | Typprüfung, Laufzeitvalidierung, fachliche Tests, Regression und nachvollziehbares Fehlerverhalten |
| Cybersicherheit und Lieferkette | Unbefugte Zugriffe, Manipulation und kompromittierte Komponenten begrenzen | Rechtekonzept, sichere Schnittstellen, Herkunfts-/Abhängigkeitsprüfung und Schwachstellenbehandlung |

Die Säulen ergänzen einander. Eine bestandene Cybersicherheitsprüfung ersetzt keinen Nachweis funktionaler Sicherheit; ein zertifiziertes Schutzgerät macht die angebundene Webanwendung nicht automatisch sicher.

### 4.2 EMS und unabhängige Schutzfunktionen

- TypeScript-/JavaScript-EMS dürfen optimieren, überwachen und fachliche Sollwerte erzeugen. Not-Halt, sicherheitsrelevanter Übertemperaturschutz und vergleichbare Schutzfunktionen mit Personen-/Sachschadenrisiko dürfen nicht ausschließlich von der gewöhnlichen EMS-Laufzeit, deren Netzwerk oder einem einzelnen Softwareprozess abhängen.
- Für jede Gefahr festlegen, welche unabhängige Schutzfunktion notwendig ist, welche Sensorik und Abschalt-/Begrenzungskette sie verwendet und welche Reaktionszeit sie einhalten muss. Gemeinsame Fehlerursachen wie Versorgungsausfall, gemeinsame Sensorik oder gemeinsam veränderbare Konfiguration bewerten.
- Geeignete und nach den anwendbaren Anforderungen nachgewiesene, gegebenenfalls zertifizierte Schutzkomponenten verwenden. Das können vorhandene Geräteschutzfunktionen, Schutzrelais, Sicherheitsschaltgeräte oder eine geeignete Sicherheits-SPS sein. Nicht pauschal für jede EMS-Funktion einen zusätzlichen Mikrocontroller verlangen.
- Eine gewöhnliche SPS, ein Mikrocontroller, C, Rust oder MISRA-Regeln allein begründen weder einen Safety-Nachweis noch ein SIL-/PL-Niveau. Auch eine zertifizierte Komponente muss innerhalb ihrer Einsatzbedingungen korrekt in die gesamte Schutzkette integriert und geprüft werden. [Q24, Q25]
- Je nach Anwendungsbereich passende Normen und Nachweise bestimmen, beispielsweise IEC 61508 beziehungsweise für Maschinensicherheit IEC 62061 oder ISO 13849. Kein pauschales SIL oder PL festlegen; notwendiges Niveau aus der anwendbaren Risikobeurteilung ableiten. Die aktuellen konkreten Ausgaben vor Verwendung prüfen. [Q24]
- Das EMS darf die erforderliche Schutzkette weder umgehen noch ihre notwendigen Grenzwerte beliebig verändern. Kommunikationsverlust, Prozessstillstand und Cyberangriffe in der Sicherheitsbetrachtung berücksichtigen.
- Bei betroffenen Maschinen darf das Entriegeln oder Quittieren eines Not-Halts allein keinen gefährlichen automatischen Wiederanlauf auslösen. Wiederanlaufbedingungen und einen gegebenenfalls erforderlichen separaten bewussten Startbefehl anhand der gültigen Sicherheitsanforderungen auslegen und prüfen.
- Eigene Firmware benötigt eine gesonderte sprach- und toolchainspezifische Entwicklungsregel. MISRA ist gezielt auf die passende Sprache/Fassung anzuwenden; eine Betrachtung der Übertragbarkeit auf Rust ist kein pauschales Zertifikat für Rust-Software. [Q25]

## 5. JavaScript, TypeScript und Codequalität

### 5.1 Gemeinsame Anforderungen

- Unterstützte ECMAScript-, Node.js-, TypeScript- und Framework-Funktionen verwenden. Das Kompilierungsziel muss zu allen freigegebenen Laufzeiten passen. Keine experimentellen Funktionen in kritischen Produktionspfaden ohne gesonderten Nachweis.
- Verständliche Namen, kleine fachlich zusammengehörige Module und klar definierte Schnittstellen verwenden. Einheiten und Wertebereiche in Typen, Namen oder Schnittstellenbeschreibung sichtbar machen.
- Vorhandenes ESM-/CommonJS-Modell bewusst erhalten oder mit dokumentierter Migration ändern. Keine unkontrollierte Mischung und kein Modulumbau allein für optische Modernisierung.
- Formatierung und Lint-Regeln projektweit verbindlich ausführen. Neue relevante Lint- und Typfehler dürfen nicht übernommen werden. Bestehende Schulden mit Kennung und Plan führen; Warnungen nicht pauschal abschalten.
- `const` bevorzugen; veränderlichen Zustand begrenzen. Keine unübersichtlichen globalen Zustände, versteckten Seiteneffekte oder mehrfachen konkurrierenden Schreibpfade.
- Kritische Berechnungen von IO trennen. Reine Berechnungsfunktionen mit expliziten Eingaben erleichtern reproduzierbare Tests.
- Keine dynamische Codeausführung durch `eval`, `new Function` oder nachgeladene ungeprüfte Skripte. Ein absichtlich vorhandenes Automatisierungs-/Scripting-Produkt benötigt ein eigenes Rechte- und Isolationskonzept; diese allgemeine Regel erlaubt keine solche Erweiterung.

### 5.2 TypeScript

Für eigene neue TS-Projekte gilt mindestens das folgende Prüfprofil. Vorhandene Projekte müssen im geänderten Bereich entsprechend verbessert und verbleibende Migrationen dokumentiert werden. Die Optionen ergänzen die bestehende Build-Konfiguration; `target`, `module` und `moduleResolution` werden passend zum tatsächlichen Projekt festgelegt. [Q13]

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "noEmitOnError": true
  }
}
```

- Im eigenen geänderten Produktcode kein explizites oder implizites `any` als Ausweg verwenden. An externen Grenzen `unknown` annehmen und vor Verwendung validieren. Unzureichende Fremdtypen durch schmale, geprüfte Adapter abgrenzen.
- `strict` schaltet `noImplicitAny` grundsätzlich mit ein; die zusätzliche explizite Angabe macht die Vorgabe sichtbar. Einzelne Strict-Prüfungen dürfen nicht still wieder deaktiviert werden. [Q13]
- Keine ungeprüften Typumdeutungen wie `as unknown as Zieltyp`, flächiges `@ts-ignore`, `@ts-nocheck` oder Non-null-Behauptungen als Ersatz für Prüfungen.
- Fachliche Zustände als klar unterscheidbare Typen abbilden. Vollständigkeit von Zustandswechseln prüfen; unerwartete Zustände müssen behandelt werden.
- Typprüfung separat in CI ausführen, auch wenn ein Bundler oder die Laufzeit TypeScript direkt akzeptiert. Transpilierung beziehungsweise Entfernen von Typannotationen ist kein Typnachweis.
- Zusätzliche Lint-Regeln gegen unbehandelte Promises, falsch verwendete Promises und unsichere Werteflüsse aktivieren. Unterdrückungen nur punktuell, begründet und nachvollziehbar.

### 5.3 JavaScript

- JavaScript erhält die gleichen Sicherheits-, Fehler- und Testanforderungen wie TypeScript.
- Eigene JS-Dateien mit präzisem JSDoc typisieren und durch `checkJs` beziehungsweise `// @ts-check` statisch prüfen. Bei Bestandsprojekten die tatsächlich erfassten Dateien und noch offene Bereiche ausweisen.
- ESM oder einen passenden Strict-Modus verwenden. Keine stillen Typumwandlungen für fachlich relevante Werte. Ein numerischer String ist kein validierter Messwert.
- Eine vollständige TS-Migration ist nicht bei jeder Korrektur erforderlich. Umfang und Nutzen einer Migration gesondert planen und das bisherige Verhalten prüfen.

### 5.4 Asynchronität und Ressourcen

- Jede Promise muss erwartet oder mit einem begründeten, vollständig behandelten Hintergrundpfad versehen werden. Ein vorangestelltes `void` ersetzt keine Fehlerbehandlung.
- Keine leeren `catch`-Blöcke, keine verschluckten Gerätefehler und kein Weiterlaufen mit unbekannt inkonsistentem Zustand. Fehler fachlich klassifizieren, geeigneten Fallback ausführen und bereinigt protokollieren.
- Timer, Listener, Sockets und Abbruchsignale bei Stop, Fehler und Neustart aufräumen. Wiederanlauf darf keine doppelten Regelzyklen erzeugen.
- Überlappende Regelzyklen verhindern. Pro Gerät eine kontrollierte Befehlsfolge; überholte Befehle verwerfen und ausstehende Arbeit begrenzen.
- Keine blockierenden Dateizugriffe, synchronen Kindprozesse, Endlosschleifen oder teuren unbeschränkten Berechnungen im Regelpfad. Warteschlangen, Eingabegrößen, Parallelität und Speicherverbrauch begrenzen. [Q14]

### 5.5 Verbindliche Prüffunktionen, passende Werkzeugauswahl

Die Prüffunktion ist Pflicht; ein konkretes kommerzielles Produkt ist damit nicht vorgeschrieben. Werkzeuge nach Sprache, Versionsunterstützung, tatsächlicher Prüftiefe, Lizenz, Datenschutz und Wartbarkeit auswählen. Quellcode oder Kundendaten nicht ungeprüft an einen externen Analysedienst übertragen.

| Aufgabe | Geeigneter Ansatz | Grenze / Umsetzungsregel |
| --- | --- | --- |
| Typprüfung | Separater TypeScript-Prüflauf, auch für entsprechend eingerichtetes JavaScript | Muss den relevanten eigenen Code erfassen; Bundler-Erfolg genügt nicht |
| Linting | ESLint mit typinformierten typescript-eslint-Regeln, z. B. `recommendedTypeChecked` und gezielt strengeren Regeln | Das einfache `recommended`-Profil allein umfasst nicht alle Regeln mit Typinformation; Konfiguration und Regelversionen festhalten. [Q26] |
| Sicherheitsmuster | Ergänzende Regeln wie `eslint-plugin-security` | Liefert Prüfansätze und mögliche Fehlalarme; keine vollständige Schwachstellenerkennung. Verbindliche Regeln zusätzlich in CI ausführen, nicht nur im Editor. [Q27] |
| Laufzeitvalidierung | Geprüfte Schema-/Validierungsfunktionen; bei passender Architektur z. B. Zod oder TypeBox mit tatsächlich ausgeführter Prüfung | Keine Pflicht zur neuen Bibliothek; EOS-Kernregel aus Abschnitt 9 beachten. Auch fachliche Plausibilität, Aktualität und Ressourcenlimits prüfen. [Q28] |
| Statische Sicherheitsanalyse | Geeigneter JS-/TS-Analyzer, z. B. SonarQube oder PVS-Studio mit JS-/TS-Unterstützung | Unterstützte Version, Regelumfang und Lizenz prüfen; PVS-Studio hat JS-/TS-Analyzer seit Version 8.00 eingeführt. Keine Vollständigkeitsbehauptung. [Q29] |
| Abhängigkeitsanalyse | npm audit und nach Bedarf ergänzende SCA-Werkzeuge wie Snyk oder OWASP Dependency-Check | Lockfile-/Ökosystem-Unterstützung und Datenquellen prüfen; Toolfehler oder veraltete Daten sind kein bestandener Scan. Bekannte und unbekannte Lücken unterscheiden. [Q30] |

### 5.6 Laufzeitwahl: Node.js und mögliche Alternativen

EOS bleibt auf seiner festgelegten und geprüften Node.js-/ioBroker-Basis, solange keine gesondert geprüfte Architekturänderung vorliegt. Deno bietet standardmäßig begrenzte Berechtigungen, ist aber kein pauschaler Sicherheitsnachweis. Breite Freigaben, Kindprozesse und native Erweiterungen beeinflussen die tatsächlich verbleibenden Grenzen. [Q31]

Eine Migration darf nicht allein mit „Deno ist sicherer“ begründet werden. Controller, Adapter-APIs, npm-Abhängigkeiten, native Module, Start-/Updatepfade und alle bisherigen Funktionen müssen geprüft werden. Node-/npm-Kompatibilität bedeutet keine automatisch nachgewiesene Kompatibilität des gesamten EOS-Systems. Für getrennte neue Dienste kann Deno nach derselben Risiko-, Funktions- und Rechtebewertung eine Option sein. [Q31]

## 6. Daten, Schnittstellen und Kommunikation

### 6.1 Laufzeitvalidierung

Alle externen Daten gelten zunächst als unvertrauenswürdig: HTTP, WebSocket, MQTT, Modbus, OCPP, EEBUS, Dateien, Importe, Datenbankinhalte, Konfiguration, IPC und ioBroker-States.

Vor fachlicher Verwendung müssen Struktur, erlaubte Felder, Pflichtfelder, Datentypen, Länge, Größe, erlaubte Werte, endliche Zahlen, Einheit, Vorzeichen, Zeitstempel und Aktualität geprüft werden. Fachliche Zusammenhänge und Arraylängen müssen zusammenpassen. Herkunft und Schreibberechtigung sind getrennt von der Datenform zu prüfen.

`null`, `undefined`, leere Strings, Boolean-Werte, `NaN` und Unendlich dürfen nicht unbemerkt zu gültigen Messwerten werden. „Fehlend“, „ungültig“, „veraltet“ und „0“ sind unterschiedliche Zustände. Die letzte gültige Messung darf angezeigt werden, aber nicht mit einem neuen Zeitstempel als frisch erscheinen.

Teilweise ungültige Konfigurationen, Preisreihen oder Fahrpläne dürfen nicht unbemerkt als vollständiger neuer Stand aktiviert werden. Änderungen transaktional oder mit einer gleichwertig konsistenten Aktivierung übernehmen.

### 6.2 Netzwerkzugriffe

- Für externe HTTPS-Datenabrufe von EOS sowie sämtlichen eigenen und unterstützten ioBroker-Adaptern gilt das bestehende Gesamtbudget von höchstens **5.000 ms**, einschließlich DNS, Verbindungsaufbau, TLS, Header, Antwortkörper, zugehöriger Authentifizierung, Retries und Fallbacks. Für andere Projekte ebenfalls eine tatsächliche Gesamtdeadline festlegen; 5.000 ms als Ausgangswert verwenden und fachlich notwendige Abweichungen mit Ressourcen- und Verfügbarkeitsfolgen dokumentieren.
- Der Ablauf muss tatsächlich abbrechen und Ressourcen freigeben. Ein alleinstehendes `Promise.race` oder ein bei jedem Datenchunk erneuertes Inaktivitätslimit genügt nicht.
- Externe Abrufe dürfen den lokalen Regelzyklus nicht blockieren. Jeder Geräteauftrag erhält zusätzlich eine zum Protokoll und Anlagenrisiko passende Deadline. Eine Fünf-Sekunden-Internetdeadline ist keine zulässige Reaktionszeit für jede Gerätefunktion.
- Große Update-/Backupübertragungen und dauerhafte Verbindungen erhalten ein eigenes dokumentiertes Profil mit Größen-, Verbindungs- und Zeitgrenzen; sie dürfen nicht als Umgehung für normale Datenabrufe dienen.
- Wiederholungen begrenzen, Abstand und gegebenenfalls Jitter verwenden. Schreibbefehle nur erneut senden, wenn dies fachlich sicher ist; Idempotenz oder Duplikaterkennung vorsehen.
- Zieladressen und Redirects gegen SSRF prüfen. Für Gerätekommunikation gezielt freigegebene lokale Netze erlauben; kein pauschales Verbot privater IP-Adressen, das die Geräteanbindung zerstört. Loopback, Metadatendienste, DNS-Wechsel und Redirect-Ziele passend zum jeweiligen Zugriffspfad berücksichtigen.
- TLS mit Zertifikats- und Hostnamenprüfung verwenden. TLS 1.3 bevorzugen; TLS 1.2 nur mit dokumentiertem Kompatibilitätsbedarf und geeigneter Konfiguration. Ältere Versionen für eigene Schnittstellen nicht zulassen. Gerätespezifisch unverschlüsselte Protokolle durch definierte Netzgrenzen und Zugriffsregeln begrenzen. [Q20]

### 6.3 Injektion, Dateien und Weboberflächen

- Datenbankzugriffe parametrisieren. Tabellen-, Sortier- und Feldnamen, die nicht parametrisiert werden können, durch feste Zulassungslisten begrenzen.
- Beim Zusammenführen fremder Objekte vor Prototype Pollution schützen: nur vorgesehene eigene Eigenschaften übernehmen und gefährliche Schlüssel-/Prototypzugriffe verhindern. Reguläre Ausdrücke und Parser gegen übermäßigen Rechen- und Speicherbedarf begrenzen.
- Betriebssystemaufrufe vermeiden. Falls fachlich erforderlich, feste ausführbare Programme und Argumentlisten verwenden; keine Shell-Strings aus Eingaben und kein `shell: true` für unkontrollierte Daten.
- Dateizugriffe auf definierte Wurzeln begrenzen. Pfadtraversal, symbolische Links, Archivpfade, Größenlimits und Zeitfenster zwischen Prüfung und Zugriff beachten. Ein einfaches String-Präfix ist kein ausreichender Verzeichnisnachweis.
- Uploads und Archive vor Aktivierung prüfen. Keine extrahierten Skripte automatisch ausführen. Entpackungsgröße und Dateianzahl begrenzen.
- Ausgaben kontextgerecht kodieren. Kein ungeprüftes HTML, keine unsicheren URL-Schemata und keine direkte Übernahme fremder Inhalte in aktive DOM-Schnittstellen.
- CORS, CSRF-Schutz, Content Security Policy und sichere Antwortheader passend zum tatsächlichen Browser- und Sitzungsmodell konfigurieren. WebSocket-Verbindungen und jede relevante Nachricht authentifizieren und autorisieren.
- Konfigurierbare Regeln und Geräteeditoren dürfen nur das vorgesehene Datenmodell und freigegebene Aktionen abbilden. Beliebige JS-Ausführung oder beliebige Systembefehle sind keine zulässige Abkürzung.

## 7. Anmeldung, Rechte, Geheimnisse und Lizenzen

- Jede geschützte API-Aktion muss serverseitig authentifiziert und autorisiert werden. Objekt-, Geräte-, Mandanten- und Funktionsrechte prüfen; auch bei Direktaufruf ohne UI.
- Rollenwechsel, Benutzerentzug, Ablauf und Widerruf bestehender Sitzungen berücksichtigen. Schutz gegen automatisierte Anmeldeversuche und massenhafte Befehle vorsehen, ohne unnötige globale Aussperrung.
- Keine gemeinsamen Standardpasswörter, eingebauten Masterzugänge oder geheimen Testkonten. Initiale Einrichtung, sichere Passwortsetzung und Wiederherstellung definieren.
- Passwörter zur eigenen Benutzeranmeldung mit einer geeigneten etablierten Passwort-Hashfunktion und individuellen Salts speichern. Für diese Passwortverifikation keine reversible Ablage verwenden. Externe Geräte-/Dienstpasswörter, die zur Anmeldung am Ziel im Original benötigt werden, in einem geschützten Credential-Speicher beziehungsweise verschlüsselt mit getrennt geschütztem Schlüssel verwahren; nicht durch unbrauchbares Hashing die Gerätefunktion zerstören. Keine selbst entworfene Kryptografie. Sitzungskennungen und Tokens kryptografisch zufällig erzeugen. [Q21]
- Sitzungsdaten vor unbefugtem Browser- und Fremdseitenzugriff schützen. Für Cookie-Sitzungen angemessenes `HttpOnly`, `Secure` und `SameSite` verwenden; Tokens nicht in URLs oder öffentlich auslesbaren Dateien ablegen.
- Geheimnisse aus Quellcode, Frontend-Bundles, Beispielkonfiguration, npm-Paketen, ZIPs, Logs, Tests und Berichten heraushalten. Geschützte Konfiguration, Credential-Dateien oder einen geeigneten Secret-Speicher nutzen. Umgebungsvariablen allein sind keine Isolation gegen denselben Benutzer oder Prozessdiagnosen.
- Bereits mitgelieferte, veröffentlichte oder anderweitig offengelegte Geheimnisse als potenziell kompromittiert behandeln. Betroffene Zugänge und private Schlüssel widerrufen beziehungsweise rotieren; sichere Verteilung, kompatible Migration und Auswirkungen auf Geräte- und Updatefunktionen planen. Bloßes Entfernen aus dem aktuellen Quellstand genügt nicht.
- Öffentlich überprüfbare Signaturschlüssel von privaten Signier- und Entschlüsselungsschlüsseln unterscheiden. Private Hersteller-/Release-Schlüssel dürfen nicht auf Kundengeräten oder in Adaptern liegen.
- Lizenzprüfung serverseitig durchführen und Integrität kryptografisch prüfen. Vertrauliche Lizenzinhalte benötigen zusätzlich ein eigenes Verschlüsselungs- und Schlüsselkonzept. Verschlüsselung ersetzt keine Signatur und Obfuskation keinen Zugriffsschutz.
- Lizenzentzug, abgelaufene Lizenz und fehlerhafte Uhrzeit dürfen keine unkontrollierte physische Aktion auslösen. Sicherheitsgrenzen und betrieblich notwendige Fallbacks müssen wirksam bleiben.
- Ein lokaler Angreifer mit vollständiger Kontrolle über Betriebssystem und Programmdateien ist eine eigene Vertrauensgrenze. Für rein lokale Lizenzkontrolle keine absolute Manipulationssicherheit versprechen.
- Protokolle datensparsam und strukturiert führen. Tokens, vollständige Request-Bodies und Geräte-/Kundengeheimnisse redigieren. Rotation, Größenlimits, Zugriffsrechte und brauchbare Ereigniskennungen vorsehen.

## 8. Betrieb ohne Root- und Administratorrechte

### 8.1 Verbindlicher Anwendungsbetrieb

Eigene Anwendungen, EOS-Controller, Adapter, APIs, UI-Backends und Regelungen MÜSSEN im regulären Betrieb mit unprivilegierten Konten funktionieren. Unter Linux gilt eine effektive UID ungleich 0, unter Windows ein Konto ohne Administrator-/SYSTEM-Rechte. Datenbankkonten dürfen keine unnötigen Superuser-, Eigentümer- oder DDL-Rechte erhalten.

Unzulässig sind insbesondere:

- `sudo`, `su`, UAC-Erhöhung oder gleichwertige automatische Selbstprivilegierung im Anwendungsablauf;
- pauschales `NOPASSWD`, Administratorgruppen oder Mitgliedschaft in einer Gruppe mit gleichwertigem Hostzugriff;
- ein erreichbarer Docker-/Containerd-Hostsocket, beliebige privilegierte IPC-Aufrufe oder ein universeller Root-Befehlsdienst;
- privilegierte Container, unnötige Host-Mounts, Hostgeräte oder Host-PID-Zugriffe;
- breite Linux-Capabilities am gemeinsamen `node`-Interpreter, insbesondere `CAP_SYS_ADMIN`, `CAP_NET_ADMIN` oder unnötige Raw-Socket-Rechte;
- `chmod 777`, weltweit beschreibbare Programmdateien oder das Herabsetzen von Zugriffsschutz als Fehlerbehebung.

Die Anwendung benötigt nur ihre festgelegten Daten-, Log-, Cache- und Laufzeitverzeichnisse. Programmdateien, Startkonfiguration und Sicherheitskonfiguration sollen nicht vom normalen Anwendungsprozess veränderbar sein. Eine getrennte Update-Identität und geprüfte Aktivierung bevorzugen; deren Rechte dürfen nicht still in den Adapterprozess zurückfließen.

Bevorzugt nicht privilegierte lokale Listener-Ports verwenden. Eine ausgehende TCP-Verbindung zu einem Geräteport wie 502 oder einem HTTPS-Port wie 443 erfordert allein wegen dieser Zielportnummer keine Root-Rechte. Serielle Geräte über gezielte Geräteberechtigungen beziehungsweise passende ACLs zugänglich machen, ohne pauschale Hostrechte zu geben.

### 8.2 Systemeinrichtung und technisch privilegierte Funktionen

Eine Neuinstallation von Betriebssystempaketen, Änderungen geschützter Systemdateien, Host-Firewallregeln oder bestimmte DHCP-/Netzwerkaufgaben können Berechtigungen benötigen, die ein normaler Prozess bewusst nicht besitzt. Solche Aufgaben dürfen nicht durch eine falsche „alles rootlos“-Behauptung verdeckt werden.

Vorrang haben vorab konfigurierte Betriebssystemfunktionen, externe Netzwerkgeräte, unprivilegierte Benutzerinstallation und klar begrenzte vorhandene Mechanismen. Die Anwendung muss auch bei fehlender Systemberechtigung definiert reagieren und darf keinen privilegierten Ersatzweg selbst aktivieren.

**Ein neuer privilegierter Hilfsdienst oder privilegiertes Setup ist durch diese Richtlinie nicht pauschal freigegeben.** Wenn eine Anforderung ohne erhöhte Rechte nicht erfüllbar ist, muss die konkrete Grenze mit einer Alternative beschrieben werden. Eine erforderliche Abweichung ist gesondert zu entscheiden. Ein System mit notwendigem privilegiertem Verwaltungsdienst darf nur als „Anwendungsbetrieb ohne Root“ bezeichnet werden, nicht als vollständig rootloses Gesamtsystem.

Auch ein begrenzter Systemdienst benötigt bei gesondert erlaubtem Einsatz eine schmale, authentifizierte und autorisierte Schnittstelle, feste Aktionen, streng validierte Parameter, minimale Rechte und einen eigenen Nachweis. Niemals beliebige Shell-Befehle, Pfade oder Dienstnamen durchreichen.

### 8.3 Härtung und Nachweis

Für Linux-Dienste passende systemd-Schutzmaßnahmen prüfen, etwa `User=`, `Group=`, `NoNewPrivileges=`, leere oder eng begrenzte Capability-Mengen, Dateisystemschutz und explizite beschreibbare Pfade. Einstellungen gegen die tatsächlich verwendete systemd-Version und Gerätefunktionen testen. `NoNewPrivileges` verhindert nicht automatisch den Missbrauch eines bereits zugänglichen privilegierten Dienstes. [Q15]

Container sollen mit einer numerischen UID ungleich 0, minimalen Rechten, begrenzten Ressourcen und schreibgeschütztem Root-Dateisystem betrieben werden; benötigte Datenpfade separat bereitstellen. Rootless-Containerbetrieb auf dem Host verwenden, soweit die Plattform ihn unterstützt. Containerbenutzer und Rechte des Containerdienstes getrennt nachweisen. [Q16]

Der Nachweis MUSS mindestens Benutzerkennung, zusätzliche Gruppen, Capabilities, Dateirechte, erreichbare privilegierte Sockets/Dienste und tatsächliche Funktionsprüfungen mit diesen Rechten umfassen. Ein im Dockerfile eingetragenes `USER` oder ein erfolgreiches `id` allein reicht nicht.

## 9. Zusätzliche Regeln für EOS und ioBroker

- Vorhandene Adapterstruktur und unterstützte ioBroker-APIs verwenden. Controller- und Adapterversionen, Startverhalten und Lebenszyklus dokumentieren. Im `unload`-Pfad Aufträge, Timer, Listener und Verbindungen kontrolliert beenden. [Q17]
- Objekt- und Datenpunkt-IDs, Typen, Einheiten, Rollen, Lese-/Schreibflags und Konfigurationsfelder kompatibel halten. Notwendige Änderungen mit Migration, Rückfall und betroffenen Fremdzugriffen dokumentieren.
- Schreibbefehle, Bestätigungen und Messwerte sauber unterscheiden. `ack`, `from` oder ein erwarteter Datenpunktname sind allein kein Beweis für Berechtigung oder vertrauenswürdige Herkunft.
- Fremde States nur innerhalb des fachlich vorgesehenen und berechtigten Zielumfangs schreiben. Wildcard-Zugriffe, `sendTo`, Hostbefehle und Adapterverwaltung als eigene Sicherheitsgrenzen behandeln.
- Pro Gerät und Stellgröße eine eindeutige Zuständigkeit für Sollwerte festlegen. Mehrere Apps dürfen nicht ungeprüft parallel gegeneinander regeln.
- Gemeinsame ioBroker-Datenbanken und Betriebssystemkonten als mögliche gemeinsame Vertrauenszone berücksichtigen. Ein weiterer Sicherheitsadapter im selben Prozess-/Rechtebereich ersetzt keine Isolation.
- Das lokale EOS-Betriebsmodell erhalten. Cloud-, Lizenz-, Wetter- oder Tarifausfälle dürfen lokale Schutz- und Kernfunktionen nicht unkontrolliert ausfallen lassen.
- Unverschlüsselte Geräteprotokolle nur in dafür vorgesehenen Netzen einsetzen. Zonen, erlaubte Kommunikationsbeziehungen und Fernwartungszugriffe dokumentieren. VPN/Tailscale ersetzt keine Anwendungsrechte oder TLS-Prüfung.
- Für neue eigene sicherheitskritische Kernmodule keine zusätzlichen externen npm-Laufzeitabhängigkeiten einführen. Vorhandene Plattformabhängigkeiten und unvermeidbare Fremdkomponenten offen erfassen. Wenn eine geeignete Lösung diese Vorgabe nicht erfüllen kann, den konkreten Zielkonflikt offenlegen; keine eigene Kryptografie oder vermeintlich sichere Eigenimplementierung als Umgehung erfinden.
- Nativbetrieb und gegebenenfalls Containerbetrieb separat nachweisen. Eine bestehende native Freigabe ist keine automatische Containerfreigabe.

## 10. Funktions- und Regelungssicherheit

### 10.1 Fachliche Verträge

Jede relevante Funktion erhält ein dokumentiertes Sollverhalten: Eingaben, Voraussetzungen, gültige Betriebsarten, zulässige Sollwerte, Prioritäten, Fehlerfälle, Zeitgrenzen und Wiederanlauf. Ein Sicherheitsfix darf keine Funktion still entfernen oder durch eine Attrappe ersetzen.

Für EOS sind mindestens folgende Zusammenhänge bei betroffenen Änderungen zu prüfen:

| Funktionsbereich | Zu erhaltendes Verhalten und relevante Prüfungen |
| --- | --- |
| Netzanschlusspunkt | Import-/Exportgrenzen, Vorzeichen, Reserven, Rampen, Summenbildung und Messpunktzuordnung |
| Statischer/dynamischer NVP | Bestehender statischer Betrieb; Trennung von M0/M1, übergeordnete Begrenzung und Verhalten bei Ausfall eines Zählers |
| Speicher und Speicherfarm | Lade-/Entladegrenzen, SOC-Grenzen, Betriebsarten, Prioritäten und Vermeidung unerwünschter gegenseitiger Beladung |
| PV und Nulleinspeisung | Messverzögerungen, verfügbare Stellglieder, Reserven und kontrollierte Reaktion auf fehlende Messung oder Geräteantwort |
| Laden | Alle freigegebenen Modi, Mindest-/Maximalwerte, Start/Stop, mehrere Ladepunkte, Stationen, Phasen und AC-/DC-Besonderheiten |
| Wärme/Heizstäbe | Zeitfreigaben, Nachtverhalten, stufenweises Regeln, Hysterese und Reaktion auf unzureichenden Überschuss |
| Tarife und Zeitsteuerung | Standard-/dynamischer Tarif, zeitvariables Netzentgelt, manuelle Vorgaben, Zeitzone, Sommer-/Winterzeit und fehlende Preisreihen |
| Externe Netzvorgaben | Fachlich festgelegte Prioritäten, geltende Anschlussvorgaben und notwendige Anlagen-/Geräteschutzgrenzen |
| UI und Konfiguration | Sichtbarer Ist-/Sollzustand, Rechte, konsistente Aktivierung und Erhalt bestehender Einstellungen |
| Neustart/Update | Gesicherte Konfiguration, keine gefährlichen Startimpulse, kontrollierte Wiederaufnahme und Rückfall |

Die Liste ist ein Prüfumfang, keine Behauptung, dass jede genannte Funktion in jedem Adapter vorhanden oder bereits freigegeben ist. Zahlenwerte und Prioritäten müssen aus der gültigen projektspezifischen Anforderung stammen; sie dürfen nicht aus Vermutungen neu festgelegt werden.

### 10.2 Regelungsinvarianten und Fehlerverhalten

- Gesetzliche, netzseitige, hardwareseitige und projektspezifische Grenzen als konkrete Invarianten festlegen. Zielkonflikte fachlich auflösen; keine universelle Prioritätsreihenfolge erfinden.
- Sollwerte vor Ausgabe auf erlaubte Bereiche, Aktualität und Plausibilität prüfen. Clamp-Begrenzungen nicht verwenden, um Fehler still zu verbergen; Diagnose und Ursache bleiben sichtbar.
- Zeitliches Verhalten durch Hysterese, Mindestlauf-/Sperrzeiten, Rampen und definierte Zykluszeiten stabil halten, soweit für das Gerät erforderlich. Schwingungen, Schützflattern und Befehlsfluten verhindern.
- Für abgelaufene Zeitspannen und Regel-Deadlines eine geeignete monotone Zeitbasis verwenden. Kalenderfahrpläne und Tarife mit expliziter Zeitzone und Regeln für Zeitumstellungen berechnen; Uhrzeitsprünge gesondert behandeln.
- Für Messwertausfall, Kommunikationsverlust, manipulierte Werte, Stromausfall, Datenbankausfall, Uhrzeitsprünge und Überlast jeweils das zulässige Verhalten festlegen.
- Sicheren Zustand gerätespezifisch bestimmen. „Alles aus“ oder „letzten Sollwert endlos halten“ sind keine allgemeingültigen Fallbacks. Gültigkeitsdauer, Rücknahme und Wiederanlauf von Sollwerten bestimmen.
- Eine fehlende Verbindung darf nicht pauschal als Leistung 0 interpretiert werden. Rückmeldungen und gegebenenfalls die physische Wirkung eines Befehls kontrollieren.
- Nach Wiederverbindung Zustände neu abgleichen. Alte Kommandos, doppelte Antworten und verspätete Nachrichten dürfen keine neue unzulässige Aktion auslösen.
- Bei mehreren Reglern Masterzuständigkeit, Konfliktlösung und sichere Autonomie beim Verbindungsausfall festlegen. Kein Split-Brain mit widersprüchlichen Sollwerten.
- Reaktionszeiten auf realer Zielhardware messen. Messungen allein beweisen keine harte Echtzeit; dafür sind belastbare zeitliche Garantien der gesamten relevanten Ausführungskette erforderlich. Eine zertifizierte Schutzsteuerung darf nur bei tatsächlich vorliegendem, zum Produkt und Umfang passendem Zertifizierungsnachweis behauptet werden.

## 11. Verifikation und Regressionstests

### 11.1 Verbindlicher Prüfplan

Für jede sachliche Änderung den angemessenen Prüfumfang festlegen. Kritische Logik und Sicherheitsgrenzen benötigen positive und negative Tests. Bei einer Produktionsfreigabe müssen alle zugesicherten Funktionen des konkreten Lieferumfangs durch aktuelle oder nachvollziehbar weiter gültige Nachweise abgedeckt sein.

| Prüfebene | Erforderlicher Inhalt |
| --- | --- |
| Statisch | Format/Lint, JS-/TS-Typprüfung, statische Sicherheitsanalyse, Geheimnissuche und Abhängigkeitsbewertung |
| Fachliche Einheit | Normalfälle, Grenzen, ungültige Eingaben, Zeit-/Einheitenfehler und fachliche Invarianten |
| Sicherheit | Fehlende/falsche Rechte, fremde Objekt-IDs, manipulierte Nachrichten, Injection, Ressourcenlimits, unerlaubte Pfade und Netzziele |
| Integration | Reale Komponentenübergänge, Versionen, Zustandsdaten, Protokolle und Fehlerweitergabe |
| Regression | Bisherige Betriebsarten, Konfigurationen, Datenpunkte und behobene Fehler |
| Rechte | Vollständige relevante Abläufe als unprivilegierter Benutzer einschließlich Fehler- und Neustartfällen |
| Zielsystem | Geeignete Hardware-/Gerätetests, Last, Latenz und gegebenenfalls Dauerbetrieb |
| Lebenszyklus | Installation, Update, Migration, Abbruch, Backup, Wiederherstellung und Rückfall, soweit betroffen |

Fehlerinjektion gezielt vorsehen: Timeout, Paketverlust, wiederholte oder vertauschte Nachrichten, veraltete Daten, ungültiges JSON, ungewöhnliche Zahlen, unterbrochene Schreibvorgänge, voller Datenträger, fehlende Berechtigung und Ressourcenerschöpfung. Nicht jeder Fall gehört in jeden Textfix; maßgeblich sind Änderung und Risiko.

Für Regelalgorithmen geeignete Simulations-, Zustandsübergangs- und gegebenenfalls eigenschaftsbasierte Tests verwenden. Bei offenen Parsern Fuzzing nach Risiko einsetzen. Codeabdeckung dient der Lückenanalyse; eine Prozentzahl ist kein Beweis für vollständige Funktion oder Sicherheit.

### 11.2 Aussagekraft und Umgebung

- Tests mit Version/Commit, Build, Werkzeugversionen, Umgebung, Voraussetzungen, Soll/Ist und Rohbelegen verbinden.
- `bestanden`, `fehlgeschlagen`, `nicht ausgeführt`, `blockiert` und `nicht anwendbar` unterscheiden. Für die letzten drei Zustände Ursache und nächsten Schritt nennen.
- Keine Tests so ändern, dass ein Fehler verborgen bleibt. Keine produktiven Berechtigungen, TLS-Prüfungen oder Limits deaktivieren, um Tests bestehen zu lassen.
- Benötigte Referenzdaten anonymisieren oder synthetisch erzeugen. Keine unbereinigten Kundensicherungen und produktiven Geheimnisse in Tests verwenden.
- Gefährliche Stör-, Last- und Angriffstests in geeigneter isolierter Umgebung durchführen. Die Freigabe zu einer Codeänderung ist keine pauschale Freigabe zu Eingriffen in eine laufende Anlage.
- Für Dominiques vereinbarte Erprobung auf der Hausanlage eine kurze Anleitung mit Sollverhalten, Beobachtungspunkten, Sicherung und Rückfall mitliefern. Beobachtungen als Nutzerbericht kennzeichnen, wenn sie nicht selbst gemessen wurden.
- Ein bestandener Hausanlagentest gilt für die dokumentierte Konfiguration; weitere Hersteller, Geräte oder Kundenanlagen benötigen passende Nachweise.

## 12. Abhängigkeiten, CI und Lieferkette

- Abhängigkeiten nur mit begründetem Zweck aufnehmen. Pflegezustand, Lizenz, Herkunft, bekannte Schwachstellen und transitive Komponenten bewerten. Kleine Abhängigkeitsbäume bevorzugen, ohne bewährte Sicherheitsfunktionen unsicher nachzubauen.
- Lockfiles versionieren. Builds und Tests aus dem festgelegten Stand reproduzierbar aufsetzen, beispielsweise mit `npm ci` bei npm-Projekten. Keine ungeprüfte Auflösung wechselnder `latest`-Stände in Release-Builds. [Q18]
- Installations-/Lifecycle-Skripte als ausführbaren Fremdcode behandeln. Ausführung auf notwendige und geprüfte Schritte begrenzen, ohne Build-Anforderungen still zu umgehen.
- Sicherheitsmeldungen anhand des tatsächlich enthaltenen Pakets, der Version, Nutzung und Auslieferung bewerten. `npm audit` allein ist keine vollständige Sicherheitsprüfung. Keine blinden `audit fix --force`-Umstellungen.
- Abhängigkeits- und Geheimnisprüfungen in passenden CI-Läufen bei Änderungen und vor Releases ausführen; neue Advisories während des Supportzeitraums regelmäßig abgleichen. Ein nicht erreichbarer Scanner, fehlende Prüfdaten oder eine ausgelassene Stufe dürfen nicht als „keine Befunde“ erscheinen. Neue kritische Meldungen an die zuständige Person weitergeben und bewerten.
- Repositories und Paketkonten mit MFA und minimalen Rechten schützen. Signier-, Publish- und Laufzeitrechte trennen. Ungeprüfte Beiträge erhalten weder Produktionsgeheimnisse noch produktionsnahe privilegierte Runner.
- CI-Actions aus Drittquellen an überprüfte vollständige Commit-SHAs binden und kontrolliert aktualisieren. Tokens minimal berechtigen; untrusted Eingaben nicht als Shellcode einsetzen. [Q19]
- Vor Veröffentlichung die tatsächlich gepackten npm-/ZIP-/Image-Inhalte prüfen: keine Geheimnisse, privaten Konfigurationen, Testkundendaten, unnötigen Dateien oder abweichenden Builds.
- Für jedes Release eine maschinenlesbare SBOM aus dem tatsächlichen Liefer-/Buildumfang erzeugen, beispielsweise in SPDX oder CycloneDX. Direkte, transitive und gebündelte Komponenten soweit enthalten erfassen; unvollständigen Umfang kennzeichnen. [Q22, Q23]
- SBOM, Hashes, Herkunft, Quellstand und Buildnachweise eindeutig verbinden. Ein Hash allein beweist keine vertrauenswürdige Herkunft. Bei Signaturen Schlüsselverteilung und Vertrauensanker festlegen.
- Publish darf nicht unbemerkt anderen Code erzeugen als den geprüften Stand. Wenn der Prozess neu baut, ist genau das resultierende Artefakt erneut zu prüfen; alte Ergebnisse dürfen nicht automatisch umetikettiert werden.

**Testpakete:** Technisch geprüfte und eindeutig gekennzeichnete Teststände dürfen nicht allein wegen noch offener allgemeiner Hardware-/Produktivfreigabe durch eine pauschale Publish-Sperre blockiert werden. Versions-/Kanalwahl, noch offene Prüfungen und zulässiger Testumfang müssen klar sein. Geheimnis-, Integritäts- und technische Sicherheitsprüfungen bleiben Pflicht. Ein Testtag rechtfertigt weder eine bekannte ausnutzbare Schwachstelle im vorgesehenen Feldtest noch die Bezeichnung „produktionsfreigegeben“.

## 13. Updates, Sicherungen und Wiederherstellung

- Updates aus definierter Quelle beziehen, Integrität und Authentizität vor Aktivierung prüfen. Versions-/Gerätekompatibilität und zulässige Versionsreihenfolge kontrollieren.
- Manipulierte, unvollständige oder für das Ziel ungeeignete Pakete ablehnen. Signaturfehler dürfen nicht durch einen unsignierten Fallback umgangen werden.
- Unbeabsichtigte Downgrades und Replay verhindern. Ein absichtlicher, geprüfter Rückfall muss mit Datenmigration und Sicherheitsstatus vereinbar sein; nicht blind auf eine verwundbare Version zurückfallen.
- Download, Prüfung, Vorbereitung und Aktivierung trennen. Der laufende Zustand muss bei Abbruch konsistent bleiben. Stromausfall, voller Speicher und fehlende Rechte dürfen keine halbe Installation als erfolgreich melden.
- Nichtprivilegierte Anwendungsupdates in dafür vorgesehene Pfade ermöglichen. Änderungen am Betriebssystem oder geschützten Diensten unterliegen Abschnitt 8.2; ein Updateknopf darf kein allgemeiner Root-Befehlsweg sein.
- Vor betroffenen Migrationen eine geeignete Sicherung und getestete Wiederherstellung bereitstellen. Backups mit Geheimnissen verschlüsseln und die Schlüssel getrennt schützen; eine Wiederherstellung ohne verfügbaren Schlüssel ist kein belastbarer Plan.
- Automatische Updates entsprechend der Produktanforderung vorsehen, aber Steuerungsunterbrechung, Wartungszeit, Status, Fehlermeldung und Rückfall kontrollieren. Keine ungeprüften Hauptversionswechsel auf laufenden Anlagen.
- Diagnose- und Wartungsfunktionen zeitlich und fachlich begrenzen. Fernwartung nachvollziehbar autorisieren; keine dauerhaften versteckten Zugänge.

## 14. Schwachstellen, Support und CRA

Ein gepflegtes Befundregister MUSS bekannte Produktbefunde, zutreffende Hersteller-Advisories, ungeklärte Verdachtsfälle und Fehlkonfigurationen auseinanderhalten. Jeder Befund erhält eine stabile Kennung, betroffene Versionen, Angriffsbedingungen, Auswirkung, Priorität, Maßnahme, Verantwortlichkeit, Termin und Nachprüfung.

Aktive Ausnutzung, erreichbare kritische Angriffswege, Geheimnisoffenlegung und mögliche gefährliche Anlagenwirkungen sind sofort zu priorisieren. Betroffene Auslieferungen und notwendige Gegenmaßnahmen gezielt behandeln. Ein CVSS-Wert allein entscheidet nicht über das tatsächliche Risiko.

Für Produkte einen Sicherheitskontakt, ein Verfahren für vertrauliche Meldungen, Supportumfang, Supportende, Patchverteilung und einen Vorfallprozess festlegen. Neue Erkenntnisse müssen in Code, Tests, Dokumentation und Lieferstände zurückfließen. Nur durchgeführte Nachprüfungen rechtfertigen das Schließen eines Befunds.

**CRA-Zeitbezug:** Für erfasste Produkte gelten die Meldepflichten nach Artikel 14 seit **11.09.2026**; die wesentlichen weiteren Produktpflichten gelten ab **11.12.2027**. Die konkrete Anwendbarkeit, Verantwortlichkeit, Meldewege und Fristen müssen anhand des aktuellen Rechts und der Produktrolle bestimmt werden. Eine Planung ausschließlich für 2027 ist daher unzureichend. [Q09, Q10]

Zur Produktdokumentation gehören nach anwendbarem Umfang Produktabgrenzung, Herstellerrolle, Risikobewertung, technische Unterlagen, Komponentenübersicht/SBOM, Sicherheitsanforderungen, Nachweise, Support und Schwachstellenbehandlung. Relevante Änderungen müssen diese Unterlagen aktualisieren.

IEC-Ausrichtung, ein grüner Scan oder eine SBOM sind keine automatische CRA-Konformität. Erforderliche Konformitätsbewertung und tatsächlich einschlägige harmonisierte Normverweise gesondert bestimmen. Eine eigene oder KI-gestützte Prüfung ist keine unabhängige Zertifizierung.

## 15. Dokumentation und Freigaben

Vorhandene Ablagestrukturen und Befundkennungen fortführen. Keine konkurrierenden Berichtssammlungen erzeugen. Architektur, Datenflüsse, Rechte, Installation, Betrieb, Updates, Wiederherstellung, Schnittstellen und Bedienung nur dort aktualisieren, wo die Änderung sie betrifft.

Für einen Lieferstand gehören mindestens zusammen:

1. Lieferumfang, Version, Quell-/Buildbezug, Hashes und Konfigurationsumfang;
2. Änderungen mit Sicherheits- und Funktionswirkung;
3. Testergebnisse mit tatsächlicher Umgebung, Geräten, Einschränkungen und Belegen;
4. Komponentenübersicht, SBOM und bewertete offene Befunde;
5. Installation, Migration, Sicherung, Rückfall und noch nötige Praxistests;
6. ehrlicher Freigabestatus, Supportbezug und tatsächlich verantwortliche Entscheidung.

**Eine Produktionsfreigabe ist gesperrt**, wenn eine bekannte ausnutzbare Schwachstelle im vorgesehenen Betrieb besteht, eine kritische Funktion regressiert, erforderliche Rechteprüfungen fehlen, Geheimnisse im Lieferumfang stehen, der Build nicht dem geprüften Stand zugeordnet werden kann oder notwendige kritische Tests fehlgeschlagen beziehungsweise offen sind.

Ungeklärte hohe oder kritische Scannerbefunde müssen vor Freigabe bewertet werden. Belegte Nichtbetroffenheit oder ein nachgewiesener Fehlalarm sind zulässige fachliche Ergebnisse; bloßes Ausblenden oder Umbenennen nicht. Nichtkritische Restpunkte dürfen nur mit dokumentierter Bewertung und zuständiger Entscheidung verbleiben. Geltende gesetzliche Pflichten sind nicht durch Risikoakzeptanz aufhebbar.

Bei wesentlichen Architekturänderungen und Serienfreigaben eine unabhängige Sicherheitsprüfung beziehungsweise einen risikogerechten Penetrationstest einplanen. Bei Ein-Personen-Entwicklung keine nicht vorhandene Zweitprüfung bescheinigen.

### 15.1 Anforderungen und Nachweise gegenüber Geschäftspartnern

- Anforderungen aus Kundengesprächen, Lastenheften, Sicherheitsfragebögen und Verträgen in einem produktbezogenen Anforderungsregister erfassen. Normname allein genügt nicht: Fassung, Geltungsbereich, konkrete Anforderung, Zielniveau, Verantwortlichkeit und Abnahmekriterium festlegen.
- Jede relevante Anforderung mit Umsetzung, Prüfbeleg und geliefertem Versionsstand verknüpfen. Status unterscheiden: gefordert, geplant, umgesetzt, geprüft, offen, nicht anwendbar mit Begründung. Eine geplante Verbesserung darf nicht als bereits erfüllte Eigenschaft angeboten werden.
- Vor Kunden- oder Serienfreigabe die vereinbarten Anforderungen und die Pflichtkriterien dieser Richtlinie abnehmen. Offene kritische Sicherheitsanforderungen, bekannte ausnutzbare Schwachstellen und fehlgeschlagene kritische Funktionstests verhindern diese Freigabe. Nichtkritische vertragliche Abweichungen nur mit nachvollziehbarer zuständiger Entscheidung behandeln; gesetzliche Pflichten bleiben verbindlich.
- Für die technische Prüfung durch Geschäftspartner ein zum Lieferstand passendes Nachweispaket führen: Produkt-/Versionsumfang, Sicherheitsarchitektur, relevante Anforderungen und Ergebnisse, bekannte Einschränkungen, SBOM, Update-/Supportverfahren und Sicherheitskontakt. Vertrauliche Details und Angriffsinformationen nur im geeigneten, autorisierten Umfang offenlegen.
- Aussagen wie „IEC 62443-konform“, „ASVS Level 2 erfüllt“, „zertifiziert“ oder „vollständig ohne Root“ nur mit dem dafür tatsächlich erforderlichen und passenden Nachweis verwenden. Prozessausrichtung, internes Ziel, bestandene Einzelprüfung und unabhängige Zertifizierung ausdrücklich unterscheiden.
- Diese Vorgabe erlaubt kein eigenständiges Versenden von Unterlagen, keine Vertragszusage und keine Veröffentlichung. Bereits erteilte konkrete Autorisierungen beachten.

## 16. Einführung in vorhandene Projekte

Diese Richtlinie macht vorhandenen Code nicht rückwirkend sicher oder vollständig geprüft. Die Umsetzung erfolgt nachvollziehbar:

1. **Inventarisieren:** Alle eigenen, unterstützten, ausgelieferten und tatsächlich eingesetzten Komponenten mit Version, Herkunft, Rechten und Status aufnehmen. Diese Kategorien unterscheiden.
2. **Lücken feststellen:** Vorhandene Tests, Abhängigkeiten, Laufzeitrechte, kritische Funktionen und Sicherheitsgrenzen bewerten. Unbekanntes ausdrücklich als offen markieren.
3. **Priorisieren:** Ausnutzbare Sicherheitslücken und Risiken mit möglicher Anlagenwirkung zuerst behandeln. Danach fehlende Prüfungen, Rechteabbau und übrige technische Schulden planen.
4. **Bei jeder Änderung verbessern:** Den betroffenen Bereich und seine unmittelbaren Sicherheitsgrenzen nach dieser Richtlinie bearbeiten, Regressionen prüfen und die Befundliste fortschreiben.
5. **Pro Release nachweisen:** Nur den konkret geprüften Stand und Umfang freigeben. Eine Richtliniendatei, ein erfolgreicher Build oder ein laufendes Einzelgerät ersetzt keine vollständige Produktbewertung.

**Einbindung:** Diese Datei als `AGENTS.md` im Wurzelverzeichnis jedes betroffenen Repositorys ablegen oder ihren Inhalt mit einer vorhandenen `AGENTS.md` zusammenführen. Bestehende projektspezifische Anweisungen nicht blind überschreiben. In Werkzeugen ohne automatische Unterstützung die Datei ausdrücklich als Projektanweisung einbinden. Vorgaben zusätzlich durch passende CI-Prüfungen und Reviews absichern; ein Markdown-Dokument erzwingt sie technisch nicht.

Eine gemeinsame Richtlinienquelle SOLL versioniert werden. Repositorykopien müssen einen erkennbaren Stand besitzen. Änderungen an der gemeinsamen Vorgabe kontrolliert in die Projekte übernehmen; ein Update an einer Stelle darf nicht als bereits erfolgte Änderung aller Repositories ausgegeben werden.

**Reihenfolge für die technische Einführung je Repository:** Zuerst Iststand und bestehendes Verhalten erfassen; dann JS-/TS-Typprüfung und Linting wirksam einrichten; Vertrauensgrenzen mit Laufzeitvalidierung absichern; passende Sicherheits-/Abhängigkeitsscans ergänzen; den vollständigen relevanten Ablauf ohne Root prüfen; Regression, Hardwareintegration und Wiederherstellung nach Risiko nachweisen. Neu installierte Werkzeuge, tatsächlich aktive CI-Regeln und noch offene Maßnahmen getrennt dokumentieren.

## 17. Vorlage für den Änderungs- und Prüfvermerk

Die Vorlage nach Umfang kürzen oder erweitern. Unbekannte Felder ausdrücklich offen lassen; keine Werte erfinden.

| Feld | Eintrag |
| --- | --- |
| Änderung / Befund | Kennung und kurzer Titel |
| Produkt / Komponenten | Betroffene Adapter, Dienste und Versionen |
| Quell- und Lieferstand | Commit/Hashes, Build, Artefakt, Richtlinienversion |
| Anlass / Sollverhalten | Problem, gewünschtes Ergebnis und bestehende Zusagen |
| Änderung | Tatsächliche Umsetzung und Auswirkungen |
| Sicherheitsbetrachtung | Daten, Rechte, Vertrauensgrenzen, Angriffswege und Gegenmaßnahmen |
| Funktionsverträglichkeit | Betriebsarten, Schnittstellen, Datenpunkte, Migration und Rückfall |
| Betrieb ohne Root | Benutzer, Gruppen, Capabilities, erreichbare privilegierte Wege und Ergebnis |
| Prüfung | Kennung, Umgebung, Werkzeugversion, Befehl/Ablauf, Zeitpunkt, Soll und Ist |
| Ergebnis | Bestanden / fehlgeschlagen / nicht ausgeführt / blockiert / nicht anwendbar |
| Belege | Bereinigte Logs, Reports, Rohdaten, SBOM und Artefaktbezug |
| Offene Punkte | Auswirkung, Verantwortlichkeit, Termin und nächster Schritt |
| Freigabe | Teststand / eingeschränkter Prüfstand / Produktionsfreigabe; tatsächliche Entscheidung |

**Abschluss einer sachlichen Änderung:** Der geforderte Umfang ist umgesetzt, relevante Funktionen sind geprüft, Sicherheitsfolgen sind bewertet, Rechte bleiben begrenzt, betroffene Dokumentation ist aktuell und verbleibende Unsicherheiten sind sichtbar. Fehlt ein notwendiger Nachweis, ist die Arbeit nicht als vollständig produktionsfreigegeben zu bezeichnen.

## 18. Offizielle Quellen

Quellenstand: 25.10.2026. Vor verbindlichen Aussagen und Releases erneut prüfen. Die Links belegen technische Grundlagen, Fassungen und Anwendungsbereiche; die konkrete interne Umsetzungsvorgabe legt dieses Dokument fest.

- **[Q01] OWASP ASVS:** [Aktuelle stabile Fassung und Anforderungsreferenzen](https://asvs.owasp.org/).
- **[Q02] OWASP Top 10:** [Offizielle Projektseite](https://owasp.org/projects/top-ten).
- **[Q03] NIST SSDF 1.1:** [SP 800-218, Final](https://csrc.nist.gov/pubs/sp/800/218/final).
- **[Q04] NIST SSDF 1.2:** [SP 800-218 Rev. 1, Initial Public Draft](https://csrc.nist.gov/pubs/sp/800/218/r1/ipd).
- **[Q05] IEC 62443-4-1:** [Offizieller IEC-Katalog](https://webstore.iec.ch/en/publication/33615).
- **[Q06] IEC 62443-4-2:** [Offizieller IEC-Katalog](https://webstore.iec.ch/en/publication/34421).
- **[Q07] IEC 62443-3-2:** [Offizieller IEC-Katalog](https://webstore.iec.ch/en/publication/30727).
- **[Q08] IEC 62443-3-3:** [Offizieller IEC-Katalog](https://webstore.iec.ch/en/publication/7033).
- **[Q09] CRA:** [EU-Kommission, Pflichten für Hersteller](https://digital-strategy.ec.europa.eu/en/policies/cra-manufacturers) und [amtlicher Verordnungstext](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng).
- **[Q10] CRA-Fristen:** [EU-Kommission, Zusammenfassung](https://digital-strategy.ec.europa.eu/en/policies/cra-summary) und [Beginn der Meldepflichten am 11.09.2026](https://commission.europa.eu/news-and-media/news/safer-and-more-secure-digital-products-2026-09-11_en).
- **[Q11] Node.js:** [Veröffentlichungen und Supportstatus](https://nodejs.org/en/about/previous-releases).
- **[Q12] Node.js:** [Berechtigungsmodell und Sicherheitsgrenzen](https://nodejs.org/api/permissions.html).
- **[Q13] TypeScript:** [Offizielle TSConfig-Referenz](https://www.typescriptlang.org/tsconfig/).
- **[Q14] Node.js:** [Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices).
- **[Q15] systemd:** [Ausführungsrechte und Härtung von Diensten](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html).
- **[Q16] Docker:** [Rootless mode](https://docs.docker.com/engine/security/rootless/).
- **[Q17] ioBroker:** [Offizielle Entwicklungsdokumentation im Projekt-Repository](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md).
- **[Q18] npm:** [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
- **[Q19] GitHub Actions:** [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use).
- **[Q20] OWASP Cheat Sheet Series:** [Transport Layer Security](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html).
- **[Q21] OWASP Cheat Sheet Series:** [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- **[Q22] SPDX:** [Offizielle Spezifikationen](https://spdx.dev/use/specifications/).
- **[Q23] CycloneDX:** [Offizielle Spezifikation](https://cyclonedx.org/specification/overview/).
- **[Q24] Funktionale Sicherheit:** [IEC 61508-1, offizieller Katalog](https://webstore.iec.ch/en/publication/5515), [IEC 62061, konsolidierte Ausgabe mit Änderungen 2024/2026](https://webstore.iec.ch/en/publication/112847) und [ISO 13849-1:2023](https://www.iso.org/standard/73481.html).
- **[Q25] MISRA:** [Offizielle Publikationen](https://misra.org.uk/publications/) und [MISRA C:2025, Addendum 6 zur Übertragbarkeit auf Rust](https://misra.org.uk/app/uploads/2025/03/MISRA-C-2025-ADD6.pdf).
- **[Q26] typescript-eslint:** [Linting mit Typinformationen](https://typescript-eslint.io/getting-started/typed-linting/) und [Konfigurationsprofile](https://typescript-eslint.io/users/configs/).
- **[Q27] ESLint Security Plugin:** [Offizielles Projekt mit Grenzen und Regeln](https://github.com/eslint-community/eslint-plugin-security).
- **[Q28] Laufzeitvalidierung:** [Zod, Anwendung und Fehlerbehandlung](https://zod.dev/basics) und [TypeBox](https://github.com/sinclairzx81/typebox).
- **[Q29] Statische Analyse:** [PVS-Studio 8.00, JS-/TS-Analyzer](https://pvs-studio.com/en/blog/posts/1406/) und [SonarQube, JavaScript/TypeScript](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/languages/javascript-typescript-css).
- **[Q30] Abhängigkeitsanalyse:** [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/) und [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/).
- **[Q31] Deno:** [Berechtigungen und Sicherheitsgrenzen](https://docs.deno.com/runtime/fundamentals/security/) und [Node-/npm-Kompatibilität](https://docs.deno.com/runtime/fundamentals/node/).
