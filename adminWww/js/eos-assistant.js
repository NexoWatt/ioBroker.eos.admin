(() => {
    'use strict';

    const VERSION = 'v91-header-eos-assist';
    const previous = window.NEXOWATT_EOS_ASSIST;
    if (previous?.version === VERSION) return;
    previous?.destroy?.();

    const scriptUrl = document.currentScript?.src || document.querySelector('script[src*="eos-assistant.js"]')?.src || location.href;
    const logoUrl = new URL('../img/eos/nexowatt-192.png', scriptUrl).href;
    const abort = new AbortController();
    let unsubscribeDom = null;
    let timer = 0;
    let destroyed = false;

    const currentContext = () => {
        const hash = String(location.hash || '').toLowerCase();
        if (hash.includes('tab-adapters')) return ['Module', 'Module suchen, Version prüfen, Instanz konfigurieren und Datenpunkte kontrollieren.'];
        if (hash.includes('tab-instances')) return ['Dienste', 'Status, Log und Abhängigkeiten prüfen, bevor ein Dienst neu gestartet wird.'];
        if (hash.includes('tab-objects')) return ['Datenpunkte', 'Read-DPs bleiben lesend. Write-DPs lassen sich typgerecht bedienen; sicherheitsrelevante Writes benötigen Admin/Service.'];
        if (hash.includes('tab-users')) return ['Zugänge & Rechte', 'Zugänge einer EOS-Rolle zuordnen und persönliche Passwörter sicher zurücksetzen.'];
        if (hash.includes('tab-intro')) return ['Übersicht', 'Anlagenstatus, Module, Dienste und die für deine Rolle freigegebenen Bereiche im Blick behalten.'];
        return ['EOS Assist', 'NexoWatt EOS unterstützt dich beim Einrichten, Prüfen und Absichern des Systems.'];
    };

    const answer = query => {
        const text = String(query || '').toLowerCase();
        if (/datenpunkt|write|schreib|wert|state/.test(text)) return 'Prüfe Schreibfreigabe, Datentyp und EOS-Rolle. Boolean und Trigger werden direkt bedient; Zahlen, Texte und Auswahlwerte öffnen den nativen Wertdialog.';
        if (/update|aktualis/.test(text)) return 'Warte, bis Module und Verbindung vollständig geladen sind. Danach das Update starten und den Befehlsdialog bis zum Abschluss geöffnet lassen.';
        if (/wallbox|ocpp|lade/.test(text)) return 'Für Ladepunkte zuerst Status und Frische der OCPP-Daten prüfen. Schreibbefehle nur über die vorgesehenen Steuerdatenpunkte senden.';
        if (/rechte|benutzer|rolle|passwort/.test(text)) return 'Admin/Service besitzt Vollzugriff. Installateur erhält Inbetriebnahme und Fehlersuche sowie Endkunden-Reset. Endkunde erhält freigegebene Bedien- und Smart-Home-Funktionen.';
        if (/backup|sicherung/.test(text)) return 'Für den normalen Betrieb die NexoWatt Sicherung verwenden. Die interne System-Notfallsicherung ist ausschließlich für Admin/Service sichtbar.';
        return 'Beschreibe Gerät, Datenpunkt oder Fehlerbild genauer. EOS Assist grenzt danach Oberfläche, Modul, Protokoll oder Gerätekommunikation ein.';
    };

    const findToolbar = () => document.querySelector('.eos-top-toolbar, #root > .MuiPaper-root > .MuiAppBar-root .MuiToolbar-root, .MuiAppBar-root .MuiToolbar-root');
    const findUserAnchor = toolbar => Array.from(toolbar?.children || []).find(child => child.querySelector?.('.MuiAvatar-root') || /\b(admin|installer|guest|endkunde|service)\b/i.test(child.textContent || '')) || null;

    const remove = () => document.getElementById('eos-assist-root')?.remove();
    const ensure = () => {
        if (destroyed) return;
        const hasApp = !!document.getElementById('app-paper');
        const login = document.documentElement.classList.contains('eos-login');
        const toolbar = findToolbar();
        if (!hasApp || login || !toolbar) {
            remove();
            return;
        }
        toolbar.classList.add('eos-top-toolbar');
        let root = document.getElementById('eos-assist-root');
        if (!root) {
            root = document.createElement('section');
            root.id = 'eos-assist-root';
            root.className = 'eos-assist-root eos-assist-header-root';
            root.innerHTML = `
                <button class="eos-assist-button" type="button" aria-expanded="false" title="EOS Assist">
                    <span class="eos-assist-dot"></span><strong>EOS Assist</strong><small>Hilfe</small>
                </button>
                <div class="eos-assist-panel" role="dialog" aria-label="EOS Assist">
                    <div class="eos-assist-head"><img src="${logoUrl}" alt="NexoWatt EOS"><div><strong class="eos-assist-title"></strong><span class="eos-assist-text"></span></div><button class="eos-assist-close" type="button" aria-label="Schließen">×</button></div>
                    <div class="eos-assist-input-row"><input class="eos-assist-input" placeholder="Frage zu EOS, Modul oder Datenpunkt"><button class="eos-assist-send" type="button">Fragen</button></div>
                    <div class="eos-assist-answer">Beschreibe kurz, was geprüft oder eingerichtet werden soll.</div>
                </div>`;
            const userAnchor = findUserAnchor(toolbar);
            toolbar.insertBefore(root, userAnchor);
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
            }, { signal: abort.signal });
            root.addEventListener('keydown', event => {
                if (event.key === 'Enter' && event.target?.classList?.contains('eos-assist-input')) {
                    root.querySelector('.eos-assist-answer').textContent = answer(event.target.value || '');
                }
                if (event.key === 'Escape') {
                    root.classList.remove('eos-assist-open');
                    root.querySelector('.eos-assist-button')?.setAttribute('aria-expanded', 'false');
                }
            }, { signal: abort.signal });
        } else if (root.parentElement !== toolbar) {
            const userAnchor = findUserAnchor(toolbar);
            toolbar.insertBefore(root, userAnchor);
        }
        const [title, text] = currentContext();
        root.querySelector('.eos-assist-title').textContent = title;
        root.querySelector('.eos-assist-text').textContent = text;
    };

    const connect = () => {
        const coordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
        if (!coordinator?.subscribe) {
            timer = setTimeout(connect, 250);
            return;
        }
        unsubscribeDom = coordinator.subscribe(ensure);
    };

    window.addEventListener('hashchange', ensure, { signal: abort.signal });
    window.addEventListener('resize', ensure, { signal: abort.signal });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once: true, signal: abort.signal });
    else ensure();
    connect();
    [250, 800, 1600].forEach(delay => setTimeout(ensure, delay));

    window.NEXOWATT_EOS_ASSIST = {
        version: VERSION,
        refresh: ensure,
        destroy() {
            destroyed = true;
            abort.abort();
            unsubscribeDom?.();
            if (timer) clearTimeout(timer);
            remove();
        },
    };
})();
