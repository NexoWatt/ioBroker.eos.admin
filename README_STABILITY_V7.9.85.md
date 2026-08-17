# NexoWatt EOS Admin v7.9.85

## Ziel
Klare Trennung zwischen der lokalen NexoWatt-EOS-Hilfe und dem upstream ioBroker Assistant.

## Änderungen

- EOS Assist bleibt vollständig verfügbar und arbeitet lokal mit kontextbezogenen Hinweisen.
- Der upstream ioBroker `ChatPanel` wird weder importiert noch gerendert.
- Dadurch wird keine externe AI-/MCP-Assistentenoberfläche gestartet.
- Das neue breite NexoWatt-EOS-Logo wird links oben in der nativen Produkthülle verwendet.
- Der validierte v84-Frontend-Runtime-Graph bleibt unverändert.

## Regression Guard

`tools/nexowatt-assistant-separation-selftest.cjs` prüft:

- kein `ChatPanel`-Import in `App.tsx`;
- kein `ChatPanel`-Renderpfad in `App.tsx`;
- kein aktiver `ChatPanel`-Mount im ausgelieferten Bootstrap;
- lokaler EOS Assist wird weiterhin geladen;
- lokaler EOS Assist enthält keine externe Netzwerk-/AI-Anbindung;
- neues Logo und responsive Styles sind vorhanden.
