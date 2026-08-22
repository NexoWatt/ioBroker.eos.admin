(() => {
    'use strict';

    const VERSION = 'v93-header-eos-assist-live-system';
    const previous = window.NEXOWATT_EOS_ASSIST;
    if (previous?.version === VERSION) return;
    previous?.destroy?.();

    const scriptUrl =
        document.currentScript?.src || document.querySelector('script[src*="eos-assistant.js"]')?.src || location.href;
    const logoUrl = new URL('../img/eos/nexowatt-192.png', scriptUrl).href;
    const abort = new AbortController();
    let unsubscribeDom = null;
    let reconnectTimer = 0;
    let destroyed = false;
    let socket = null;
    let status = null;
    let settings = {
        provider: 'anthropic',
        model: '',
        credentialId: '',
        baseUrl: '',
        allowSelfSignedCerts: false,
    };
    let credentials = [];
    let apiMessages = [];
    let historyKey = 'NexoWatt.EOS.Assist.anonymous';
    let loading = false;

    const currentContext = () => {
        const hash = String(location.hash || '').toLowerCase();
        if (hash.includes('tab-adapters')) {
            return ['Module', 'Fragen zu installierten Modulen, Versionen, Kompatibilität und Einrichtung.'];
        }
        if (hash.includes('tab-instances')) {
            return ['Dienste', 'Fragen zu laufenden Diensten, Status, Einstellungen, Speicherverbrauch und Fehlern.'];
        }
        if (hash.includes('tab-objects')) {
            return ['Datenpunkte', 'Fragen zu Messwerten, Metadaten, Schreibfreigaben und aktuellen Zuständen.'];
        }
        if (hash.includes('tab-enums')) {
            return ['Struktur', 'Fragen zu Räumen, Funktionen, Smart-Home-Zuordnungen und Geräten.'];
        }
        if (hash.includes('tab-logs')) {
            return ['Systemlogs', 'Fragen zu aktuellen Meldungen, Verbindungen und Fehlerursachen.'];
        }
        if (hash.includes('tab-users')) {
            return ['Zugänge & Rechte', 'Fragen zu EOS-Rollen, Zugängen und erlaubten Funktionen.'];
        }
        if (hash.includes('nexowatt-backup') || hash.includes('tab-backup')) {
            return ['NexoWatt Backup', 'Fragen zu Sicherungsstatus, Sicherungszielen und Wiederherstellung.'];
        }
        if (hash.includes('tab-intro')) {
            return ['Übersicht', 'Fragen zum Anlagenstatus und zu allen freigegebenen EOS-Bereichen.'];
        }
        return ['EOS Assist', 'Fragen zum laufenden System, Einstellungen, Modulen, Geräten und Datenpunkten.'];
    };

    const findToolbar = () =>
        document.querySelector(
            '.eos-top-toolbar, #root > .MuiPaper-root > .MuiAppBar-root .MuiToolbar-root, .MuiAppBar-root .MuiToolbar-root',
        );
    const findUserAnchor = toolbar =>
        Array.from(toolbar?.children || []).find(
            child => child.querySelector?.('.MuiAvatar-root') || /\b(admin|installer|guest|endkunde|service)\b/i.test(child.textContent || ''),
        ) || null;

    const socketPath = () => {
        let parts = location.pathname.split('/');
        parts.pop();
        if (location.pathname.match(/^\/admin\//)) parts = [];
        const value = `${parts.join('/')}/socket.io`.replace(/\/{2,}/g, '/');
        return value.startsWith('/') ? value : `/${value}`;
    };

    const emit = (event, payload = {}, timeoutMs = 30_000) =>
        new Promise((resolve, reject) => {
            if (!socket?.connected) {
                reject(new Error('Keine Verbindung zum EOS-System.'));
                return;
            }
            let finished = false;
            const timer = window.setTimeout(() => {
                if (finished) return;
                finished = true;
                reject(new Error('Zeitüberschreitung bei der EOS-Anfrage.'));
            }, timeoutMs);
            socket.emit(event, payload, response => {
                if (finished) return;
                finished = true;
                window.clearTimeout(timer);
                resolve(response || {});
            });
        });

    const remove = () => document.getElementById('eos-assist-root')?.remove();
    const escapeRole = role => (role === 'admin' ? 'Admin / Service' : role === 'installer' ? 'Installateur' : 'Endkunde');

    const persistHistory = () => {
        try {
            sessionStorage.setItem(historyKey, JSON.stringify({ apiMessages: apiMessages.slice(-24) }));
        } catch {
            // A conversation must still work if session storage is unavailable.
        }
    };

    const loadHistory = () => {
        apiMessages = [];
        try {
            const parsed = JSON.parse(sessionStorage.getItem(historyKey) || '{}');
            if (Array.isArray(parsed.apiMessages)) {
                apiMessages = parsed.apiMessages
                    .filter(
                        message =>
                            (message?.role === 'user' || message?.role === 'assistant') &&
                            typeof message.content === 'string',
                    )
                    .slice(-24);
            }
        } catch {
            apiMessages = [];
        }
    };

    const appendLinkAwareText = (container, text) => {
        const source = String(text || '');
        const regex = /\[([^\]]+)\]\((#[^)]+)\)/g;
        let cursor = 0;
        let match;
        while ((match = regex.exec(source))) {
            if (match.index > cursor) container.append(document.createTextNode(source.substring(cursor, match.index)));
            const link = document.createElement('a');
            link.href = match[2];
            link.textContent = match[1];
            link.addEventListener(
                'click',
                event => {
                    event.preventDefault();
                    location.hash = match[2];
                },
                { signal: abort.signal },
            );
            container.append(link);
            cursor = regex.lastIndex;
        }
        if (cursor < source.length) container.append(document.createTextNode(source.substring(cursor)));
    };

    const appendMessage = (role, text, extraClass = '') => {
        const root = document.getElementById('eos-assist-root');
        const transcript = root?.querySelector('.eos-assist-transcript');
        if (!transcript) return;
        transcript.querySelector('.eos-assist-welcome')?.remove();
        const article = document.createElement('article');
        article.className = `eos-assist-message eos-assist-message-${role}${extraClass ? ` ${extraClass}` : ''}`;
        const label = document.createElement('strong');
        label.textContent = role === 'user' ? 'Du' : role === 'error' ? 'Hinweis' : 'EOS Assist';
        const body = document.createElement('div');
        appendLinkAwareText(body, text);
        article.append(label, body);
        transcript.append(article);
        transcript.scrollTop = transcript.scrollHeight;
    };

    const renderHistory = () => {
        const root = document.getElementById('eos-assist-root');
        const transcript = root?.querySelector('.eos-assist-transcript');
        if (!transcript) return;
        transcript.innerHTML = '';
        if (!apiMessages.length) {
            const welcome = document.createElement('div');
            welcome.className = 'eos-assist-welcome';
            welcome.textContent =
                'Frage nach dem aktuellen Anlagenstatus, einer Einstellung, einem Modul, Dienst, Gerät, Datenpunkt oder Fehler.';
            transcript.append(welcome);
            return;
        }
        for (const message of apiMessages) appendMessage(message.role, message.content);
    };

    const setConnectionText = (text, kind = '') => {
        const element = document.querySelector('#eos-assist-root .eos-assist-status');
        if (!element) return;
        element.textContent = text;
        element.dataset.kind = kind;
    };

    const updateStatusUi = () => {
        const root = document.getElementById('eos-assist-root');
        if (!root) return;
        const configure = root.querySelector('.eos-assist-configure');
        configure?.classList.toggle('eos-assist-config-hidden', !status?.canConfigure);
        root.classList.toggle('eos-assist-not-configured', status?.configured === false);
        const role = status?.role ? escapeRole(status.role) : '';
        if (!socket?.connected) setConnectionText('Verbindung wird hergestellt …', 'waiting');
        else if (!status) setConnectionText('Systemstatus wird geladen …', 'waiting');
        else if (!status.configured) {
            setConnectionText(
                status.canConfigure
                    ? 'EOS Assist muss einmalig konfiguriert werden.'
                    : 'EOS Assist wurde noch nicht durch Admin / Service konfiguriert.',
                'warning',
            );
        } else setConnectionText(`Verbunden · ${role} · schreibgeschützt`, 'ready');
    };

    const fillSettingsForm = () => {
        const root = document.getElementById('eos-assist-root');
        if (!root) return;
        const provider = root.querySelector('.eos-assist-provider');
        const credential = root.querySelector('.eos-assist-credential');
        const model = root.querySelector('.eos-assist-model');
        const baseUrl = root.querySelector('.eos-assist-base-url');
        const selfSigned = root.querySelector('.eos-assist-self-signed');
        if (provider) provider.value = settings.provider || 'anthropic';
        if (credential) {
            credential.innerHTML = '<option value="">Kein Zugang ausgewählt</option>';
            for (const entry of credentials) {
                const option = document.createElement('option');
                option.value = entry.id || '';
                option.textContent = entry.name || entry.id || 'KI-Zugang';
                credential.append(option);
            }
            credential.value = settings.credentialId || '';
        }
        if (model) model.value = settings.model || '';
        if (baseUrl) baseUrl.value = settings.baseUrl || '';
        if (selfSigned) selfSigned.checked = settings.allowSelfSignedCerts === true;
        root.classList.toggle('eos-assist-custom-provider', provider?.value === 'custom');
    };

    const readSettingsForm = () => {
        const root = document.getElementById('eos-assist-root');
        return {
            provider: root?.querySelector('.eos-assist-provider')?.value || 'anthropic',
            credentialId: root?.querySelector('.eos-assist-credential')?.value || '',
            model: root?.querySelector('.eos-assist-model')?.value?.trim() || '',
            baseUrl: root?.querySelector('.eos-assist-base-url')?.value?.trim() || '',
            allowSelfSignedCerts: root?.querySelector('.eos-assist-self-signed')?.checked === true,
        };
    };

    const loadStatus = async () => {
        try {
            const response = await emit('eosAssistStatus');
            if (response.error) throw new Error(response.error);
            status = response;
            settings = { ...settings, ...(response.settings || {}) };
            credentials = Array.isArray(response.credentials) ? response.credentials : [];
            const nextKey = `NexoWatt.EOS.Assist.${response.user || 'anonymous'}`;
            if (historyKey !== nextKey) {
                historyKey = nextKey;
                loadHistory();
                renderHistory();
            }
            fillSettingsForm();
            updateStatusUi();
        } catch (error) {
            status = null;
            setConnectionText(error instanceof Error ? error.message : String(error), 'error');
        }
    };

    const connectSocket = () => {
        if (destroyed || socket?.connected) return;
        if (!window.io?.connect) {
            reconnectTimer = window.setTimeout(connectSocket, 250);
            return;
        }
        socket = window.io.connect('/', { path: socketPath() });
        socket.on('connect', () => {
            setConnectionText('Verbunden. Systemstatus wird geladen …', 'waiting');
            void loadStatus();
        });
        socket.on('disconnect', () => {
            status = null;
            updateStatusUi();
        });
        socket.on('reauthenticate', () => {
            setConnectionText('Die Sitzung ist abgelaufen. Bitte erneut anmelden.', 'error');
        });
        socket.on('connect_error', error => {
            setConnectionText(`Verbindungsfehler: ${error?.message || error}`, 'error');
        });
    };

    const setBusy = busy => {
        loading = busy;
        const root = document.getElementById('eos-assist-root');
        const input = root?.querySelector('.eos-assist-input');
        const send = root?.querySelector('.eos-assist-send');
        if (input) input.disabled = busy;
        if (send) {
            send.disabled = busy;
            send.textContent = busy ? 'Prüft …' : 'Fragen';
        }
    };

    const sendQuestion = async () => {
        const root = document.getElementById('eos-assist-root');
        const input = root?.querySelector('.eos-assist-input');
        const text = String(input?.value || '').trim();
        if (!text || loading) return;
        if (!status?.configured) {
            appendMessage(
                'error',
                status?.canConfigure
                    ? 'Öffne die Einstellungen von EOS Assist und hinterlege Anbieter, Zugang und Modell.'
                    : 'EOS Assist muss zuerst durch Admin / NexoWatt Service konfiguriert werden.',
            );
            return;
        }
        apiMessages.push({ role: 'user', content: text });
        apiMessages = apiMessages.slice(-24);
        persistHistory();
        appendMessage('user', text);
        input.value = '';
        setBusy(true);
        setConnectionText('EOS Assist prüft das aktuelle System und die freigegebenen Daten …', 'waiting');
        try {
            const response = await emit(
                'eosAssist',
                { messages: apiMessages, uiContext: { hash: location.hash } },
                620_000,
            );
            if (response.error) {
                appendMessage('error', response.error);
                if (response.code === 'notConfigured') {
                    status = { ...(status || {}), configured: false, canConfigure: response.canConfigure === true };
                }
                updateStatusUi();
                return;
            }
            const answer = String(response.content || 'Es wurde keine Antwort erzeugt.');
            apiMessages.push({ role: 'assistant', content: answer });
            apiMessages = apiMessages.slice(-24);
            persistHistory();
            appendMessage('assistant', answer);
            for (const action of response.clientActions || []) {
                if (action?.type === 'navigate' && typeof action.hash === 'string') {
                    location.hash = action.hash.startsWith('#') ? action.hash : `#${action.hash}`;
                }
            }
            setConnectionText(`Antwort auf Basis des aktuellen EOS-Systems · ${escapeRole(status.role)}`, 'ready');
        } catch (error) {
            appendMessage('error', error instanceof Error ? error.message : String(error));
            setConnectionText('Die Anfrage konnte nicht abgeschlossen werden.', 'error');
        } finally {
            setBusy(false);
            input?.focus();
        }
    };

    const openSettings = open => {
        const root = document.getElementById('eos-assist-root');
        if (!root || !status?.canConfigure) return;
        root.classList.toggle('eos-assist-settings-open', open);
        fillSettingsForm();
    };

    const testSettings = async () => {
        const payload = readSettingsForm();
        setConnectionText('Verbindung und verfügbare Modelle werden geprüft …', 'waiting');
        try {
            const response = await emit('eosAssistTestSettings', payload, 30_000);
            if (response.error) throw new Error(response.error);
            const models = Array.isArray(response.models) ? response.models : [];
            const list = document.querySelector('#eos-assist-root .eos-assist-model-list');
            if (list) {
                list.innerHTML = '';
                for (const id of models) {
                    const option = document.createElement('option');
                    option.value = id;
                    list.append(option);
                }
            }
            const model = document.querySelector('#eos-assist-root .eos-assist-model');
            if (model && !model.value && models[0]) model.value = models[0];
            setConnectionText(`${models.length} Modell(e) gefunden.`, 'ready');
        } catch (error) {
            setConnectionText(error instanceof Error ? error.message : String(error), 'error');
        }
    };

    const saveSettings = async () => {
        const payload = readSettingsForm();
        setConnectionText('EOS-Assist-Einstellungen werden gespeichert …', 'waiting');
        try {
            const response = await emit('eosAssistSaveSettings', payload, 30_000);
            if (response.error) throw new Error(response.error);
            settings = { ...settings, ...(response.settings || payload) };
            status = { ...(status || {}), configured: response.configured === true };
            openSettings(false);
            updateStatusUi();
            setConnectionText('EOS Assist ist konfiguriert und schreibgeschützt bereit.', 'ready');
        } catch (error) {
            setConnectionText(error instanceof Error ? error.message : String(error), 'error');
        }
    };

    const newConversation = () => {
        apiMessages = [];
        persistHistory();
        renderHistory();
        document.querySelector('#eos-assist-root .eos-assist-input')?.focus();
    };

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
                    <span class="eos-assist-dot"></span><strong>EOS Assist</strong><small>Systemhilfe</small>
                </button>
                <div class="eos-assist-panel" role="dialog" aria-label="EOS Assist">
                    <div class="eos-assist-head">
                        <img src="${logoUrl}" alt="NexoWatt EOS">
                        <div><strong class="eos-assist-title">EOS Assist</strong><span class="eos-assist-text"></span></div>
                        <button class="eos-assist-close" type="button" aria-label="Schließen">×</button>
                    </div>
                    <div class="eos-assist-toolbar">
                        <button class="eos-assist-new" type="button">Neue Unterhaltung</button>
                        <button class="eos-assist-configure eos-assist-config-hidden" type="button">Einstellungen</button>
                    </div>
                    <div class="eos-assist-conversation">
                        <div class="eos-assist-transcript" aria-live="polite"></div>
                        <div class="eos-assist-input-row">
                            <textarea class="eos-assist-input" rows="2" maxlength="4000" placeholder="Frage zum System, einer Einstellung, einem Modul oder Datenpunkt"></textarea>
                            <button class="eos-assist-send" type="button">Fragen</button>
                        </div>
                    </div>
                    <div class="eos-assist-settings" aria-label="EOS Assist Einstellungen">
                        <label>Anbieter<select class="eos-assist-provider">
                            <option value="anthropic">Anthropic</option>
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                            <option value="deepseek">DeepSeek</option>
                            <option value="custom">Lokal / individueller Anbieter</option>
                        </select></label>
                        <label>Gespeicherter KI-Zugang<select class="eos-assist-credential"></select></label>
                        <label class="eos-assist-base-url-label">Basis-URL<input class="eos-assist-base-url" placeholder="http://127.0.0.1:11434/v1"></label>
                        <label>Modell<input class="eos-assist-model" list="eos-assist-model-list" placeholder="Modellbezeichnung"><datalist id="eos-assist-model-list" class="eos-assist-model-list"></datalist></label>
                        <label class="eos-assist-check"><input class="eos-assist-self-signed" type="checkbox"> Selbstsigniertes Zertifikat zulassen</label>
                        <div class="eos-assist-settings-actions">
                            <button class="eos-assist-settings-back" type="button">Zurück</button>
                            <button class="eos-assist-test" type="button">Verbindung testen</button>
                            <button class="eos-assist-save" type="button">Speichern</button>
                        </div>
                    </div>
                    <div class="eos-assist-status" data-kind="waiting">Verbindung wird hergestellt …</div>
                </div>`;
            const userAnchor = findUserAnchor(toolbar);
            toolbar.insertBefore(root, userAnchor);
            renderHistory();
            root.addEventListener(
                'click',
                event => {
                    const button = event.target?.closest?.('button');
                    if (!button) return;
                    if (button.classList.contains('eos-assist-button')) {
                        const open = !root.classList.contains('eos-assist-open');
                        root.classList.toggle('eos-assist-open', open);
                        button.setAttribute('aria-expanded', open ? 'true' : 'false');
                        if (open) {
                            void loadStatus();
                            window.setTimeout(() => root.querySelector('.eos-assist-input')?.focus(), 30);
                        }
                    } else if (button.classList.contains('eos-assist-close')) {
                        root.classList.remove('eos-assist-open', 'eos-assist-settings-open');
                        root.querySelector('.eos-assist-button')?.setAttribute('aria-expanded', 'false');
                    } else if (button.classList.contains('eos-assist-send')) void sendQuestion();
                    else if (button.classList.contains('eos-assist-new')) newConversation();
                    else if (button.classList.contains('eos-assist-configure')) openSettings(true);
                    else if (button.classList.contains('eos-assist-settings-back')) openSettings(false);
                    else if (button.classList.contains('eos-assist-test')) void testSettings();
                    else if (button.classList.contains('eos-assist-save')) void saveSettings();
                },
                { signal: abort.signal },
            );
            root.addEventListener(
                'keydown',
                event => {
                    if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        event.target?.classList?.contains('eos-assist-input')
                    ) {
                        event.preventDefault();
                        void sendQuestion();
                    }
                    if (event.key === 'Escape') {
                        if (root.classList.contains('eos-assist-settings-open')) openSettings(false);
                        else {
                            root.classList.remove('eos-assist-open');
                            root.querySelector('.eos-assist-button')?.setAttribute('aria-expanded', 'false');
                        }
                    }
                },
                { signal: abort.signal },
            );
            root.querySelector('.eos-assist-provider')?.addEventListener(
                'change',
                event => root.classList.toggle('eos-assist-custom-provider', event.target.value === 'custom'),
                { signal: abort.signal },
            );
            updateStatusUi();
            connectSocket();
        } else if (root.parentElement !== toolbar) {
            const userAnchor = findUserAnchor(toolbar);
            toolbar.insertBefore(root, userAnchor);
        }
        const [title, text] = currentContext();
        root.querySelector('.eos-assist-title').textContent = title;
        root.querySelector('.eos-assist-text').textContent = text;
    };

    const connectDom = () => {
        const coordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
        if (!coordinator?.subscribe) {
            reconnectTimer = window.setTimeout(connectDom, 250);
            return;
        }
        unsubscribeDom = coordinator.subscribe(ensure);
    };

    window.addEventListener('hashchange', ensure, { signal: abort.signal });
    window.addEventListener('resize', ensure, { signal: abort.signal });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensure, { once: true, signal: abort.signal });
    } else ensure();
    connectDom();
    [250, 800, 1600].forEach(delay => window.setTimeout(ensure, delay));

    window.NEXOWATT_EOS_ASSIST = {
        version: VERSION,
        refresh: ensure,
        destroy() {
            destroyed = true;
            abort.abort();
            unsubscribeDom?.();
            if (reconnectTimer) window.clearTimeout(reconnectTimer);
            socket?.disconnect?.();
            socket = null;
            remove();
        },
    };
})();
