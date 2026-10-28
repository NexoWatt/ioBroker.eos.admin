# Cache-Upgrade des News-Sicherheitsfixes

Stand: 25.10.2026; Frontend-Runtime v85 auf bestehender Admin-7-Codebasis.

Der News-Sicherheitsfix entfernt die JavaScript-Auswertung einer extern gelieferten Objektanzahl-Bedingung. Für bereits verwendete Installationen ist auch ein neuer Modulpfad nötig: Ein Browser kann bei eingeschaltetem Admin-Cache das bisherige v84-Bundle weiterhin aus seinem frischen Cache laden.

Deshalb wurden 21 Runtime-Dateien von -v84.js auf -v85.js umbenannt. HTML-Einstieg, Rollen-Einstiegsziel, Module-Federation-Manifest, dynamische Imports, statische Imports, Vite-Preload-Listen und die vorhandenen Kompatibilitätseinstiege verweisen jetzt auf v85. Allgemeine Herstellerbibliotheken ohne Änderungen behalten ihre Pfade. Die Graphprüfung bestätigt, dass der aktive Einstieg keine v84-Datei mehr referenziert. Die Laufzeitbereinigung orientiert sich an runtimeEntry und entfernt beim üblichen Updateablauf übrig gebliebene alte Runtime-Dateien.

Nach Installation und Neustart des Adapters die Admin-Oberfläche vollständig neu laden oder den Tab schließen und neu öffnen. Bereits geladener JavaScript-Code wird durch das Serverupdate nicht aus einem geöffneten Tab entfernt. Der neue Einstieg verwendet neue Modul-URLs auch dann, wenn der Browser noch v84-Dateien zwischengespeichert hat.

Dies ist eine begrenzte Änderung des vorhandenen vorgebauten Frontends. Es wurde kein vollständiger Frontend-Neubuild durchgeführt. Paketversion und Runtime-Cacheversion sind verschiedene Werte; runtimeEntry ist v85 und wird von den aktiven Prüfwerkzeugen ausgewertet.

Nachweise: evidence/cache-bust-v85-provenance.json und evidence/cache-bust-v85-checks.json. Graph-, Import-, Syntax-, Einstiegsketten- und Bereinigungsprüfungen bestanden; die News-Parserprüfungen wurden auf dem ausgelieferten v85-Bundle ausgeführt. Ein vollständiger Browser- und Produktintegrationstest bleibt Bestandteil des Freigabelaufs.

