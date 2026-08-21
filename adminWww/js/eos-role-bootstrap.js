(() => {
    'use strict';

    const VERSION = 'v89-integrated-first-login-bootstrap';
    const script = document.currentScript || document.querySelector('script[src*="eos-role-bootstrap.js"]');
    const entry = script?.dataset?.eosEntry || '';
    let launched = false;

    const normalize = value => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9#/_:.-]+/g, ' ')
        .trim();

    const roleFromPolicy = policy => {
        const raw = normalize(policy?.role || policy?.eosRole || policy?.accessRole || '');
        if (policy?.isAdmin || policy?.isEosAdminGroup || policy?.isAdministrator || /^(?:admin|administrator)$/.test(raw)) return 'admin';
        if (/nexowatt service|eos service|service admin|service administrator/.test(raw)) return 'admin';
        if (policy?.isInstaller || /installateur|installer|installation|inbetriebnahme|techniker|technician|integrator|partner/.test(raw)) return 'installer';
        return 'enduser';
    };

    const isCustomerBackupTab = tab => /^(?:tab-)?(?:nexowatt-backup|eos-backup|nexowatt-sicherung)(?:-|$)/.test(normalize(tab));
    const isReleasedEndUserTab = tab => /^(?:tab-)?(?:nexowatt-ui|nexowatt-cockpit|eos-cockpit|eos-dashboard|kunden-cockpit|endkunden-cockpit|lovelace|jarvis|vis|iqontrol|material)(?:-|$)/.test(normalize(tab));
    const isOfficialReserveTab = tab => /^(?:tab-)?(?:admin|backitup)(?:-\d+)?$/.test(normalize(tab));
    const isInstallerDenied = tab => /(?:tab-hosts|tab-files|tab-xterm|tab-xtrem|tab-system|hosts|files|console|terminal|security)/.test(normalize(tab)) || isOfficialReserveTab(tab);
    const isAllowed = (role, route) => route !== 'easy' && (role === 'admin'
        || (role === 'installer'
            ? route === 'tab-intro' || route === 'tab-users' || isCustomerBackupTab(route) || !isInstallerDenied(route)
            : route === 'tab-intro' || route === 'tab-enums' || isCustomerBackupTab(route) || isReleasedEndUserTab(route)));
    const defaultTab = () => 'tab-intro';
    const currentRoute = () => {
        const hash = decodeURIComponent(window.location.hash || '').toLowerCase();
        if (/^#\/?easy(?:[/?&]|$)/.test(hash)) return 'easy';
        const direct = hash.match(/^#\/?(system|users|hosts|files|objects|instances|adapters|logs|enums)(?:[/?&]|$)/);
        if (direct) return `tab-${direct[1]}`;
        const match = hash.match(/tab-[a-z0-9_-]+(?:-\d+)?/i);
        return match ? match[0].toLowerCase() : 'tab-intro';
    };
    const navigate = route => { window.location.hash = `#${route === 'easy' ? 'tab-intro' : route}`; };

    const lockExpertMode = role => {
        if (role === 'admin') return;
        for (const storage of [window._sessionStorage || window.sessionStorage, window._localStorage || window.localStorage]) {
            try {
                storage.setItem('App.expertMode', 'false');
                storage.removeItem('App.doNotShowExpertDialog');
            } catch (_) { /* storage can be disabled */ }
        }
    };

    const launch = () => {
        if (launched || !entry) return;
        launched = true;
        window.NEXOWATT_EOS_APP_BOOTSTRAPPED = true;
        const module = document.createElement('script');
        module.type = 'module';
        module.src = entry;
        module.crossOrigin = 'anonymous';
        module.onerror = () => {
            launched = false;
            console.error(`Cannot load NexoWatt EOS frontend entry: ${entry}`);
        };
        document.head.appendChild(module);
    };

    const language = () => {
        const value = String(navigator.language || 'de').toLowerCase();
        return value.startsWith('nl') ? 'nl' : value.startsWith('en') ? 'en' : 'de';
    };
    const translations = {
        de: {
            title: 'Persönliches Passwort festlegen',
            intro: 'Bei der ersten Anmeldung muss für dieses Konto ein eigenes Passwort vergeben werden. Erst danach wird NexoWatt EOS freigeschaltet.',
            account: 'Konto', password: 'Neues Passwort', repeat: 'Passwort wiederholen', show: 'Passwort anzeigen',
            submit: 'Passwort speichern', saving: 'Passwort wird gespeichert …', logout: 'Abmelden',
            rules: min => `Mindestens ${min} Zeichen sowie Großbuchstabe, Kleinbuchstabe, Zahl und Sonderzeichen.`,
            required: 'Bitte beide Passwortfelder ausfüllen.', mismatch: 'Die Passwörter stimmen nicht überein.',
            length: min => `Das Passwort muss mindestens ${min} Zeichen lang sein.`, complexity: 'Groß-/Kleinbuchstabe, Zahl und Sonderzeichen sind erforderlich.',
            easy: 'Das Passwort ist zu leicht oder enthält den Kontonamen.', generic: 'Das Passwort konnte nicht gespeichert werden.', success: 'Passwort gespeichert. Die Anmeldung wird neu gestartet …',
            securityTitle: 'Zugriff wird geprüft', securityIntro: 'Die sichere Anmeldung wird gerade geprüft. Die Oberfläche bleibt gesperrt, bis die Berechtigungen eindeutig geladen wurden.',
            securityRetry: 'Jetzt erneut prüfen', securityLogout: 'Zur Anmeldung', securityAuto: seconds => `Automatischer neuer Versuch in ${seconds} Sekunden …`,
            claimLauncher: 'Erstanmeldung', claimTitle: 'Konto erstmals aktivieren',
            claimIntro: 'Wähle Installateur oder Gast/Endkunde und melde dich bei der allerersten Anmeldung einmalig mit leerem Passwort an. Danach muss sofort ein persönliches Passwort vergeben werden.',
            claimAccount: 'Kontoname', claimContinue: 'Erstanmeldung starten', claimChecking: 'Konto wird geprüft …',
            claimHint: 'Bei der ersten Anmeldung das Passwortfeld leer lassen.', claimUnavailable: 'Die Erstanmeldung ist für dieses Konto nicht verfügbar oder wurde bereits abgeschlossen.',
            claimPrivate: 'Die Erstanmeldung ist nur im lokalen Netzwerk möglich.', claimExpired: 'Die Aktivierung ist abgelaufen. Bitte erneut starten.',
            claimReady: 'Konto bestätigt. Lege jetzt dein persönliches Passwort fest.', claimSuccess: 'Passwort gespeichert. Du kannst dich jetzt normal anmelden.',
            claimLogin: 'Zur normalen Anmeldung', claimBack: 'Zurück',
        },
        en: {
            title: 'Create your personal password',
            intro: 'At the first sign-in, this account must choose its own password. NexoWatt EOS opens only after that step.',
            account: 'Account', password: 'New password', repeat: 'Repeat password', show: 'Show password',
            submit: 'Save password', saving: 'Saving password …', logout: 'Sign out',
            rules: min => `At least ${min} characters including upper/lower case, a number and a special character.`,
            required: 'Please complete both password fields.', mismatch: 'The passwords do not match.',
            length: min => `The password must contain at least ${min} characters.`, complexity: 'Upper/lower case, a number and a special character are required.',
            easy: 'The password is too easy or contains the account name.', generic: 'The password could not be saved.', success: 'Password saved. Restarting sign-in …',
            securityTitle: 'Checking access', securityIntro: 'The secure sign-in is being verified. The interface stays locked until the permissions are loaded unambiguously.',
            securityRetry: 'Check again now', securityLogout: 'Return to sign-in', securityAuto: seconds => `Retrying automatically in ${seconds} seconds …`,
            claimLauncher: 'First sign-in', claimTitle: 'Activate account for the first time',
            claimIntro: 'Choose Installer or Guest/End User and leave the password field empty for the very first sign-in. A personal password must be created immediately afterwards.',
            claimAccount: 'Account name', claimContinue: 'Start first sign-in', claimChecking: 'Checking account …',
            claimHint: 'Leave the password field empty only for the first sign-in.', claimUnavailable: 'First activation is unavailable for this account or has already been completed.',
            claimPrivate: 'First activation is only available on the local network.', claimExpired: 'The activation has expired. Please start again.',
            claimReady: 'Account confirmed. Create your personal password now.', claimSuccess: 'Password saved. You can now sign in normally.',
            claimLogin: 'Return to normal sign-in', claimBack: 'Back',
        },
        nl: {
            title: 'Persoonlijk wachtwoord instellen',
            intro: 'Bij de eerste aanmelding moet voor dit account een eigen wachtwoord worden gekozen. Daarna wordt NexoWatt EOS geopend.',
            account: 'Account', password: 'Nieuw wachtwoord', repeat: 'Wachtwoord herhalen', show: 'Wachtwoord tonen',
            submit: 'Wachtwoord opslaan', saving: 'Wachtwoord wordt opgeslagen …', logout: 'Afmelden',
            rules: min => `Minimaal ${min} tekens met hoofdletter, kleine letter, cijfer en speciaal teken.`,
            required: 'Vul beide wachtwoordvelden in.', mismatch: 'De wachtwoorden zijn niet gelijk.',
            length: min => `Het wachtwoord moet minimaal ${min} tekens bevatten.`, complexity: 'Hoofdletter, kleine letter, cijfer en speciaal teken zijn verplicht.',
            easy: 'Het wachtwoord is te eenvoudig of bevat de accountnaam.', generic: 'Het wachtwoord kon niet worden opgeslagen.', success: 'Wachtwoord opgeslagen. De aanmelding wordt opnieuw gestart …',
            securityTitle: 'Toegang wordt gecontroleerd', securityIntro: 'De veilige aanmelding wordt gecontroleerd. De interface blijft vergrendeld totdat de rechten eenduidig zijn geladen.',
            securityRetry: 'Nu opnieuw controleren', securityLogout: 'Terug naar aanmelden', securityAuto: seconds => `Automatisch opnieuw proberen over ${seconds} seconden …`,
            claimLauncher: 'Eerste aanmelding', claimTitle: 'Account voor het eerst activeren',
            claimIntro: 'Kies Installateur of Gast/Eindgebruiker en laat bij de allereerste aanmelding het wachtwoordveld leeg. Daarna moet direct een persoonlijk wachtwoord worden ingesteld.',
            claimAccount: 'Accountnaam', claimContinue: 'Eerste aanmelding starten', claimChecking: 'Account wordt gecontroleerd …',
            claimHint: 'Laat het wachtwoordveld alleen bij de eerste aanmelding leeg.', claimUnavailable: 'Eerste activering is voor dit account niet beschikbaar of al voltooid.',
            claimPrivate: 'Eerste activering is alleen mogelijk in het lokale netwerk.', claimExpired: 'De activering is verlopen. Start opnieuw.',
            claimReady: 'Account bevestigd. Stel nu je persoonlijke wachtwoord in.', claimSuccess: 'Wachtwoord opgeslagen. Je kunt nu normaal aanmelden.',
            claimLogin: 'Naar normale aanmelding', claimBack: 'Terug',
        },
    };

    const showFirstLoginPassword = (policy, base) => {
        const t = translations[language()];
        const passwordSetup = policy?.passwordSetup || {};
        const minLength = Number(passwordSetup.minLength || 10);
        const userName = String(passwordSetup.userName || policy?.user || '').replace(/^system\.user\./, '') || 'user';
        const endpoint = new URL('nexowatt/account/first-password', base).href;
        const logoutUrl = new URL('logout', base).href;
        window.NEXOWATT_EOS_PASSWORD_SETUP_ACTIVE = true;
        document.documentElement.classList.add('eos-first-login-active');
        document.body.replaceChildren();
        const overlay = document.createElement('main');
        overlay.className = 'eos-first-login-overlay';
        overlay.innerHTML = `
            <section class="eos-first-login-card" role="dialog" aria-modal="true" aria-labelledby="eos-first-login-title">
                <img class="eos-first-login-logo" src="./img/eos/eos-logo.svg" alt="NexoWatt EOS" />
                <div class="eos-first-login-kicker">Energy Operation System</div>
                <h1 id="eos-first-login-title"></h1>
                <p class="eos-first-login-intro"></p>
                <div class="eos-first-login-account"><span></span><strong></strong></div>
                <form novalidate>
                    <label><span class="password-label"></span><input name="password" type="password" autocomplete="new-password" maxlength="128" required /></label>
                    <label><span class="repeat-label"></span><input name="passwordRepeat" type="password" autocomplete="new-password" maxlength="128" required /></label>
                    <label class="eos-first-login-show"><input name="show" type="checkbox" /><span></span></label>
                    <p class="eos-first-login-rules"></p>
                    <div class="eos-first-login-status" aria-live="polite"></div>
                    <button class="eos-first-login-submit" type="submit"></button>
                    <a class="eos-first-login-logout" href="${logoutUrl}"></a>
                </form>
            </section>`;
        document.body.appendChild(overlay);
        overlay.querySelector('h1').textContent = t.title;
        overlay.querySelector('.eos-first-login-intro').textContent = t.intro;
        overlay.querySelector('.eos-first-login-account span').textContent = `${t.account}:`;
        overlay.querySelector('.eos-first-login-account strong').textContent = userName;
        overlay.querySelector('.password-label').textContent = t.password;
        overlay.querySelector('.repeat-label').textContent = t.repeat;
        overlay.querySelector('.eos-first-login-show span').textContent = t.show;
        overlay.querySelector('.eos-first-login-rules').textContent = t.rules(minLength);
        overlay.querySelector('.eos-first-login-submit').textContent = t.submit;
        overlay.querySelector('.eos-first-login-logout').textContent = t.logout;
        const form = overlay.querySelector('form');
        const password = form.elements.password;
        const repeat = form.elements.passwordRepeat;
        const show = form.elements.show;
        const status = overlay.querySelector('.eos-first-login-status');
        const submit = overlay.querySelector('.eos-first-login-submit');
        const setStatus = (message, kind = '') => { status.textContent = message || ''; status.dataset.kind = kind; };
        show.addEventListener('change', () => {
            const type = show.checked ? 'text' : 'password';
            password.type = type; repeat.type = type;
        });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!password.value || !repeat.value) return setStatus(t.required, 'error');
            if (password.value !== repeat.value) return setStatus(t.mismatch, 'error');
            if (password.value.length < minLength) return setStatus(t.length(minLength), 'error');
            if (!/[a-z]/.test(password.value) || !/[A-Z]/.test(password.value) || !/\d/.test(password.value) || !/[^A-Za-z0-9]/.test(password.value)) return setStatus(t.complexity, 'error');
            submit.disabled = true; submit.textContent = t.saving; setStatus('', '');
            try {
                const response = await fetch(endpoint, {
                    method: 'POST', credentials: 'same-origin', cache: 'no-store',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-NexoWatt-EOS-First-Login': '1' },
                    body: JSON.stringify({ password: password.value, passwordRepeat: repeat.value }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || data.error) {
                    const messages = { passwordRequired: t.required, passwordMismatch: t.mismatch, passwordLength: t.length(minLength), passwordComplexity: t.complexity, passwordTooEasy: t.easy };
                    throw new Error(messages[data.error] || t.generic);
                }
                setStatus(t.success, 'success');
                window.setTimeout(() => window.location.replace(logoutUrl), 650);
            } catch (error) {
                submit.disabled = false; submit.textContent = t.submit;
                setStatus(error?.message || t.generic, 'error');
            }
        });
        window.setTimeout(() => password.focus(), 0);
    };

    const showPasswordlessClaimPassword = (claim, base) => {
        const t = translations[language()];
        const minLength = Number(claim?.minLength || 10);
        const endpoint = new URL('nexowatt/account/passwordless-password', base).href;
        const loginUrl = new URL('index.html?login', base).href;
        document.querySelector('.eos-passwordless-claim-overlay')?.remove();
        const overlay = document.createElement('main');
        overlay.className = 'eos-first-login-overlay eos-passwordless-claim-overlay';
        overlay.innerHTML = `
            <section class="eos-first-login-card eos-passwordless-card" role="dialog" aria-modal="true" aria-labelledby="eos-passwordless-password-title">
                <img class="eos-first-login-logo" src="./img/eos/eos-logo.svg" alt="NexoWatt EOS" />
                <div class="eos-first-login-kicker">Energy Operation System</div>
                <div class="eos-activation-steps"><span class="done">1</span><i></i><span class="active">2</span><i></i><span>3</span></div>
                <h1 id="eos-passwordless-password-title"></h1>
                <p class="eos-first-login-intro"></p>
                <div class="eos-first-login-account"><span></span><strong></strong></div>
                <form novalidate>
                    <label><span class="password-label"></span><input name="password" type="password" autocomplete="new-password" maxlength="128" required /></label>
                    <label><span class="repeat-label"></span><input name="passwordRepeat" type="password" autocomplete="new-password" maxlength="128" required /></label>
                    <label class="eos-first-login-show"><input name="show" type="checkbox" /><span></span></label>
                    <p class="eos-first-login-rules"></p>
                    <div class="eos-first-login-status" data-kind="success" aria-live="polite"></div>
                    <button class="eos-first-login-submit" type="submit"></button>
                    <a class="eos-first-login-logout" href="${loginUrl}"></a>
                </form>
            </section>`;
        document.body.appendChild(overlay);
        overlay.querySelector('h1').textContent = t.title;
        overlay.querySelector('.eos-first-login-intro').textContent = t.claimReady;
        overlay.querySelector('.eos-first-login-account span').textContent = `${t.account}:`;
        overlay.querySelector('.eos-first-login-account strong').textContent = claim.userName || 'guest';
        overlay.querySelector('.password-label').textContent = t.password;
        overlay.querySelector('.repeat-label').textContent = t.repeat;
        overlay.querySelector('.eos-first-login-show span').textContent = t.show;
        overlay.querySelector('.eos-first-login-rules').textContent = t.rules(minLength);
        overlay.querySelector('.eos-first-login-submit').textContent = t.submit;
        overlay.querySelector('.eos-first-login-logout').textContent = t.claimBack;
        const form = overlay.querySelector('form');
        const password = form.elements.password;
        const repeat = form.elements.passwordRepeat;
        const show = form.elements.show;
        const status = overlay.querySelector('.eos-first-login-status');
        const submit = overlay.querySelector('.eos-first-login-submit');
        const setStatus = (message, kind = '') => { status.textContent = message || ''; status.dataset.kind = kind; };
        show.addEventListener('change', () => { const type = show.checked ? 'text' : 'password'; password.type = type; repeat.type = type; });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!password.value || !repeat.value) return setStatus(t.required, 'error');
            if (password.value !== repeat.value) return setStatus(t.mismatch, 'error');
            if (password.value.length < minLength) return setStatus(t.length(minLength), 'error');
            if (!/[a-z]/.test(password.value) || !/[A-Z]/.test(password.value) || !/\d/.test(password.value) || !/[^A-Za-z0-9]/.test(password.value)) return setStatus(t.complexity, 'error');
            submit.disabled = true; submit.textContent = t.saving; setStatus('', '');
            try {
                const response = await fetch(endpoint, {
                    method: 'POST', credentials: 'same-origin', cache: 'no-store',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-NexoWatt-EOS-Passwordless-Password': '1' },
                    body: JSON.stringify({ password: password.value, passwordRepeat: repeat.value }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || data.error) {
                    const messages = { passwordRequired: t.required, passwordMismatch: t.mismatch, passwordLength: t.length(minLength), passwordComplexity: t.complexity, passwordTooEasy: t.easy, claimExpired: t.claimExpired };
                    throw new Error(messages[data.error] || t.generic);
                }
                overlay.querySelector('.eos-activation-steps span:nth-of-type(2)')?.classList.add('done');
                overlay.querySelector('.eos-activation-steps span:nth-of-type(3)')?.classList.add('active');
                setStatus(t.claimSuccess, 'success');
                submit.textContent = t.claimLogin;
                submit.disabled = false;
                submit.type = 'button';
                submit.onclick = () => window.location.replace(loginUrl);
            } catch (error) {
                submit.disabled = false; submit.textContent = t.submit;
                setStatus(error?.message || t.generic, 'error');
            }
        });
        window.setTimeout(() => password.focus(), 0);
    };

    const installIntegratedFirstLogin = base => {
        const t = translations[language()];
        const managedAccounts = new Set(['installer', 'guest']);
        let busy = false;
        let unsubscribeDom = null;

        document.documentElement.classList.add('eos-modern-login', 'eos-integrated-first-login');
        document.querySelectorAll('.eos-passwordless-launcher').forEach(element => element.remove());

        const accountName = input => String(input?.value || '').trim().toLowerCase().replace(/^system\.user\./, '');
        const setInputValue = (input, value) => {
            if (!input) return;
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(input, value); else input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const loginElements = () => {
            const username = document.querySelector('input#username,input[name="username"]');
            const password = document.querySelector('input#password,input[name="password"]');
            const card = username?.closest?.('.MuiPaper-root,form,main,section') || password?.closest?.('.MuiPaper-root,form,main,section');
            const submit = card?.querySelector?.('button[type="submit"]') || Array.from(card?.querySelectorAll?.('button') || []).find(button => /anmelden|login|sign in|aanmelden/.test(normalize(button.textContent || '')));
            return { username, password, card, submit };
        };
        const statusNode = card => card?.querySelector?.('.eos-login-first-status');
        const setStatus = (card, message, kind = '') => {
            const status = statusNode(card);
            if (!status) return;
            status.textContent = message || '';
            status.dataset.kind = kind;
        };
        const updateLoginState = () => {
            const { username, password, card, submit } = loginElements();
            if (!username || !password || !card) return;
            const account = accountName(username);
            const blankManaged = managedAccounts.has(account) && !password.value;
            card.querySelectorAll('[data-eos-account]').forEach(button => button.classList.toggle('active', button.dataset.eosAccount === account));
            card.classList.toggle('eos-login-first-ready', blankManaged);
            if (submit && blankManaged && !busy) {
                submit.disabled = false;
                submit.removeAttribute('disabled');
                submit.dataset.eosPasswordlessSubmit = '1';
            } else if (submit) {
                delete submit.dataset.eosPasswordlessSubmit;
            }
            const hint = card.querySelector('.eos-login-first-hint');
            if (hint) hint.textContent = blankManaged ? t.claimIntro : t.claimHint;
        };
        const startClaim = async requestedAccount => {
            const { username, password, card, submit } = loginElements();
            const account = String(requestedAccount || accountName(username)).trim().toLowerCase();
            if (!managedAccounts.has(account) || password?.value || busy) return false;
            busy = true;
            if (submit) submit.disabled = true;
            setStatus(card, t.claimChecking, '');
            try {
                const response = await fetch(new URL('nexowatt/account/passwordless-claim', base).href, {
                    method: 'POST', credentials: 'same-origin', cache: 'no-store',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-NexoWatt-EOS-Passwordless-Claim': '1' },
                    body: JSON.stringify({ user: account }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || data.error) {
                    const message = data.error === 'privateNetworkRequired' ? t.claimPrivate : t.claimUnavailable;
                    throw new Error(message);
                }
                setStatus(card, '', '');
                showPasswordlessClaimPassword(data, base);
                return true;
            } catch (error) {
                setStatus(card, error?.message || t.claimUnavailable, 'error');
                return false;
            } finally {
                busy = false;
                updateLoginState();
            }
        };
        const ensureIntegratedLogin = () => {
            document.querySelectorAll('.eos-passwordless-launcher').forEach(element => element.remove());
            const { username, password, card } = loginElements();
            if (!username || !password || !card) return;
            card.classList.add('eos-login-card-modern');
            let selector = card.querySelector('.eos-login-role-selector');
            if (!selector) {
                selector = document.createElement('section');
                selector.className = 'eos-login-role-selector';
                selector.setAttribute('aria-label', t.claimAccount);
                selector.innerHTML = `
                    <div class="eos-login-role-heading"><strong>${t.claimAccount}</strong><span>${t.claimHint}</span></div>
                    <div class="eos-login-role-buttons">
                        <button type="button" data-eos-account="admin"><span>◆</span><strong>Admin / Service</strong></button>
                        <button type="button" data-eos-account="installer"><span>⚙</span><strong>Installateur</strong></button>
                        <button type="button" data-eos-account="guest"><span>⌂</span><strong>Gast / Endkunde</strong></button>
                    </div>
                    <p class="eos-login-first-hint"></p>
                    <div class="eos-login-first-status" aria-live="polite"></div>`;
                const usernameControl = username.closest('.MuiFormControl-root') || username.parentElement;
                card.insertBefore(selector, usernameControl || card.firstChild);
                selector.querySelectorAll('[data-eos-account]').forEach(button => button.addEventListener('click', () => {
                    setInputValue(username, button.dataset.eosAccount || '');
                    setInputValue(password, '');
                    window.setTimeout(() => password.focus(), 0);
                    updateLoginState();
                }));
            }
            if (!username.dataset.eosFirstLoginBound) {
                username.dataset.eosFirstLoginBound = '1';
                username.addEventListener('input', updateLoginState);
                password.addEventListener('input', updateLoginState);
            }
            updateLoginState();
        };

        document.addEventListener('click', event => {
            const { username, password, card, submit } = loginElements();
            if (!submit || !card || !submit.contains(event.target)) return;
            const account = accountName(username);
            if (!managedAccounts.has(account) || password?.value) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            void startClaim(account);
        }, { capture: true });
        document.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            const { username, password, card } = loginElements();
            if (!card?.contains(event.target)) return;
            const account = accountName(username);
            if (!managedAccounts.has(account) || password?.value) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            void startClaim(account);
        }, { capture: true });

        const connectCoordinator = () => {
            const coordinator = window.NEXOWATT_EOS_DOM_COORDINATOR;
            if (!coordinator?.subscribe) { window.setTimeout(connectCoordinator, 250); return; }
            unsubscribeDom?.();
            unsubscribeDom = coordinator.subscribe(ensureIntegratedLogin);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureIntegratedLogin, { once: true });
        else ensureIntegratedLogin();
        connectCoordinator();
        [150, 350, 750, 1400, 2600].forEach(delay => window.setTimeout(ensureIntegratedLogin, delay));

        window.NEXOWATT_EOS_FIRST_LOGIN = Object.freeze({
            version: VERSION,
            start: account => startClaim(account),
            refresh: ensureIntegratedLogin,
        });
    };

    const showSecurityRecovery = (base, error) => {
        const t = translations[language()];
        const retryKey = 'NEXOWATT_EOS_SECURITY_RETRY_COUNT';
        let count = 0;
        try {
            count = Math.min(8, Number(window.sessionStorage.getItem(retryKey) || 0) + 1);
            window.sessionStorage.setItem(retryKey, String(count));
        } catch (_) { /* storage can be disabled */ }
        const delay = Math.min(15_000, 1_500 * Math.pow(2, Math.min(count - 1, 3)));
        const logoutUrl = new URL('logout', base).href;
        window.NEXOWATT_EOS_SECURITY_CHECK_ACTIVE = true;
        document.documentElement.classList.add('eos-first-login-active');
        document.body.replaceChildren();
        const overlay = document.createElement('main');
        overlay.className = 'eos-first-login-overlay eos-security-recovery-overlay';
        overlay.innerHTML = `
            <section class="eos-first-login-card" role="alert" aria-live="assertive" aria-labelledby="eos-security-recovery-title">
                <img class="eos-first-login-logo" src="./img/eos/eos-logo.svg" alt="NexoWatt EOS" />
                <div class="eos-first-login-kicker">Energy Operation System</div>
                <h1 id="eos-security-recovery-title"></h1>
                <p class="eos-first-login-intro"></p>
                <div class="eos-first-login-status" data-kind="warning"></div>
                <button class="eos-first-login-submit" type="button"></button>
                <a class="eos-first-login-logout" href="${logoutUrl}"></a>
            </section>`;
        document.body.appendChild(overlay);
        overlay.querySelector('h1').textContent = t.securityTitle;
        overlay.querySelector('.eos-first-login-intro').textContent = t.securityIntro;
        overlay.querySelector('.eos-first-login-submit').textContent = t.securityRetry;
        overlay.querySelector('.eos-first-login-logout').textContent = t.securityLogout;
        const status = overlay.querySelector('.eos-first-login-status');
        const button = overlay.querySelector('.eos-first-login-submit');
        let remaining = Math.max(1, Math.ceil(delay / 1000));
        const update = () => { status.textContent = t.securityAuto(remaining); };
        update();
        const interval = window.setInterval(() => {
            remaining -= 1;
            if (remaining > 0) update();
        }, 1000);
        const retry = () => {
            window.clearInterval(interval);
            button.disabled = true;
            window.location.reload();
        };
        button.addEventListener('click', retry, { once: true });
        window.setTimeout(retry, delay);
        console.warn(`EOS access verification is unavailable; interface remains locked: ${error?.message || error}`);
    };

    const base = new URL('../', script?.src || window.location.href);
    const isLoginRequest = /(?:^|[?&])login(?:[=&]|$)/i.test(window.location.search || '');
    if (isLoginRequest) {
        launch();
        installIntegratedFirstLogin(base);
        return;
    }

    const contextUrl = new URL('nexowatt/security/context', base).href;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);

    window.NEXOWATT_EOS_BOOTSTRAP_READY = fetch(contextUrl, {
        credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
    })
        .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
        .then(policy => {
            if (policy?.authenticated === false) {
                // The normal NexoWatt EOS login component must be allowed to render. No role or
                // first-login decision is made until an authenticated session exists.
                launch();
                return Object.freeze({ ...policy, role: 'unknown' });
            }
            const role = roleFromPolicy(policy);
            const resolved = Object.freeze({ ...policy, role });
            window.NEXOWATT_EOS_BOOTSTRAP_POLICY = resolved;
            window.NEXOWATT_EOS_ACCESS_ROLE = role;
            try { window.sessionStorage.removeItem('NEXOWATT_EOS_SECURITY_RETRY_COUNT'); } catch (_) { /* ignore */ }
            lockExpertMode(role);
            if (role !== 'admin' && (resolved.mustChangePassword || resolved.passwordSetup?.required)) {
                showFirstLoginPassword(resolved, base);
                return resolved;
            }
            const route = currentRoute();
            if (!isAllowed(role, route)) navigate(defaultTab(role));
            launch();
            return resolved;
        })
        .catch(error => {
            // Fail closed: a missing/ambiguous role must never fall through to the unrestricted
            // application. A branded recovery view retries the security context instead.
            showSecurityRecovery(base, error);
            return null;
        })
        .finally(() => window.clearTimeout(timeout));

    window.NEXOWATT_EOS_ROLE_BOOTSTRAP = Object.freeze({
        version: VERSION, getRole: () => window.NEXOWATT_EOS_ACCESS_ROLE || 'unknown',
        getPolicy: () => window.NEXOWATT_EOS_BOOTSTRAP_POLICY || null, isAllowed, defaultTab,
    });
})();
