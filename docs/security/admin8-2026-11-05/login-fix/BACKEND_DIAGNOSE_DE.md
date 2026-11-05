# Backend-Diagnose: gültige Anmeldung durch Gruppen-View abgewiesen

Stand: 05.11.2026. Betroffen: ausgelieferter EOS-Admin-8.0.0-Sitzungsschutz. Korrektur im Arbeitsstand für EOS Admin 8.0.1. Dieser Nachweis ist keine Freigabe der realen Anlage.

## Fehler und Ursache

Der Nutzer meldete, dass sein über die CLI neu gesetztes Passwort im normalen Admin funktioniert, im EOS Admin aber weiter als falsch abgewiesen wird. Der Anmeldedialog verwendet diese Meldung auch bei anderen erfolglosen OAuth-Tokenantworten.

Der Fehler ließ sich unabhängig vom echten Benutzerpasswort reproduzieren. `EosSessionSecurity.snapshot()` erwartete in `getObjectViewAsync('system', 'group', ...)` eine kanonische Objekt-ID in `row.id`. Die offizielle Controller-7.2.5-Gruppen-View lautet dagegen:

```js
function(doc) { if (doc.type === 'group') emit(doc.common.name, doc) }
```

`row.id` ist deshalb ein Anzeigename beziehungsweise im FileDB-Pfad auch ein übersetztes Namensobjekt. Die kanonische ID liegt in `row.value._id`. Beispielsweise liefert der Redis-Client den View-Key `Administrator` und gleichzeitig die tatsächliche ID `system.group.administrator` im Vollobjekt. Der alte EOS-Schutz verwirft diese reguläre Antwort, bevor die Passwortprüfung aufgerufen wird.

Die beiden Datenbankimplementierungen und die Adapter-API wurden aus dem offiziellen Tag `v7.2.5`, Commit `e4c842b9056eb5b0b18bb56e70611821ecb3cc80`, geprüft. Die Originaldatei-Hashes, Quell-URLs und genauen Extraktionszeilen stehen in `provenance.json`. Die Quellen sind MIT-lizenziert; `upstream-LICENSE.txt` liegt bei.

## Korrektur und Sicherheitswirkung

Der Sitzungsschutz verwendet ausschließlich die kanonische ID `row.value._id`. Gruppentyp, ID-Typ, Namespace, nichtleerer Suffix, Größenlimit und Eindeutigkeit werden geprüft. Fehlende, fremde, leere oder doppelte Identitäten führen weiter zur Ablehnung. Ein Anzeigename kann niemals als Ersatz-ID eine Sitzung freischalten.

Die kanonischen IDs werden deterministisch sortiert. Umbenennungen, Übersetzungen, irrelevante Metadaten und geänderte Reihenfolge beeinflussen den Sicherheitsabdruck nicht. Passwortänderungen, Kontosperren, Mitgliedschafts- und Rechteänderungen sowie der Austausch einer kanonischen Gruppenidentität invalidieren Sitzungen weiterhin.

Die Anmeldung verlangt unverändert die bestehende Controller-Passwortprüfung. Es wird kein Benutzer angelegt, kein Passwort geändert, keine Authentifizierung abgeschaltet und kein Sonderzugang für `admin` eingeführt.

## Reproduktion und ausgeführte Prüfung

`reproduce.cjs` führt die unverändert extrahierten Methoden `_applyView` des FileDB-Servers und `_applyViewFunc` des Redis-Clients aus. Die offizielle Gruppen-View und relevante unveränderte Felder der beiden Controller-Standardgruppen stammen aus `test/fixtures/controller-7.2.5-group-view.json`. Transport, Datenspeicher und Credential-Callback sind kontrollierte In-Memory-Grenzen. Das OAuth-Modell stammt aus dem tatsächlich installierten `@iobroker/webserver` 3.4.0.

Ausführung unter Node.js 24.22.1:

```bash
node docs/security/admin8-2026-11-05/login-fix/reproduce.cjs
node --test test/eos-session-security.test.cjs
```

Ergebnis für beide echten View-Implementierungen: EOS 8.0.0 lehnt ab, ohne den bestätigenden Credential-Callback aufzurufen; der korrigierte Sitzungsschutz authentifiziert denselben synthetischen Benutzer nach genau einer Credential-Prüfung. Die vollständigen Ergebnisse stehen in `reproduction.json`.

Die gezielte Sessiontestsuite bestand mit 19 Tests, 0 Fehlern und 0 übersprungenen Tests. Sie umfasst tatsächliche View-Keys für einfache und übersetzte Namen, Token-/Refresh-Ausstellung, ungültige und doppelte kanonische IDs, Reihenfolge/Metadaten sowie bestehende Passwort-, Gruppen-, ACL- und Socket-Widerrufsfälle. Die Tests gegen den ausgelieferten Backend-Build in `test/eos-admin8-web.test.cjs` wurden ebenfalls auf die echte View-Form umgestellt und werden durch die nachfolgende Release-Prüfung ausgeführt; deren Ergebnis gehört in den übergeordneten Release-Bericht.

## Abgrenzung und offene Praxiskontrolle

Es wurde keine Verbindung zur Kundenanlage hergestellt, kein echtes Passwort ausgelesen und kein kompletter laufender ioBroker-Controller gestartet. Auf der Anlage ist nach Installation der korrigierten Version die Anmeldung mit dem vorhandenen Passwort zu bestätigen; anschließend sind Rollenrechte und die Abmeldung beziehungsweise der Sitzungswiderruf nach einer Passwortänderung praktisch zu prüfen.

Die Adapter-API `_getForeignObject` maskiert im untersuchten Controller lediglich markierte `native`-Felder fremder Adapterobjekte; sie entfernt hier nicht `common.password` eines Benutzerobjekts. Diese Vermutung erklärt den reproduzierten Fehler nicht.

Zusätzliche Quellbeobachtung, nicht Ursache dieses Loginfehlers: Der Redis-View-Pfad kann nach dem emittierten Anzeigenamen deduplizieren. Gleichbenannte unterschiedliche Gruppen können dadurch in der View fehlen. Eine weitergehende Prüfung der Vollständigkeit des Sicherheitsabdrucks beziehungsweise ein Wechsel auf eine ausschließlich nach Objekt-ID gelieferte Liste ist separat zu bewerten; daraus wird in diesem Bericht weder ein nachgewiesener Angriff noch eine vollständige Sicherheitsfreigabe abgeleitet.
