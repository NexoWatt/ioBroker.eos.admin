(() => {
    'use strict';

    const VERSION = 'v83-nexowatt-native-shell-cleanup';
    const previous = window.NEXOWATT_EOS_ASSIST;
    if (previous?.version === VERSION) return;
    previous?.destroy?.();

    const scriptUrl = document.currentScript?.src || document.querySelector('script[src*="eos-assistant.js"]')?.src || location.href;
    const logoUrl = new URL('../img/eos/nexowatt-192.png', scriptUrl).href;
    let unsubscribeDom = null;
    let timer = 0;
    let destroyed = false;

    const currentContext = () => {
        const hash = String(location.hash || '').toLowerCase();
        if (hash.includes('tab-adapters')) return ['Module', 'Module suchen, Version prüfen, Instanz konfigurieren und Datenpunkte kontrollieren.'];
        if (hash.includes('tab-instances')) return ['Dienste', 'Status, Log und Abhängigkeiten prüfen, bevor ein Dienst neu gestartet wird.'];
        if (hash.includes('tab-objects')) return ['Datenpunkte', 'Read-DPs bleiben lesend. Write-DPs lassen sich typgerecht bedienen; sicherheitsrelevante Writes benötigen den Expertenmodus.'];
        if (hash.includes('tab-users')) return ['Zugänge & Rechte', 'Benutzer einer EOS-Rolle zuordnen und nur die benötigten Bereiche freigeben.'];
        return ['EOS Assist', 'NexoWatt EOS unterstützt dich beim Einrichten, Prüfen und Absichern des Systems.'];
    };

    const answer = query => {
        const text = String(query || '').toLowerCase();
        if (/datenpunkt|write|schreib|wert|state/.test(text)) return 'Prüfe common.write, Datentyp, Rolle und Expertenfreigabe. Boolean und Trigger werden direkt bedient; Zahlen, Texte und Auswahlwerte öffnen den nativen Wertdialog.';
        if (/update|aktualis/.test(text)) return 'Warte, bis Module und Socket vollständig geladen sind. Danach Update starten und den Befehlsdialog bis zum Abschluss geöffnet lassen.';
        if (/wallbox|ocpp|lade/.test(text)) return 'Für Ladepunkte zuerst Status und Frische der OCPP-Daten prüfen. Schreibbefehle nur über die vorgesehenen control-Datenpunkte senden.';
        if (/rechte|benutzer|rolle/.test(text)) return 'Admin besitzt Vollzugriff. Installateur erhält Einrichtung und Service. Endkunde erhält Bedienung und Smart-Home-Funktionen.';
        return 'Beschreibe Gerät, Datenpunkt oder Fehlerbild genauer. EOS Assist grenzt danach Oberfläche, Adapter, Protokoll oder Gerätekommunikation ein.';
    };

    const ensure = () => {
        if (destroyed) return;
        const hasApp = !!document.getElementById('app-paper');
        const login = document.documentElement.classList.contains('eos-login');
        if (!hasApp || login) {
            document.getElementById('eos-assist-root')?.remove();
            return;
        }
        let root = document.getElementById('eos-assist-root');
        if (!root) {
            root = document.createElement('section');
            root.id = 'eos-assist-root';
            root.className = 'eos-assist-root';
            root.innerHTML = `
                <button class="eos-assist-button" type="button" aria-expanded="false">
                    <span class="eos-assist-dot"></span><strong>EOS Assist</strong><small>KI-Hilfe</small>
                </button>
                <div class="eos-assist-panel" role="dialog" aria-label="EOS Assist">
                    <div class="eos-assist-head"><img src="${logoUrl}" alt="NexoWatt EOS"><div><strong class="eos-assist-title"></strong><span class="eos-assist-text"></span></div><button class="eos-assist-close" type="button">×</button></div>
                    <div class="eos-assist-input-row"><input class="eos-assist-input" placeholder="Frage zu EOS, Adapter oder Datenpunkt"><button class="eos-assist-send" type="button">Fragen</button></div>
                    <div class="eos-assist-answer">Beschreibe kurz, was geprüft oder eingerichtet werden soll.</div>
                </div>`;
            document.body.appendChild(root);
            root.addEventListener('click', event => {
                const button = event.target?.closest?.('button');
                if (!button) return;
                if (button.classList.contains('eos-assist-button')) {
                    const open = !root.classList.contains('eos-assist-open');
                    root.classList.toggle('eos-assist-open', open);
                    button.setAttribute('aria-expanded', open ? 'true' : 'false');
                    if (open) setTimeout(() => root.querySelector('.eos-assist-input')?.focus(), 30);
                } else if (button.classList.contains('eos-assist-close')) {
                    root.classList.remove('eos-assist-open');
                    root.querySelector('.eos-assist-button')?.setAttribute('aria-expanded', 'false');
                } else if (button.classList.contains('eos-assist-send')) {
                    const input = root.querySelector('.eos-assist-input');
                    root.querySelector('.eos-assist-answer').textContent = answer(input?.value || '');
                }
            });
            root.addEventListener('keydown', event => {
                if (event.key === 'Enter' && event.target?.classList?.contains('eos-assist-input')) {
                    root.querySelector('.eos-assist-answer').textContent = answer(event.target.value || '');
                }
            });
        }
        const [title, text] = currentContext();
        root.querySelector('.eos-assist-title').textContent = title;
        root.querySelector('.eos-assist-text').textContent = text;
        root.classList.toggle('eos-assist-config-hidden', document.documentElement.classList.contains('eos-adapter-config-surface'));
    };

    const connect = () => {
        const coordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
        if (!coordinator?.subscribe) {
            timer = setTimeout(connect, 250);
            return;
        }
        unsubscribeDom = coordinator.subscribe(ensure);
    };

    window.addEventListener('hashchange', ensure);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once: true });
    else ensure();
    connect();

    window.NEXOWATT_EOS_ASSIST = {
        version: VERSION,
        destroy() {
            destroyed = true;
            unsubscribeDom?.();
            if (timer) clearTimeout(timer);
            document.getElementById('eos-assist-root')?.remove();
        },
    };
})();
