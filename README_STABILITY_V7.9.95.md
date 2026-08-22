# NexoWatt EOS Admin 7.9.95 – Stabilität

Version 7.9.95 ist ein packaging-only Stable-Update. Die produktive Laufzeit, Rollenlogik, Erstanmeldung mit dem Startpasswort `nexowatt`, Standardport 8081 und die Deaktivierung des EOS Assist bleiben gegenüber 7.9.94 unverändert.

Neu ist die mergesichere Release-Vorbereitung: Alle versionsführenden Dateien werden vor Prüfung, Packen und npm-Veröffentlichung automatisch an `package.json` angeglichen.

Die npm-Dateiliste wird nun zusätzlich gegen das reale Dateisystem geprüft. Nicht vorhandene oder nicht gepackte Pflichtdateien brechen die Veröffentlichung vor dem Upload ab.


Zusätzlich werden die Rootmetadaten der Lockdateien gegen die zugehörigen `package.json`-Dateien geprüft. Dadurch können veraltete `prepublishOnly`-, `prepack`- oder Stabilitätsskripte nicht mehr unbemerkt in einer gemischten Arbeitskopie verbleiben.

Die Merge-Datei für bestehende Arbeitsordner wird ohne übergeordneten Versionsordner erzeugt. `package.json`, `io-package.json` und `MERGE_UPDATE.cmd` liegen unmittelbar auf der ersten ZIP-Ebene.
