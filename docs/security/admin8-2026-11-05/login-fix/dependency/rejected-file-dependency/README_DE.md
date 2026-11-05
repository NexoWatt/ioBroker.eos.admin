# Verworfener Zwischenversuch: verschachteltes lokales Paketarchiv

Diese Dateien dokumentieren einen **verworfenen** Zwischenversuch. Sie sind kein Nachweis der Installierbarkeit des ausgelieferten EOS-Adapters.

Die winzigen Consumer-Fixtures fanden das lokale WebServer-Archiv über einen noch vorhandenen Producer-Ordner neben dem Consumer. Die vollständige EOS-Paketinstallation scheiterte dagegen bereits während npm-Arborists Erstellung des Dependency-Baums mit ENOENT auf dem noch nicht entpackten inneren Archiv. Die äußere EOS-Paketdatei enthielt das Archiv tatsächlich; ein erneuter Versuch oder ein Lifecycle-Hook beseitigt die Reihenfolgeabhängigkeit nicht.

Die endgültige Variante liefert die 39 Originaldateien direkt als geprüften Quell- und Laufzeitbestand. Ihre drei Runtime-Abhängigkeiten stehen direkt in EOS package.json; es gibt keine file:-Dependency. Siehe ../REPORT_DE.md und die vollständigen Consumer-Nachweise im übergeordneten Prüfbericht.

Die früheren Audit-, HTTP- und Testresultate beziehen sich ausschließlich auf den Zwischenversuch.
