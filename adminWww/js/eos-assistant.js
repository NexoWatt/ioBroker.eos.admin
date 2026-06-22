(() => {
    'use strict';

    window.NEXOWATT_EOS_ASSIST_VERSION = 'v27-local-setup-guide';

    const ASSET_BASE = (() => {
        const script = document.currentScript?.src || document.querySelector('script[src*="eos-assistant.js"]')?.src || window.location.href;
        return new URL('../', script).href;
    })();
    const asset = path => new URL(path.replace(/^\.\//, ''), ASSET_BASE).href;
    const LOGO = asset('img/eos/nexowatt-192.png');
    const STORE_KEY = 'nexowatt.eos.assist.open';
    const state = { checked: false, allowed: true };

    const fetchAssistantPolicy = async () => {
        if (state.checked) return state.allowed;
        state.checked = true;
        try {
            const url = new URL('eos/security/status', ASSET_BASE).href;
            const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) return state.allowed;
            const json = await response.json();
            const assistant = json.assistant || {};
            const enabled = assistant.enabled !== false && json.eosAssistantEnabled !== false;
            const adminOnly = assistant.adminOnly === true || json.eosAssistantAdminOnly === true;
            const isAdmin = json.isAdmin === true || json.isAdministrator === true || json.isEosAdminGroup === true;
            state.allowed = enabled && (!adminOnly || isAdmin);
        } catch {
            state.allowed = true;
        }
        return state.allowed;
    };

    const normalize = value => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const route = () => {
        const hash = window.location.hash || '';
        const text = normalize(document.body?.innerText || '');
        if (hash.includes('tab-adapters') || /module|adapter/.test(text.slice(0, 4000))) return 'modules';
        if (hash.includes('tab-instances') || /dienste|instanzen/.test(text.slice(0, 4000))) return 'services';
        if (hash.includes('tab-logs') || /systemlogs|protokolle|log-grosse/.test(text.slice(0, 4000))) return 'logs';
        if (hash.includes('tab-users') || /zugange & rechte|benutzer|rollen/.test(text.slice(0, 4000))) return 'rights';
        if (hash.includes('tab-objects') || /datenpunkte|objekte/.test(text.slice(0, 4000))) return 'objects';
        if (hash.includes('tab-hosts') || /system-hosts|hosts/.test(text.slice(0, 4000))) return 'hosts';
        return 'overview';
    };

    const contextTitle = () => ({
        modules: 'Module & Adapter',
        services: 'Dienste & Instanzen',
        logs: 'Systemlogs',
        rights: 'Zugänge & Rechte',
        objects: 'Datenpunkte',
        hosts: 'System-Hosts',
        overview: 'EOS Cockpit',
    }[route()] || 'EOS Cockpit');

    const routeAdvice = () => ({
        modules: 'Hier installierst und aktualisierst du Module. Prüfe vor einer Installation immer: Zweck, benötigte Instanzen, Version, Abhängigkeiten und ob das Modul zu den geschützten EOS-Komponenten gehört.',
        services: 'Hier siehst du laufende Dienste. Wichtig sind Status, Speicherverbrauch, Log-Level und ob eine Instanz automatisch startet. Fehlerhafte Dienste zuerst öffnen, Log prüfen, dann gezielt neu starten.',
        logs: 'Hier erkennst du die Ursache vieler Probleme. Filtere nach Quelle und Level. Wiederholte Warnungen sind meist wichtiger als einzelne Meldungen.',
        rights: 'Hier steuerst du Rollen und Benutzer. Installateur- und Endkundenrollen sollten keine geschützten EOS-Systemmodule löschen, stoppen oder aktivieren können.',
        objects: 'Datenpunkte sind die technische Basis. Ändere Rollen, States und Alias-Strukturen nur bewusst, weil Adapter und Visualisierungen davon abhängen.',
        hosts: 'Hier prüfst du Systemlast, Node.js, npm, Speicher und laufende Prozesse. Bei Updateproblemen zuerst Host-Status und freien Speicher prüfen.',
        overview: 'Das Cockpit gibt den Überblick. Starte von hier aus mit Modulen, Diensten, Logs oder Rechten, je nachdem ob du einrichten, prüfen oder absichern möchtest.',
    }[route()] || 'Wähle einen Bereich aus, dann kann EOS Assist dir die nächsten Schritte erklären.');

    const answerFor = question => {
        const q = normalize(question);
        const r = route();
        if (!q) return `Aktueller Bereich: ${contextTitle()}\n\n${routeAdvice()}\n\nDu kannst z. B. fragen: „Wie richte ich Modbus ein?“, „Warum ist ein Dienst rot?“ oder „Welche Rechte braucht der Installateur?“`;

        if (/modbus|wechselrichter|tcp|rs485/.test(q)) {
            return 'Modbus-Einrichtung:\n1. Modul installieren und Instanz anlegen.\n2. IP/Port oder seriellen Adapter prüfen.\n3. Unit-ID, Registerbereich und Byte-Reihenfolge dokumentieren.\n4. Dienst starten und Systemlogs auf Timeout/CRC prüfen.\n5. Erst wenn Werte stabil laufen, Datenpunkte in EOS Cockpit verwenden.';
        }
        if (/shelly|relay|schalter|steckdose/.test(q)) {
            return 'Shelly-/Schaltmodul-Einrichtung:\n1. Gerät im gleichen Netzwerk erreichbar machen.\n2. Authentifizierung im Gerät setzen, damit keine Warnung wie „not protected via restricted login“ entsteht.\n3. Adapterinstanz konfigurieren und neu starten.\n4. In Datenpunkten prüfen, ob Power, Energy und Relay-State sauber aktualisieren.';
        }
        if (/ev|wallbox|laden|ladepunkt|ocpp/.test(q)) {
            return 'Ladepunkt-/EVCS-Einrichtung:\n1. OCPP/Wallbox-Modul installieren.\n2. Ladepunkt-ID, Endpoint und Authentifizierung prüfen.\n3. Dienst starten und Verbindung im Log kontrollieren.\n4. Danach Ladeleistung, Fahrzeugstatus und Freigabe-Datenpunkte mit dem EOS Energiemanagement verknüpfen.';
        }
        if (/backup|backitup|sicherung|restore/.test(q)) {
            return 'Backup-Empfehlung:\n1. BackItUp bleibt ein geschütztes EOS-Systemmodul.\n2. Vor Updates immer ein Backup starten.\n3. Restore-Ziel und Speicherort prüfen.\n4. Installateur-/Endkundenrollen sollten BackItUp nicht löschen oder deaktivieren dürfen.';
        }
        if (/recht|rolle|benutzer|installateur|kunde|admin/.test(q)) {
            return 'Rechte-Empfehlung:\n1. Administrator: volle Wartung und Systemschutz.\n2. Installateur: Module konfigurieren, aber geschützte Adapter nicht löschen.\n3. Endkunde: Bedienung und Ansicht, keine Systemmodule.\n4. Geschützte Adapter legt der Administrator im EOS-Sicherheitsbereich fest.';
        }
        if (/log|fehler|warn|error|timeout|offline/.test(q)) {
            return 'Fehleranalyse:\n1. In Systemlogs nach Quelle und Level filtern.\n2. Wiederholte Meldungen priorisieren.\n3. Bei Timeout Netzwerk/IP/Port prüfen.\n4. Bei Auth-Warnungen Zugangsdaten im Gerät und Adapter vergleichen.\n5. Danach nur die betroffene Instanz neu starten, nicht das komplette System.';
        }
        if (/update|aktualisieren|npm|repository|repo/.test(q)) {
            return 'Update-Prüfung:\n1. NexoWatt-Repository aktiv setzen.\n2. Version im Repository und npm vergleichen.\n3. Bei EOS Admin: iobroker upgrade eos-admin, danach iobroker upload eos-admin.\n4. Browser mit Strg+F5 neu laden.\n5. Vor größeren Updates Backup erstellen.';
        }
        if (/dienst|instanz|start|stop|neustart/.test(q)) {
            return 'Dienst prüfen:\n1. Status ansehen: grün/läuft, rot/gestoppt, gelb/Warnung.\n2. Speicherverbrauch und Log-Level prüfen.\n3. Bei Fehlern zuerst Log öffnen.\n4. Dann Instanz neu starten.\n5. Wenn der Fehler wiederkommt, Konfiguration und Abhängigkeiten prüfen.';
        }
        return `Ich habe deine Frage lokal eingeordnet.\n\nBereich: ${contextTitle()}\n\nEmpfohlene nächsten Schritte:\n1. Ziel klären: installieren, konfigurieren, Fehler suchen oder absichern.\n2. Betroffenes Modul/Dienst auswählen.\n3. Logs und Status prüfen.\n4. Änderung speichern und nur die betroffene Instanz neu starten.\n\nHinweis: Diese erste EOS-Assistenz arbeitet lokal ohne Cloud. Eine echte KI-Anbindung kann später über einen NexoWatt- oder MCP-Dienst ergänzt werden.`;
    };

    const setOpen = open => {
        document.documentElement.classList.toggle('eos-assist-open', !!open);
        try { localStorage.setItem(STORE_KEY, open ? '1' : '0'); } catch { /* ignore */ }
    };

    const renderAnswer = (panel, question) => {
        const out = panel.querySelector('.eos-assist-answer');
        if (out) out.textContent = answerFor(question);
        const ctx = panel.querySelector('.eos-assist-context');
        if (ctx) ctx.textContent = contextTitle();
        const hint = panel.querySelector('.eos-assist-hint');
        if (hint) hint.textContent = routeAdvice();
    };

    const ensureAssistant = () => {
        if (!document.body || document.querySelector('.eos-assist-launcher')) return;
        if (document.documentElement.classList.contains('eos-login')) return;
        if (!document.getElementById('app-paper')) return;

        const launcher = document.createElement('button');
        launcher.type = 'button';
        launcher.className = 'eos-assist-launcher';
        launcher.innerHTML = '<span>✦</span><span>EOS Assist</span>';
        launcher.setAttribute('aria-label', 'EOS Assist öffnen');

        const panel = document.createElement('aside');
        panel.className = 'eos-assist-panel';
        panel.setAttribute('aria-label', 'EOS Assist');
        panel.innerHTML = `
            <div class="eos-assist-head">
                <span class="eos-assist-logo"><img src="${LOGO}" alt="NexoWatt EOS" /></span>
                <span><strong>EOS Assist</strong><small><span class="eos-assist-context"></span> · geführte Einrichtung</small></span>
                <button type="button" class="eos-assist-close" aria-label="Schließen">×</button>
            </div>
            <div class="eos-assist-body">
                <div class="eos-assist-card"><strong>Aktueller Hinweis</strong><p class="eos-assist-hint"></p></div>
                <div class="eos-assist-actions">
                    <button type="button" data-question="Wie richte ich dieses Modul ein?">Modul einrichten</button>
                    <button type="button" data-question="Wie prüfe ich Fehler in den Logs?">Fehler prüfen</button>
                    <button type="button" data-question="Welche Rechte braucht der Installateur?">Rechte erklären</button>
                    <button type="button" data-question="Was muss ich vor einem Update beachten?">Update-Check</button>
                </div>
                <div class="eos-assist-input-row">
                    <input class="eos-assist-input" type="text" placeholder="Frage eingeben, z. B. Modbus einrichten" />
                    <button type="button" class="eos-assist-send">Fragen</button>
                </div>
                <div class="eos-assist-card eos-assist-answer"></div>
                <div class="eos-assist-foot">Lokale Assistenz ohne Cloud. Für echte KI-Automation kann später ein NexoWatt-Dienst angebunden werden.</div>
            </div>
        `;

        document.body.appendChild(launcher);
        document.body.appendChild(panel);
        renderAnswer(panel, '');

        launcher.addEventListener('click', () => setOpen(!document.documentElement.classList.contains('eos-assist-open')));
        panel.querySelector('.eos-assist-close')?.addEventListener('click', () => setOpen(false));
        panel.querySelector('.eos-assist-send')?.addEventListener('click', () => renderAnswer(panel, panel.querySelector('.eos-assist-input')?.value || ''));
        panel.querySelector('.eos-assist-input')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') renderAnswer(panel, event.currentTarget.value || '');
        });
        panel.querySelectorAll('button[data-question]').forEach(button => {
            button.addEventListener('click', () => {
                const question = button.getAttribute('data-question') || '';
                const input = panel.querySelector('.eos-assist-input');
                if (input) input.value = question;
                renderAnswer(panel, question);
            });
        });

        try { if (localStorage.getItem(STORE_KEY) === '1') setOpen(true); } catch { /* ignore */ }
    };

    const removeOnLogin = () => {
        if (!document.documentElement.classList.contains('eos-login')) return;
        document.querySelectorAll('.eos-assist-launcher,.eos-assist-panel').forEach(el => el.remove());
    };

    const run = () => {
        removeOnLogin();
        void fetchAssistantPolicy().then(allowed => {
            if (!allowed) {
                document.querySelectorAll('.eos-assist-launcher,.eos-assist-panel').forEach(el => el.remove());
                return;
            }
            ensureAssistant();
            const panel = document.querySelector('.eos-assist-panel');
            if (panel) renderAnswer(panel, panel.querySelector('.eos-assist-input')?.value || '');
        });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
    window.addEventListener('hashchange', () => setTimeout(run, 80));
    window.addEventListener('load', () => setTimeout(run, 120), { once: true });
    new MutationObserver(() => {
        if (!document.querySelector('.eos-assist-launcher')) run();
    }).observe(document.documentElement, { childList: true, subtree: true });
})();
