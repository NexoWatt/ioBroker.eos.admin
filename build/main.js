"use strict";
/**
 *      Admin backend
 *
 *      Controls Adapter-Processes
 *
 *      Copyright 2014-2026 Denis Haev <dogafox@gmail.com>,
 *      MIT License
 *
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const semver = __importStar(require("semver"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const adapter_core_1 = require("@iobroker/adapter-core");
const socket_classes_1 = require("@iobroker/socket-classes");
const ws_server_1 = require("@iobroker/ws-server");
const translations_1 = require("./lib/translations");
const web_1 = __importDefault(require("./lib/web"));
const plugin_docker_1 = require("@iobroker/plugin-docker");
const objectFixes_1 = require("./lib/objectFixes");
const eosLicenseService_1 = require("./lib/eosLicenseService");
const eosSessionSecurity_1 = require("./lib/eosSessionSecurity");
const eosUiSessionRegistry_1 = require("./lib/eosUiSessionRegistry");
const eosHttpsClient_1 = require("./lib/eosHttpsClient");
const eosNewsSecurity_1 = require("./lib/eosNewsSecurity");
const logSearch_1 = require("./lib/logSearch");
const adapterName = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'package.json'), { encoding: 'utf-8' }))
    .name.split('.')
    .pop();
const { getInstalledInfo } = adapter_core_1.commonTools;
const ONE_HOUR_MS = 3_600_000;
/** How long another host may take to answer a request of the log search, e.g. to send a big log file */
const LOG_SEARCH_HOST_TIMEOUT_MS = 5_000;
/** How long another host may take to tell whether it supports a feature */
const FEATURE_CHECK_TIMEOUT_MS = 5_000;
const ERROR_PERMISSION = 'permissionError';
/** Instance-message type for pushed answers of a long request. Shared verbatim with the frontend. */
const UI_PUSH_MESSAGE_TYPE = 'pushedAnswer';
const CURRENT_MAX_MAJOR_NODEJS = 24;
const CURRENT_MAX_MAJOR_NPM = 11;
function clearLegacyNondeletable(common) {
    if (!('nondeletable' in common) || common.nondeletable !== true) {
        return false;
    }
    common.nondeletable = false;
    return true;
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isSocketSessionStore(value) {
    return !!value && typeof value.get === 'function' && typeof value.set === 'function';
}
function normalizeLoginTimeout(value, fallback = 3_600) {
    const ttl = Math.round(Number(value));
    if (!Number.isFinite(ttl) || ttl < 120) {
        return fallback;
    }
    return Math.min(ttl, 31_536_000); // 1 year hard limit
}
const EOS_ADMIN_ADAPTER_NAME = 'eos-admin';
const LEGACY_ADMIN_ADAPTER_NAME = 'admin';
const CORE_PROTECTED_ADAPTER_NAMES = [
    EOS_ADMIN_ADAPTER_NAME,
    'backitup',
    'nexowatt-backup',
    'eos-backup',
    'nexowatt-devices',
    'nexowatt-device',
    'nexowatt-dev',
    'nexowatt-ui',
];
const LEGACY_ADMIN_INSTANCE_ID = 'system.adapter.admin.0';
const LEGACY_BACKUP_ADAPTER_NAME = 'backitup';
const DEFAULT_LEGACY_ADMIN_LOCK_PORT = 18_081;
const DEFAULT_LEGACY_ADMIN_LOCK_BIND = '127.0.0.1';
const DEFAULT_EOS_ADMIN_GROUPS = ['system.group.administrator'];
const DEFAULT_ADMIN_ONLY_GROUP = DEFAULT_EOS_ADMIN_GROUPS[0];
const ADMIN_OWNER_USER = 'system.user.admin';
const ADMIN_ONLY_OBJECT_ACL = 0x660;
const EOS_ROLE_READABLE_OBJECT_ACL = 0x664;
const EOS_SERVICE_GROUP = 'system.group.nexowatt-service';
const EOS_INSTALLER_GROUP = 'system.group.installateur';
const EOS_ENDUSER_GROUP = 'system.group.endkunde';
// The EOS shell must be able to read the system configuration and repository metadata for
// installer/end-user sessions. Write access remains administrator-only through the object ACL.
const EOS_ROLE_READABLE_SYSTEM_OBJECT_IDS = ['system.config', 'system.repositories'];
// Secrets, certificates and platform license data remain visible only to NexoWatt Admin / Service.
const EOS_ADMIN_ONLY_SYSTEM_OBJECT_IDS = ['system.certificates', 'system.licenses'];
const EOS_SECURITY_OBJECT_IDS = [...EOS_ROLE_READABLE_SYSTEM_OBJECT_IDS, ...EOS_ADMIN_ONLY_SYSTEM_OBJECT_IDS];
function normalizeGroupId(value) {
    if (typeof value !== 'string') {
        return null;
    }
    let group = value.trim();
    if (!group) {
        return null;
    }
    if (!group.startsWith('system.group.')) {
        group = `system.group.${group.replace(/^group\./, '')}`;
    }
    return /^system\.group\.[a-z0-9_.-]+$/i.test(group) ? group : null;
}
function normalizeAdminOnlyGroups(value) {
    const result = new Set();
    const add = (entry) => {
        if (typeof entry === 'string') {
            const normalized = normalizeGroupId(entry);
            if (normalized) {
                result.add(normalized);
            }
            return;
        }
        if (entry && typeof entry === 'object') {
            const row = entry;
            if (row.enabled === false) {
                return;
            }
            const normalized = normalizeGroupId(row.group || row.id || row.name);
            if (normalized) {
                result.add(normalized);
            }
        }
    };
    if (Array.isArray(value)) {
        value.forEach(add);
    }
    if (!result.size) {
        DEFAULT_EOS_ADMIN_GROUPS.forEach(group => result.add(group));
    }
    return [...result].sort();
}
/**
 * Detect whether this process runs on a CI system (GitHub Actions, Travis, AppVeyor or anything else that sets `CI`).
 * Same detection as used by the Sentry plugin of the js-controller.
 */
function isCiSystem() {
    const ci = process.env.CI;
    if (ci && ci !== 'false' && ci !== '0') {
        return true;
    }
    return !!(process.env.GITHUB_ACTIONS || process.env.TRAVIS || process.env.APPVEYOR);
}
let socket;
let webServer;
let lastRepoUpdate;
// Cache of objects
let objects = {};
let systemLanguage = 'en';
const EOS_STABLE_INITIAL_PASSWORD = 'nexowatt';
const EOS_STABLE_ACCOUNTS = [
    { user: 'installer', role: 'installer' },
    { user: 'guest', role: 'customer' },
    { user: 'user', role: 'customer' },
];
async function ensureEosStableGroupMembership(adapter, user, role) {
    const candidateGroups = role === 'installer'
        ? ['system.group.installer', 'system.group.installateur', 'system.group.installers']
        : ['system.group.endkunde', 'system.group.endkunden'];
    const userId = `system.user.${user}`;
    for (const groupId of candidateGroups) {
        const group = (await adapter.getForeignObjectAsync(groupId));
        if (!group) {
            continue;
        }
        const members = Array.isArray(group.common?.members) ? [...group.common.members] : [];
        if (!members.includes(userId)) {
            members.push(userId);
            await adapter.extendForeignObjectAsync(groupId, { common: { members } }, { user: 'system.user.admin' });
        }
    }
}
async function ensureEosStableInitialAccounts(adapter) {
    for (const account of EOS_STABLE_ACCOUNTS) {
        const id = `system.user.${account.user}`;
        let object = (await adapter.getForeignObjectAsync(id));
        const created = !object;
        if (!object) {
            await adapter.setForeignObjectAsync(id, {
                type: 'user',
                common: { name: account.user, enabled: false, password: '' },
                native: {},
            }, { user: 'system.user.admin' });
            object = (await adapter.getForeignObjectAsync(id));
        }
        if (!object) {
            throw new Error('eosAccountProvisioningFailed');
        }
        let insecure = created || !String(object.common?.password || '').trim();
        if (!insecure) {
            // This legacy value is checked solely to retire previously shipped shared credentials.
            // It must never be assigned to a new or reset account.
            const result = await adapter.checkPasswordAsync(account.user, EOS_STABLE_INITIAL_PASSWORD, {
                user: 'system.user.admin',
            });
            insecure = Array.isArray(result) ? result[0] === true : result === true;
        }
        if (insecure) {
            // Disable before replacing the password: any write failure remains fail-closed.
            await adapter.extendForeignObjectAsync(id, { common: { enabled: false } }, { user: 'system.user.admin' });
            await adapter.setPasswordAsync(account.user, `${(0, node_crypto_1.randomBytes)(32).toString('base64url')}!aA1`, {
                user: 'system.user.admin',
            });
            await adapter.extendForeignObjectAsync(id, {
                native: {
                    nexowattManaged: true,
                    nexowattRole: account.role,
                    nexowattPasswordChangeRequired: true,
                    eosPasswordChangeRequired: true,
                    nexowattEosAccount: {
                        passwordInitialized: false,
                        passwordSetupVersion: 0,
                        forcePasswordChange: true,
                        passwordlessFirstLoginAllowed: false,
                        standardPasswordMode: false,
                        disabledForCredentialMigration: true,
                        credentialMigrationAt: new Date().toISOString(),
                    },
                },
            }, { user: 'system.user.admin' });
            adapter.log.warn(`EOS account ${account.user} disabled: unique credential provisioning by Admin required`);
        }
        // Existing individual passwords and their pending-reset metadata are deliberately retained.
        await ensureEosStableGroupMembership(adapter, account.user, account.role);
    }
}
class Admin extends adapter_core_1.Adapter {
    /** Local license authority; management/recovery is never license-gated. */
    eosLicenseService;
    /** secret used for the socket connection */
    secret = '';
    /** Central EOS-only capability revocation, installed before HTTP/socket startup. */
    eosSessionSecurity;
    /** Timer to update the repository */
    timerRepo;
    updaterTimeout;
    ratingTimeout;
    timerNews;
    _tasks = [];
    /** True if the adapter runs on a CI system (GitHub Actions, Travis, AppVeyor, ...). See `sendToHost` */
    ciSystem = isCiSystem();
    /** Where the log files of this host are. Found at the first search in the Log tab */
    logLocation = null;
    /**
     * GUI sessions, by the secret this adapter handed out when the page subscribed for pushed answers.
     *
     * A `admin:searchLogs` message carries the secret as `uiSession`; the message itself
     * has neither a socket id nor a user, so this map is the only thing that ties a request back to the
     * browser tab that sent it - and to the ioBroker user behind it. The secret is generated here and
     * never by the caller: a page may only ever name a session it was given.
     */
    uiPushSessions = new eosUiSessionRegistry_1.EosUiSessionRegistry();
    activeLogSearches = new Set();
    /** Periodic guard that keeps EOS safety policy applied even if object events are missed. */
    eosSecurityTimer = null;
    /** Debounce timer for object-change triggered safety checks. */
    eosSecurityDebounce = null;
    /** Avoid concurrent policy writes while the guard corrects objects. */
    eosSecurityRunning = false;
    /** Synchronous role cache used by the server-side socket command guard. */
    eosRoleCache = new Map();
    /** Non-admin accounts that must complete password setup before any socket command is accepted. */
    eosPasswordSetupRequired = new Set();
    eosDisabledUsers = new Set();
    eosRoleCacheHealthy = false;
    /** v47: stale delete-lock cleanup is a one-shot migration, not a repeating guard. */
    eosDeleteLockRepairFinished = false;
    constructor(options = {}) {
        options = {
            ...options,
            name: adapterName, // adapter name
            logTransporter: true, // receive the logs
            systemConfig: true,
            install: () => void null,
            /*
             * The GUI subscribes here so that the answer of a long request can be *pushed* to it. A turn
             * of the assistant (the LLM plus its tool rounds) and a search through the log files of
             * another host regularly run longer than 30 s, and `@iobroker/ws` answers every socket
             * callback with the string "timeout" after exactly that (socket.io.js:
             * `Date.now() + 30_000`). The answer then arrived in a dead callback: an empty chat, a
             * search that never ends, and nothing in any log. So the page gets an immediate
             * acknowledgement and the result later as an instance message.
             */
            uiClientSubscribe: (info) => this.onUiClientSubscribe(info),
            uiClientUnsubscribe: (info) => this.onUiClientUnsubscribe(info),
        };
        super(options);
        this.on('objectChange', this.onObjectChange);
        this.on('stateChange', this.onStateChange);
        this.on('ready', this.onReady);
        this.on('message', this.onMessage);
        this.on('unload', this.onUnload);
        this.on('fileChange', this.onFileChange);
        this.on('log', this.onLog);
    }
    /**
     * Is called if a subscribed object changes
     *
     * @param id object ID that changed
     * @param obj the changed object value
     */
    onObjectChange = (id, obj) => {
        // Invalidate before forwarding changes or waiting for the debounced role cache.
        this.eosSessionSecurity?.handleObjectChange(id, obj, objects[id]);
        if (/^system\.(?:user|group)\./.test(id)) {
            this.uiPushSessions.clear();
            webServer?.invalidateProxySessions();
        }
        if (/^system\.(?:user|group)\./.test(id)) {
            this.eosRoleCacheHealthy = false;
        }
        if (obj) {
            objects[id] = obj;
            if (id === 'system.config' && !this.config.language) {
                if (obj.common?.language) {
                    systemLanguage = obj.common.language;
                    webServer?.setLanguage(systemLanguage);
                }
            }
            if (id === 'system.repositories' || id.match(/^system\.adapter\.[^.]+$/)) {
                if (this.updaterTimeout) {
                    this.clearTimeout(this.updaterTimeout);
                }
                this.updaterTimeout = this.setTimeout(() => {
                    this.updaterTimeout = undefined;
                    void this.writeUpdateInfo();
                }, 5_000);
            }
        }
        else {
            // console.log('objectDeleted: ' + id);
            if (objects[id]) {
                delete objects[id];
            }
        }
        if (id.startsWith('system.adapter.')) {
            const { adapter } = this.parseAdapterObjectId(id);
            if (this.getProtectedAdapterNames().includes(adapter)) {
                this.scheduleEosSecurityGuard(`protected object change: ${id}`);
            }
        }
        else if (id.startsWith('system.group.') ||
            id.startsWith('system.user.') ||
            id.startsWith('system.credentials.') ||
            EOS_SECURITY_OBJECT_IDS.includes(id)) {
            this.scheduleEosSecurityGuard(`role/security object change: ${id}`);
        }
        // TODO Build in some threshold of messages
        socket?.objectChange(id, obj);
    };
    /**
     * Is called if a subscribed state was changed
     *
     * @param id state ID that changed
     * @param state the changed state value
     */
    onStateChange = (id, state) => {
        if (id === `system.adapter.${this.namespace}.plugins.sentry.enabled`) {
            webServer.resetIndexHtml();
        }
        socket?.stateChange(id, state);
    };
    onFileChange = (id, fileName, size) => {
        socket?.fileChange(id, fileName, size);
    };
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady = async () => {
        if (this.config.auth !== true) {
            this.log.warn('EOS security profile requires login; legacy auth=false is overridden at runtime.');
        }
        this.config.auth = true;
        if (this.ciSystem) {
            this.log.info('CI system detected: requests to hosts that are not running will be answered immediately with a timeout error');
        }
        const systemConfig = await this.getForeignObjectAsync('system.config');
        if (systemConfig) {
            systemConfig.native = systemConfig.native || {};
            if (this.config.language) {
                systemLanguage = this.config.language;
            }
            else if (systemConfig.common?.language) {
                systemLanguage = systemConfig.common.language;
            }
            adapter_core_1.I18n.init(__dirname, systemLanguage).catch(e => this.log.error(`Cannot init i18n: ${e}`));
            await ensureEosStableInitialAccounts(this);
            this.eosSessionSecurity = new eosSessionSecurity_1.EosSessionSecurity(this);
            this.eosLicenseService = new eosLicenseService_1.EosLicenseService(this, {
                resolveDirectory: () => (0, node_path_1.join)((0, adapter_core_1.getAbsoluteInstanceDataDir)(this), 'licensing'),
            });
            await this.eosLicenseService.start();
            if (!systemConfig.native.secret) {
                try {
                    this.secret = (0, node_crypto_1.randomBytes)(32).toString('hex');
                    await this.extendForeignObjectAsync('system.config', { native: { secret: this.secret } });
                    this.init();
                }
                catch {
                    this.log.error('EOS session secret initialization failed; web startup denied');
                }
            }
            else if (typeof systemConfig.native.secret === 'string' && systemConfig.native.secret.length >= 16) {
                this.secret = systemConfig.native.secret;
                this.init();
            }
            else {
                this.log.error('EOS session secret is invalid; web startup denied');
            }
        }
        else {
            this.log.error('Cannot find object system.config');
        }
    };
    /**
     * Some message was sent to this instance over the message box. Used by email, pushover, text2speech, ...
     * Using this method requires the "common.messagebox" property to be set to true in io-package.json
     *
     * @param obj the message object
     */
    onMessage = (obj) => {
        if (!obj) {
            return;
        }
        if (obj.command === 'eos.license.check') {
            if (obj.callback && this.eosLicenseService) {
                void this.eosLicenseService
                    .check(obj.from, obj.message)
                    .then(result => {
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, result, obj.callback);
                    }
                })
                    .catch(() => {
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { v: 1, valid: false, code: 'SERVICE_UNAVAILABLE' }, obj.callback);
                    }
                });
            }
            return;
        }
        if (obj.command === 'im') {
            // if not instance message
            socket.publishInstanceMessageAll(obj.from, obj.message.m, obj.message.s, obj.message.d);
        }
        else if (obj.command === 'checkFiles') {
            if (typeof obj.message === 'string') {
                if (obj.callback) {
                    try {
                        this.sendTo(obj.from, obj.command, { result: (0, node_fs_1.existsSync)(obj.message) }, obj.callback);
                    }
                    catch (e) {
                        this.sendTo(obj.from, obj.command, { error: e instanceof Error ? e.message : 'File check failed' }, obj.callback);
                    }
                }
                return;
            }
            else if (Array.isArray(obj.message)) {
                const result = {};
                for (let f = 0; f < obj.message.length; f++) {
                    try {
                        result[obj.message[f]] = (0, node_fs_1.existsSync)(obj.message[f]);
                    }
                    catch {
                        result[obj.message[f]] = false;
                    }
                }
                return obj.callback && this.sendTo(obj.from, obj.command, result, obj.callback);
            }
        }
        else if (obj.command === 'autocomplete') {
            // just for test
            return (obj.callback &&
                this.sendTo(obj.from, obj.command, [
                    { value: 1, label: 'first' },
                    { value: 2, label: 'second' },
                ], obj.callback));
        }
        else if (obj.command === 'selectSendTo') {
            this.log.info(`SelectSendTo: ${JSON.stringify(obj.message)}`);
            // just for test
            return (obj.callback &&
                this.sendTo(obj.from, obj.command, [
                    { label: 'Afghanistan', value: 'AF' },
                    { label: 'Åland Islands', value: 'AX' },
                    { label: 'Albania', value: 'AL' },
                ], obj.callback));
        }
        else if (obj.command === 'url') {
            this.log.info(`url: ${JSON.stringify(obj.message)}`);
            // just for test
            if (obj.callback) {
                this.sendTo(obj.from, obj.command, { openUrl: obj.message._origin, saveConfig: true }, obj.callback);
            }
            return;
        }
        else if (obj.command === 'admin:searchLogs') {
            void this.processLogSearch(obj).catch(() => this.log.warn('Log search failed'));
            return;
        }
        else if (obj.command.startsWith('admin:')) {
            return this.processNotificationsGui(obj);
        }
        else if (obj.command.startsWith('test:')) {
            // just for test
            this.log.info(`test: ${JSON.stringify(obj.message)}`);
            return;
        }
        else if (obj.command === 'checkDocker') {
            const dockerManager = new plugin_docker_1.DockerManager({
                logger: {
                    level: this.common?.loglevel || 'info',
                    silly: this.log.silly.bind(this.log),
                    debug: this.log.debug.bind(this.log),
                    info: this.log.info.bind(this.log),
                    warn: this.log.warn.bind(this.log),
                    error: this.log.error.bind(this.log),
                },
                namespace: this.namespace,
            });
            void dockerManager.getDockerDaemonInfo().then(result => {
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, result, obj.callback);
                }
                void dockerManager.destroy();
            });
            return;
        }
        else if (obj.command.startsWith('chat:')) {
            if (obj.callback) {
                this.sendTo(obj.from, obj.command, { error: 'EOS Assist ist in dieser Stable-Version vorübergehend deaktiviert.' }, obj.callback);
            }
            return;
        }
        else if (webServer?.processMessage(obj)) {
            return;
        }
        socket?.sendCommand(obj);
    };
    /**
     * Handle `admin:searchLogs` from the Log tab: search the log files of a host.
     *
     * The message holds the host - without it the one this instance runs on - and the filters of the tab:
     * `hours`, `level` (this one and the more severe ones), `source`, `text` and `maxRows`.
     *
     * @param obj the message object
     */
    async processLogSearch(obj) {
        const message = obj.message && typeof obj.message === 'object' ? obj.message : {};
        let response;
        /*
         * The log files of a host, read from its disk. They hold whatever any adapter ever logged -
         * tokens, passwords in a stack trace, the contents of a request - so this needs the right that
         * reading the log over the socket needs (`readLogs`: "other"."execute"). The message itself
         * names no user, so the identity comes from the GUI session that subscribed for pushed answers;
         * without one there is nobody to check, and the search is refused.
         */
        // Searching the files of another host can take longer than a socket callback lives, so the
        // answer is pushed if the Log tab asked for it. See `buildPushResponder` - building it releases
        // the callback, so it happens once for every way out of this function.
        const respond = this.buildPushResponder(obj);
        const session = this.getUiSession(obj);
        if (!session?.user) {
            respond({ error: 'The log search can only be used from a subscribed admin GUI session' });
            return;
        }
        if (!session.mayExecute) {
            respond({ error: 'No permission: searching the log files requires the "execute" right' });
            return;
        }
        if (this.activeLogSearches.has(session.user) || this.activeLogSearches.size >= 4) {
            respond({ error: 'A log search is already active; retry after it completes' });
            return;
        }
        this.activeLogSearches.add(session.user);
        try {
            const host = typeof message.host === 'string' && message.host
                ? message.host.replace(/^system\.host\./, '')
                : this.host;
            const filters = {
                hours: Number(message.hours),
                level: logSearch_1.LOG_LEVELS.includes(message.level) ? message.level : undefined,
                source: typeof message.source === 'string' ? message.source : undefined,
                text: typeof message.text === 'string' ? message.text : undefined,
                maxRows: Number(message.maxRows),
            };
            response =
                host === this.host
                    ? await (0, logSearch_1.searchLogFiles)({ files: this.getLocalLogFiles(), ...filters })
                    : await this.searchRemoteLogFiles(host, filters);
        }
        catch {
            response = { error: 'Log search failed or exceeded its resource limits' };
        }
        finally {
            this.activeLogSearches.delete(session.user);
        }
        respond(response);
    }
    /** The log files of the host this instance runs on, read from the disk */
    getLocalLogFiles() {
        if (!this.logLocation) {
            let dataDir;
            try {
                dataDir = (0, adapter_core_1.getAbsoluteDefaultDataDir)();
            }
            catch {
                dataDir = undefined;
            }
            this.logLocation = (0, logSearch_1.detectLogLocation)({ controllerDir: adapter_core_1.controllerDir, dataDir });
            this.log.debug(`Log files for the search: ${this.logLocation.directory}, ${this.logLocation.prefix}.<date>${this.logLocation.extension} (${this.logLocation.source})`);
        }
        return (0, logSearch_1.createLocalLogFiles)(this.logLocation);
    }
    /**
     * Search the log files of another host.
     *
     * A js-controller that knows the host command `searchLogs` searches its files itself and sends only the
     * matching entries. An older one - and one that answers the command with an error - sends every file with
     * `getLogFile`, as for the download of a log file, and admin searches them.
     *
     * @param host name of the host without `system.host.`
     * @param filters what to look for
     */
    async searchRemoteLogFiles(host, filters) {
        const id = `system.host.${host}`;
        const obj = await this.getForeignObjectAsync(id);
        if (obj?.type !== 'host') {
            throw new Error(`Unknown host ${host}`);
        }
        const alive = await this.getForeignStateAsync(`${id}.alive`);
        if (!alive?.val) {
            throw new Error(`Host ${host} is not running`);
        }
        const request = (command, message, timeout = LOG_SEARCH_HOST_TIMEOUT_MS) => new Promise((resolve, reject) => {
            // a host that does not know a command never answers
            const timer = this.setTimeout(() => reject(new Error(`Host ${host} did not answer "${command}"`)), timeout);
            this.sendToHost(id, command, message, answer => {
                if (timer) {
                    this.clearTimeout(timer);
                }
                resolve(answer);
            }, { timeout });
        });
        if (await this.isHostFeatureSupported(obj, 'CONTROLLER_SEARCH_LOGS', request)) {
            const answer = await request('searchLogs', filters);
            const result = (0, logSearch_1.validateLogSearchResult)(answer);
            if (result) {
                return result;
            }
            // The host knows the command but cannot do it, e.g. because it writes no log file at all.
            // Its files are read the way those of an older controller are read.
            this.log.debug(`Host ${host} could not search its log files (${isRecord(answer) && typeof answer.error === 'string' ? 'host reported an error' : 'invalid answer'}), reading them instead`);
        }
        return (0, logSearch_1.searchLogFiles)({ files: (0, logSearch_1.createRemoteLogFiles)(request), ...filters });
    }
    /**
     * Ask a host whether its js-controller supports a feature.
     *
     * Only a js-controller from 7.2.0 on answers this question, so an older one is not asked at all.
     *
     * @param obj object of the host
     * @param feature name of the feature
     * @param request sends a command to the host
     */
    async isHostFeatureSupported(obj, feature, request) {
        const version = semver.coerce(obj.common.installedVersion);
        if (!version || semver.lt(version, '7.2.0')) {
            return false;
        }
        try {
            const answer = (await request('checkFeatureSupported', feature, FEATURE_CHECK_TIMEOUT_MS));
            return answer?.result === true;
        }
        catch {
            return false;
        }
    }
    /**
     * A GUI page registers itself for pushed answers, and gets the secret of its session back.
     *
     * The subscription is the only moment at which this adapter can see *who* is on the other end: the
     * socket layer runs in this process and hands over the id of the connection, whose ACL it has
     * already calculated. User and rights are recorded here, and the page gets a secret to name the
     * session with - a later `admin:searchLogs` carries that secret instead of claiming a user itself.
     *
     * Only our own message type is accepted - anything else is some other UI asking for something we
     * do not serve.
     *
     * @param info client id and the subscribe message, as the messaging controller hands it over
     * @param info.clientId the id to address this client with later
     * @param info.message the subscribe message, carrying the type and the socket id of the page
     */
    onUiClientSubscribe(info) {
        const message = info.message?.message;
        if (message?.type !== UI_PUSH_MESSAGE_TYPE) {
            return { accepted: false, error: `Unknown subscription type "${message?.type || ''}"` };
        }
        const identity = this.getUiIdentity(message.sid);
        if (!identity ||
            info.message.from !== `system.adapter.${this.namespace}` ||
            info.message.user !== identity.user) {
            return { accepted: false, error: 'An active authenticated EOS session is required' };
        }
        const session = this.uiPushSessions.issue(info.clientId, identity, normalizeLoginTimeout(this.config.ttl));
        if (!session) {
            return { accepted: false, error: 'GUI subscription limit reached' };
        }
        return { accepted: true, session };
    }
    /**
     * A GUI page went away - drop every session that pointed at it.
     *
     * @param info the client the messaging controller is retiring
     * @param info.clientId the id that is going away
     */
    onUiClientUnsubscribe(info) {
        this.uiPushSessions.unsubscribe(info.clientId);
    }
    /**
     * The ACL the socket layer calculated for one open connection of this instance's web server.
     *
     * With authentication it belongs to the logged-in user, without it to the configured default user,
     * and in both cases a whitelist of the address has already been applied to it.
     *
     * @param sid the socket id, as the `clientSubscribe` message carries it
     */
    getUiIdentity(sid) {
        if (typeof sid !== 'string' || !sid || sid.length > 256 || !this.eosRoleCacheHealthy) {
            return undefined;
        }
        const sockets = socket?.getSocketsList();
        const clients = sockets ? (Array.isArray(sockets) ? sockets : Object.values(sockets)) : [];
        const client = clients.find(entry => entry.id === sid);
        const user = client?._acl?.user;
        if (!client ||
            !user ||
            !this.eosSessionSecurity?.isSocketAllowed(client) ||
            this.eosDisabledUsers.has(user) ||
            this.eosPasswordSetupRequired.has(user)) {
            return undefined;
        }
        const role = this.getEosCachedRole(user);
        return {
            user,
            socketId: sid,
            epoch: this.eosSessionSecurity.epoch,
            // EOS permits installer diagnostics, while host execution stays Service-only.
            mayExecute: role === 'installer' || (role === 'admin' && !!client._acl?.other?.execute),
        };
    }
    /**
     * The session a request names in `uiSession`, if it is one this adapter handed out.
     *
     * @param obj the incoming sendTo message
     */
    getUiSession(obj) {
        const token = obj.message?.uiSession;
        const entry = this.uiPushSessions.get(token, sid => this.getUiIdentity(sid));
        return entry && obj.from === `system.adapter.${this.namespace}` && obj.user === entry.user ? entry : undefined;
    }
    /**
     * Build the function that delivers the answer of one long request (`admin:searchLogs`).
     *
     * If the page registered for pushed answers and named itself in the message, the answer goes out as
     * an instance message and the socket callback is acknowledged right away - the request takes longer
     * than the 30 s the callback lives. Everything else - an older frontend, a script talking to us -
     * keeps the plain request/response behaviour.
     *
     * @param obj the incoming sendTo message
     */
    buildPushResponder(obj) {
        const session = typeof obj.message?.uiSession === 'string' ? obj.message.uiSession : '';
        const requestId = typeof obj.message?.requestId === 'string' && obj.message.requestId.length <= 128
            ? obj.message.requestId
            : '';
        const clientId = this.getUiSession(obj)?.clientId;
        if (!clientId || !requestId) {
            return response => {
                if (obj.callback && (!clientId || this.getUiSession(obj))) {
                    this.sendTo(obj.from, obj.command, response, obj.callback);
                }
            };
        }
        // Release the socket callback immediately - it has 30 s to live, the request has more.
        this.sendTo(obj.from, obj.command, { accepted: true, requestId }, obj.callback);
        let sent = false;
        return response => {
            if (sent || !this.getUiSession(obj)) {
                return;
            }
            sent = true;
            this.sendToUI({
                clientId,
                data: { type: UI_PUSH_MESSAGE_TYPE, requestId, ...response },
            }).catch(e => {
                // The tab was closed, or the subscription was dropped in the meantime.
                this.uiPushSessions.delete(session);
                this.log.warn(`Cannot deliver the answer of "${obj.command}" to the GUI: ${e instanceof Error ? e.message : String(e)}`);
            });
        };
    }
    processNotificationsGui(obj) {
        if (!obj.callback || !['admin:getNotificationSchema', 'admin:setPassword'].includes(obj.command)) {
            return;
        }
        const message = adapter_core_1.I18n.getTranslatedObject('EOS does not test or change operating-system passwords. Use an authorized operating-system administrator and the operating system maintenance tools. ioBroker account passwords are managed separately in EOS.');
        if (obj.command === 'admin:getNotificationSchema') {
            this.sendTo(obj.from, obj.command, {
                schema: { type: 'panel', items: { _info: { type: 'staticText', text: message, sm: 12 } } },
            }, obj.callback);
            return;
        }
        // This legacy RPC must never cross from an ioBroker role into an OS login/su process.
        // Reject for every caller, including administrators; no request credentials are inspected.
        this.sendTo(obj.from, obj.command, {
            error: 'EOS_OS_PASSWORD_MANAGEMENT_DISABLED',
            status: 410,
            command: { command: 'message', message, refresh: false },
        }, obj.callback);
    }
    /**
     * Is called when the adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback Callback after unloading
     */
    onUnload = (callback) => {
        this.eosLicenseService?.stop();
        this.eosSessionSecurity?.stop();
        this.uiPushSessions.clear();
        if (this.timerRepo) {
            clearTimeout(this.timerRepo);
            this.timerRepo = undefined;
        }
        if (this.timerNews) {
            clearTimeout(this.timerNews);
            this.timerNews = undefined;
        }
        if (this.ratingTimeout) {
            clearTimeout(this.ratingTimeout);
            this.ratingTimeout = undefined;
        }
        if (this.updaterTimeout) {
            clearTimeout(this.updaterTimeout);
            this.updaterTimeout = undefined;
        }
        if (this.eosSecurityDebounce) {
            clearTimeout(this.eosSecurityDebounce);
            this.eosSecurityDebounce = null;
        }
        if (this.eosSecurityTimer) {
            clearInterval(this.eosSecurityTimer);
            this.eosSecurityTimer = null;
        }
        try {
            this.log.info(`terminating http${this.config.secure ? 's' : ''} server on port ${this.config.port}`);
            socket?.close();
            webServer.close();
            callback();
        }
        catch {
            callback();
        }
    };
    onLog = (obj) => socket?.sendLog(obj);
    isLegacyAdminLockEnabled() {
        return this.config.eosLockLegacyAdmin !== false;
    }
    shouldHideLegacyAdminFromNonAdmins() {
        const config = this.config;
        return (this.config.eosHideLegacyAdminFromNonAdmins !== false &&
            config.eosHideLegacyAdminForNonAdmins !== false &&
            config.nexowattHideLegacyAdminForNonAdmins !== false);
    }
    shouldHideLegacyBackupFromNonAdmins() {
        const config = this.config;
        return (config.eosHideLegacyBackupFromNonAdmins !== false && config.nexowattHideLegacyBackupFromNonAdmins !== false);
    }
    shouldApplyAdminOnlyAclToProtectedAdapters() {
        // v37: Do not apply hard object ACLs to runtime/business adapters by default.
        // BackItUp and adapter-specific configuration pages can break when their adapter/instance
        // objects are restricted too aggressively. Delete/stop protection is enforced by EOS UI
        // policy and backend guards, while hard ACLs remain reserved for the legacy admin and
        // eos-admin itself.
        const config = this.config;
        return (config.eosStrictProtectedAdapterAcl === true && this.config.eosApplyAdminOnlyAclToProtectedAdapters === true);
    }
    getAdminOnlyGroup() {
        const config = this.config;
        const configuredGroups = normalizeAdminOnlyGroups([
            ...(config.eosAdminOnlyGroups || config.eosSecurityAdminGroups || []),
            ...(config.eosServiceGroups || []),
        ]);
        if (configuredGroups.length) {
            return configuredGroups[0];
        }
        return normalizeGroupId(this.config.eosAdminOnlyGroup) || DEFAULT_ADMIN_ONLY_GROUP;
    }
    getAdminOnlyAcl() {
        return {
            object: ADMIN_ONLY_OBJECT_ACL,
            owner: ADMIN_OWNER_USER,
            ownerGroup: this.getAdminOnlyGroup(),
        };
    }
    getEosConfiguredGroupIds(value, fallback) {
        const configured = normalizeAdminOnlyGroups(Array.isArray(value) ? value : []);
        return configured.length ? configured : fallback;
    }
    getEosRoleGroupIds(role) {
        if (role === 'service') {
            return this.getEosConfiguredGroupIds(this.config.eosServiceGroups, [EOS_SERVICE_GROUP]);
        }
        if (role === 'installer') {
            return this.getEosConfiguredGroupIds(this.config.eosInstallerGroups, [EOS_INSTALLER_GROUP]);
        }
        return this.getEosConfiguredGroupIds(this.config.eosEndUserGroups, [EOS_ENDUSER_GROUP]);
    }
    getEosRoleGroupAcl(role) {
        const full = { list: true, read: true, write: true, create: true, delete: true };
        if (role === 'service') {
            return {
                object: { ...full },
                state: { ...full },
                file: { ...full },
                users: { ...full },
                other: { execute: true, http: true, sendto: true },
            };
        }
        if (role === 'installer') {
            return {
                object: { ...full },
                state: { ...full },
                file: { ...full },
                users: { list: true, read: true, write: false, create: false, delete: false },
                other: { execute: false, http: true, sendto: true },
            };
        }
        return {
            object: { list: true, read: true, write: true, create: true, delete: true },
            state: { list: true, read: true, write: true, create: false, delete: false },
            file: { list: true, read: true, write: false, create: false, delete: false },
            users: { list: true, read: true, write: false, create: false, delete: false },
            other: { execute: false, http: true, sendto: true },
        };
    }
    getEosRoleGroupName(role) {
        if (role === 'service') {
            return { en: 'NexoWatt Admin / Service', de: 'NexoWatt Admin / Service', nl: 'NexoWatt Admin / Service' };
        }
        if (role === 'installer') {
            return {
                en: 'Installer / Commissioning',
                de: 'Installateur / Inbetriebnahme',
                nl: 'Installateur / inbedrijfstelling',
            };
        }
        return { en: 'End user / Smart Home', de: 'Endkunde / Smart Home', nl: 'Eindgebruiker / Smart Home' };
    }
    async ensureEosRoleGroup(id, role) {
        const existing = (await this.getForeignObjectAsync(id));
        const acl = this.getEosRoleGroupAcl(role);
        let group = existing;
        let changed = false;
        if (!group) {
            group = {
                _id: id,
                type: 'group',
                common: {
                    name: this.getEosRoleGroupName(role),
                    desc: this.getEosRoleGroupName(role),
                    members: [],
                    acl,
                },
                native: {},
            };
            changed = true;
        }
        group.common ||= {};
        group.common.members ||= [];
        if (!group.common.name) {
            group.common.name = this.getEosRoleGroupName(role);
            changed = true;
        }
        if (!group.common.desc) {
            group.common.desc = this.getEosRoleGroupName(role);
            changed = true;
        }
        if (JSON.stringify(group.common.acl || {}) !== JSON.stringify(acl)) {
            group.common.acl = acl;
            changed = true;
        }
        const native = (group.native ||= {});
        if (native.nexowattEosRole !== role || native.nexowattManagedRole !== true) {
            native.nexowattEosRole = role;
            native.nexowattManagedRole = true;
            changed = true;
        }
        if (changed) {
            await this.setForeignObjectAsync(id, group);
        }
        return changed;
    }
    async addUserToEosGroup(userId, groupId) {
        const user = await this.getForeignObjectAsync(userId);
        if (!user || user.type !== 'user') {
            return false;
        }
        const group = (await this.getForeignObjectAsync(groupId));
        if (!group?.common) {
            return false;
        }
        group.common.members ||= [];
        if (group.common.members.includes(userId)) {
            return false;
        }
        group.common.members.push(userId);
        group.common.members.sort();
        await this.setForeignObjectAsync(groupId, group);
        return true;
    }
    async ensureEosInstallerSmartHomeMembership() {
        // Installer is a strict superset of the end-user Smart Home role. Keeping installer users
        // in the end-user group lets ioBroker's single-ownerGroup ACL model grant room/function
        // writes without opening those objects for every authenticated account.
        const endUserGroup = this.getEosRoleGroupIds('enduser')[0] || EOS_ENDUSER_GROUP;
        for (const installerGroupId of this.getEosRoleGroupIds('installer')) {
            const installerGroup = (await this.getForeignObjectAsync(installerGroupId));
            for (const member of installerGroup?.common?.members || []) {
                await this.addUserToEosGroup(member, endUserGroup);
            }
        }
    }
    async ensureEosServiceAdministratorMembership() {
        const administrator = (await this.getForeignObjectAsync('system.group.administrator'));
        if (!administrator?.common) {
            return;
        }
        administrator.common.members ||= [];
        const native = (administrator.native ||= {});
        const previousManaged = new Set(Array.isArray(native.nexowattEosServiceMirroredMembers)
            ? native.nexowattEosServiceMirroredMembers.filter((entry) => typeof entry === 'string')
            : []);
        const currentManaged = new Set();
        for (const groupId of this.getEosRoleGroupIds('service')) {
            const group = (await this.getForeignObjectAsync(groupId));
            for (const member of group?.common?.members || []) {
                if (member !== 'system.user.admin') {
                    currentManaged.add(member);
                }
            }
        }
        let changed = false;
        for (const oldMember of previousManaged) {
            if (!currentManaged.has(oldMember)) {
                const index = administrator.common.members.indexOf(oldMember);
                if (index !== -1) {
                    administrator.common.members.splice(index, 1);
                    changed = true;
                }
            }
        }
        for (const member of currentManaged) {
            if (!administrator.common.members.includes(member)) {
                administrator.common.members.push(member);
                changed = true;
            }
        }
        const managedList = [...currentManaged].sort();
        if (JSON.stringify(native.nexowattEosServiceMirroredMembers || []) !== JSON.stringify(managedList)) {
            native.nexowattEosServiceMirroredMembers = managedList;
            changed = true;
        }
        if (changed) {
            administrator.common.members.sort();
            await this.setForeignObjectAsync('system.group.administrator', administrator);
        }
    }
    async ensureEosDefaultUser(userId, displayName) {
        let user = (await this.getForeignObjectAsync(userId));
        if (user) {
            return user;
        }
        user = {
            _id: userId,
            type: 'user',
            common: {
                name: displayName,
                enabled: false,
                password: '',
            },
            native: {
                nexowattEosAccount: {
                    passwordInitialized: true,
                    passwordSetupVersion: 1,
                    forcePasswordChange: false,
                    passwordlessFirstLoginAllowed: false,
                    provisionedBy: 'NexoWatt EOS',
                    provisionedAt: new Date().toISOString(),
                },
            },
        };
        await this.setForeignObjectAsync(userId, user);
        return user;
    }
    async prepareEosPasswordlessFirstLogin(userId) {
        if (this.config.eosRequireFirstLoginPassword === false || this.config.eosPasswordlessFirstLogin === false) {
            return;
        }
        let user = (await this.getForeignObjectAsync(userId));
        if (!user?.common || userId === 'system.user.admin') {
            return;
        }
        const native = (user.native ||= {});
        const account = (native.nexowattEosAccount ||= {});
        const initialized = account.passwordInitialized === true ||
            Number(account.passwordSetupVersion || account.passwordInitializationVersion || 0) >= 1;
        if (initialized && account.forcePasswordChange !== true) {
            return;
        }
        // Only a truly uninitialized account is auto-opened for passwordless first activation.
        // Existing accounts with a password require an explicit reset by Service/Installer.
        if (String(user.common.password || '') !== '' && account.passwordlessFirstLoginAllowed !== true) {
            return;
        }
        if (String(user.common.password || '') === '') {
            const bootstrapSecret = `${(0, node_crypto_1.randomBytes)(48).toString('base64url')}!aA1`;
            await this.setPasswordAsync(userId.replace(/^system\.user\./, ''), bootstrapSecret, {
                user: ADMIN_OWNER_USER,
            });
            user = (await this.getForeignObjectAsync(userId));
            if (!user) {
                return;
            }
        }
        const updatedNative = (user.native ||= {});
        const updatedAccount = (updatedNative.nexowattEosAccount ||= {});
        let changed = false;
        for (const [key, value] of Object.entries({
            passwordInitialized: false,
            passwordSetupVersion: 0,
            passwordInitializationVersion: 0,
            forcePasswordChange: true,
            passwordlessFirstLoginAllowed: true,
        })) {
            if (updatedAccount[key] !== value) {
                updatedAccount[key] = value;
                changed = true;
            }
        }
        // Set the audit timestamp only once. Rewriting it on every security-guard pass would trigger
        // another objectChange and create an endless role/security reconciliation loop.
        if (!updatedAccount.passwordlessPreparedAt) {
            updatedAccount.passwordlessPreparedAt = new Date().toISOString();
            changed = true;
        }
        if (changed) {
            await this.setForeignObjectAsync(userId, user);
        }
    }
    async ensureEosDefaultRoleUsers() {
        if (this.config.eosAutoAssignDefaultRoleUsers === false) {
            return;
        }
        // Role accounts remain disabled until an authorized administrator provisions a unique password.
        await this.ensureEosDefaultUser('system.user.installer', 'Installer');
        await this.ensureEosDefaultUser('system.user.guest', 'Gast / Endkunde');
        const installerGroup = this.getEosRoleGroupIds('installer')[0] || EOS_INSTALLER_GROUP;
        const endUserGroup = this.getEosRoleGroupIds('enduser')[0] || EOS_ENDUSER_GROUP;
        const installerUsers = ['system.user.installer', 'system.user.installateur'];
        const endUsers = ['system.user.guest', 'system.user.user', 'system.user.endkunde', 'system.user.kunde'];
        for (const userId of installerUsers) {
            await this.addUserToEosGroup(userId, installerGroup);
        }
        for (const userId of endUsers) {
            await this.addUserToEosGroup(userId, endUserGroup);
        }
    }
    async refreshEosRoleCache() {
        this.eosRoleCacheHealthy = false;
        const sessionEpoch = this.eosSessionSecurity?.epoch;
        const nextDisabled = new Set();
        const nextPending = new Set();
        const next = new Map();
        next.set('system.user.admin', 'admin');
        const priorities = { enduser: 1, installer: 2, admin: 3 };
        const assign = (userId, role) => {
            const current = next.get(userId);
            if (!current || priorities[role] > priorities[current]) {
                next.set(userId, role);
            }
        };
        for (const [roleName, groupIds] of [
            ['admin', this.getEosRoleGroupIds('service')],
            ['installer', this.getEosRoleGroupIds('installer')],
            ['enduser', this.getEosRoleGroupIds('enduser')],
            ['admin', ['system.group.administrator']],
        ]) {
            for (const groupId of groupIds) {
                const group = (await this.getForeignObjectAsync(groupId));
                for (const member of group?.common?.members || []) {
                    assign(member, roleName);
                }
            }
        }
        for (const userId of next.keys()) {
            const user = (await this.getForeignObjectAsync(userId));
            if (!user || user.type !== 'user' || user.common?.enabled === false) {
                nextDisabled.add(userId);
            }
            const native = user?.native || {};
            if (native.nexowattEosAccount?.forcePasswordChange === true ||
                native.nexowattPasswordChangeRequired === true ||
                native.eosPasswordChangeRequired === true) {
                nextPending.add(userId);
            }
        }
        // A concurrent security event invalidates the entire in-flight authorization snapshot.
        if (sessionEpoch !== this.eosSessionSecurity?.epoch) {
            return;
        }
        // Commit only after every async read succeeded; no partial authorization snapshot.
        this.eosRoleCache.clear();
        this.eosDisabledUsers.clear();
        this.eosPasswordSetupRequired.clear();
        for (const [userId, role] of next.entries()) {
            this.eosRoleCache.set(userId, role);
        }
        for (const userId of nextDisabled) {
            this.eosDisabledUsers.add(userId);
        }
        for (const userId of nextPending) {
            this.eosPasswordSetupRequired.add(userId);
        }
        this.eosRoleCacheHealthy = true;
    }
    getEosCachedRole(userId) {
        if (userId === 'system.user.admin') {
            return 'admin';
        }
        // Missing or not-yet-resolved identities always fall back to the least privileged role.
        // The underlying socket ACL check still applies afterwards, but this prevents a transient
        // authentication gap from ever selecting the unrestricted EOS policy branch.
        if (!userId) {
            return 'enduser';
        }
        return this.eosRoleCache.get(userId) || 'enduser';
    }
    installEosSocketCommandGuard(socketAdmin) {
        function isEosSocketCommands(value) {
            return (!!value &&
                typeof value === 'object' &&
                '_checkPermissions' in value &&
                typeof value._checkPermissions === 'function');
        }
        // socket-classes exposes the command dispatcher at runtime. A changed API must stop startup,
        // because continuing without this authorization guard would weaken the EOS role boundary.
        const commands = Reflect.get(socketAdmin, 'commands');
        if (!isEosSocketCommands(commands)) {
            throw new Error('EOS_SOCKET_PERMISSION_API_UNAVAILABLE');
        }
        if (commands._nexowattEosGuardInstalled) {
            return;
        }
        const original = commands._checkPermissions.bind(commands);
        const deny = (socketClient, command, callback, reason) => {
            this.log.warn(`EOS role guard denied ${command} for ${socketClient?._acl?.user || 'unknown'} (${reason})`);
            if (typeof callback === 'function') {
                callback(ERROR_PERMISSION);
            }
            else {
                socketClient?.emit?.(ERROR_PERMISSION, { command, reason: 'eosRolePolicy' });
            }
            return false;
        };
        commands._checkPermissions = (socketClient, command, callback, ...args) => {
            const userId = socketClient?._acl?.user;
            const role = this.getEosCachedRole(userId);
            if (!this.eosSessionSecurity?.isSocketAllowed(socketClient) ||
                !this.eosRoleCacheHealthy ||
                !userId ||
                this.eosDisabledUsers.has(userId) ||
                this.eosPasswordSetupRequired.has(userId)) {
                return deny(socketClient, command, callback, 'account disabled or password change required');
            }
            if (role === 'admin') {
                const allowed = original(socketClient, command, callback, ...args);
                const target = typeof args[0] === 'string' ? args[0] : '';
                if (allowed &&
                    (['changePassword', 'addUser', 'delUser', 'addGroup', 'delGroup'].includes(command) ||
                        (['setObject', 'extendObject', 'delObject'].includes(command) &&
                            /^system\.(?:user|group)\./.test(target)))) {
                    // Close cached socket ACLs before the authorized asynchronous credential write.
                    this.eosSessionSecurity?.revoke();
                    this.uiPushSessions.clear();
                    webServer?.invalidateProxySessions();
                }
                return allowed;
            }
            if (command === 'cmdExec' || command === 'sendToHost') {
                return deny(socketClient, command, callback, 'raw command execution is Service-only');
            }
            if (role === 'installer' && command === 'readLogs') {
                return true;
            }
            if (role === 'enduser' && ['readLogs', 'sendToHost'].includes(command)) {
                return deny(socketClient, command, callback, 'technical diagnostics are installer/service-only');
            }
            if (command === 'changePassword') {
                // Initial password activation has a separate, tightly scoped backend endpoint.
                // The normal Admin socket password editor remains Service/Admin-only.
                return deny(socketClient, command, callback, 'password administration is Service-only');
            }
            if (['addUser', 'delUser', 'addGroup', 'delGroup'].includes(command)) {
                return deny(socketClient, command, callback, 'account administration is Service-only');
            }
            const objectId = typeof args[0] === 'string' ? args[0] : '';
            if (['setObject', 'extendObject', 'delObject'].includes(command)) {
                if (/^system\.(?:config|repositories|certificates|licenses|credentials\.|user\.|group\.|host\.)/.test(objectId)) {
                    return deny(socketClient, command, callback, 'sensitive system objects are Service-only');
                }
                if (/^system\.adapter\.(?:admin|eos-admin|backitup|xterm)(?:\.|$)/.test(objectId)) {
                    return deny(socketClient, command, callback, 'internal Service reserve is Admin/Service-only');
                }
                const adapterObject = objectId.match(/^system\.adapter\.([^.]+)/)?.[1];
                if (command === 'delObject' &&
                    adapterObject &&
                    this.getProtectedAdapterNames().includes(adapterObject)) {
                    return deny(socketClient, command, callback, 'protected EOS system module');
                }
                if (role === 'enduser' && !/^enum\.(?:rooms|functions)(?:\.|$)/.test(objectId)) {
                    return deny(socketClient, command, callback, 'end users may only maintain Smart Home assignments');
                }
            }
            if (['setState', 'delState', 'createState'].includes(command)) {
                if (role === 'enduser') {
                    return deny(socketClient, command, callback, 'end-user datapoints are read-only in EOS Admin');
                }
                if (objectId === `${this.namespace}.info.uiTabsVisible`) {
                    return deny(socketClient, command, callback, 'navigation layout is Service-only');
                }
                if (/^(?:admin|backitup|xterm)\.\d+(?:\.|$)/.test(objectId)) {
                    return deny(socketClient, command, callback, 'internal Service reserve is Admin/Service-only');
                }
            }
            return original(socketClient, command, callback, ...args);
        };
        commands._nexowattEosGuardInstalled = true;
    }
    async ensureEosRoleModel() {
        for (const role of ['service', 'installer', 'enduser']) {
            for (const groupId of this.getEosRoleGroupIds(role)) {
                await this.ensureEosRoleGroup(groupId, role);
            }
        }
        await this.ensureEosDefaultRoleUsers();
        await this.ensureEosInstallerSmartHomeMembership();
        // NexoWatt Service is intentionally equivalent to administrator/service. Synchronising its
        // members into the platform administrator group keeps old adapters and legacy permission
        // checks compatible while the EOS UI still uses its own role model.
        await this.ensureEosServiceAdministratorMembership();
        await this.refreshEosRoleCache();
    }
    async ensureEosRoleReadableAcl(id) {
        const obj = (await this.getForeignObjectAsync(id));
        if (!obj) {
            return false;
        }
        const native = (obj.native ||= {});
        let changed = false;
        if (native._nexowattEosRoleReadableAclManaged !== true) {
            native._nexowattEosRoleReadableAclManaged = true;
            changed = true;
        }
        const acl = (obj.acl ||= { owner: ADMIN_OWNER_USER, ownerGroup: 'system.group.administrator', object: 0 });
        if (acl.owner !== ADMIN_OWNER_USER) {
            acl.owner = ADMIN_OWNER_USER;
            changed = true;
        }
        if (acl.ownerGroup !== 'system.group.administrator') {
            acl.ownerGroup = 'system.group.administrator';
            changed = true;
        }
        if (acl.object !== EOS_ROLE_READABLE_OBJECT_ACL) {
            acl.object = EOS_ROLE_READABLE_OBJECT_ACL;
            changed = true;
        }
        if (changed) {
            await this.setForeignObjectAsync(id, obj);
        }
        return changed;
    }
    async ensureEosSystemObjectAccess() {
        // Read access is required by the EOS shell and by the adapter/instance views. Installer
        // changes to the safe subset are performed by the guarded backend endpoint, never by
        // granting direct write access to system.config.
        for (const id of EOS_ROLE_READABLE_SYSTEM_OBJECT_IDS) {
            await this.ensureEosRoleReadableAcl(id);
        }
        for (const id of EOS_ADMIN_ONLY_SYSTEM_OBJECT_IDS) {
            await this.ensureObjectAdminOnlyAcl(id);
        }
        try {
            const credentials = await this.getObjectListAsync({
                startkey: 'system.credentials.',
                endkey: 'system.credentials.\u9999',
            });
            for (const row of credentials.rows || []) {
                if (row.id?.startsWith('system.credentials.')) {
                    await this.ensureObjectAdminOnlyAcl(row.id);
                }
            }
        }
        catch (e) {
            this.log.debug(`Cannot scan credential objects for EOS ACL guard: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    async ensureEosSmartHomeEnumAccess() {
        try {
            const enums = await this.getObjectListAsync({ startkey: 'enum.', endkey: 'enum.\u9999' });
            for (const row of enums.rows || []) {
                const smartHomeEnum = row.id === 'enum.rooms' ||
                    row.id === 'enum.functions' ||
                    row.id?.startsWith('enum.rooms.') ||
                    row.id?.startsWith('enum.functions.');
                if (!smartHomeEnum) {
                    continue;
                }
                const obj = (await this.getForeignObjectAsync(row.id));
                if (!obj) {
                    continue;
                }
                const acl = (obj.acl ||= {
                    owner: ADMIN_OWNER_USER,
                    ownerGroup: 'system.group.administrator',
                    object: 0,
                });
                let changed = false;
                if (acl.owner !== ADMIN_OWNER_USER) {
                    acl.owner = ADMIN_OWNER_USER;
                    changed = true;
                }
                if (acl.ownerGroup !== this.getEosRoleGroupIds('enduser')[0]) {
                    acl.ownerGroup = this.getEosRoleGroupIds('enduser')[0] || EOS_ENDUSER_GROUP;
                    changed = true;
                }
                // Rooms/functions are an explicitly shared Smart Home surface: administrators,
                // installers and EOS end users may read/write them, while command-level group ACLs
                // still prevent unrelated accounts from using write operations.
                if (acl.object !== 0x666) {
                    acl.object = 0x666;
                    changed = true;
                }
                if (changed) {
                    await this.setForeignObjectAsync(row.id, obj);
                }
            }
        }
        catch (e) {
            this.log.debug(`Cannot prepare Smart Home enum ACLs: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    async ensureObjectAdminOnlyAcl(id) {
        const obj = (await this.getForeignObjectAsync(id));
        if (!obj) {
            return false;
        }
        const native = (obj.native ||= {});
        let changed = false;
        if (native._nexowattEosAclManaged !== true) {
            native._nexowattEosAclManaged = true;
            native._nexowattEosAclPrevious = obj.acl ? JSON.stringify(obj.acl) : null;
            changed = true;
        }
        const targetAcl = this.getAdminOnlyAcl();
        const acl = (obj.acl ||= { owner: ADMIN_OWNER_USER, ownerGroup: 'system.group.administrator', object: 0 });
        if (acl.owner !== targetAcl.owner) {
            acl.owner = targetAcl.owner;
            changed = true;
        }
        if (acl.ownerGroup !== targetAcl.ownerGroup) {
            acl.ownerGroup = targetAcl.ownerGroup;
            changed = true;
        }
        if (acl.object !== targetAcl.object) {
            acl.object = targetAcl.object;
            changed = true;
        }
        if (changed) {
            await this.setForeignObjectAsync(id, obj);
        }
        return changed;
    }
    async restoreObjectAclManagedByEos(id) {
        const obj = (await this.getForeignObjectAsync(id));
        const native = obj?.native;
        if (!obj || !native || native._nexowattEosAclManaged !== true) {
            return false;
        }
        const targetAcl = this.getAdminOnlyAcl();
        const currentAcl = obj.acl;
        const stillManaged = !!currentAcl &&
            currentAcl.owner === targetAcl.owner &&
            currentAcl.ownerGroup === targetAcl.ownerGroup &&
            currentAcl.object === targetAcl.object;
        const previous = native._nexowattEosAclPrevious;
        if (stillManaged) {
            if (typeof previous === 'string' && previous) {
                try {
                    obj.acl = JSON.parse(previous);
                }
                catch {
                    delete obj.acl;
                }
            }
            else {
                delete obj.acl;
            }
        }
        delete native._nexowattEosAclManaged;
        delete native._nexowattEosAclPrevious;
        await this.setForeignObjectAsync(id, obj);
        return true;
    }
    getLegacyAdminAclObjectIds() {
        return ['system.adapter.admin', LEGACY_ADMIN_INSTANCE_ID];
    }
    async ensureLegacyAdminVisibleOnlyToAdmins() {
        let changed = false;
        if (!this.shouldHideLegacyAdminFromNonAdmins()) {
            for (const id of this.getLegacyAdminAclObjectIds()) {
                changed = (await this.restoreObjectAclManagedByEos(id)) || changed;
            }
            if (changed) {
                this.log.info('EOS ACL guard restored legacy admin visibility because the restriction is disabled');
            }
            return;
        }
        for (const id of this.getLegacyAdminAclObjectIds()) {
            changed = (await this.ensureObjectAdminOnlyAcl(id)) || changed;
        }
        if (changed) {
            this.log.info(`EOS ACL guard restricted legacy admin visibility to ${this.getAdminOnlyGroup()}`);
        }
    }
    async getLegacyBackupAclObjectIds() {
        const ids = new Set([`system.adapter.${LEGACY_BACKUP_ADAPTER_NAME}`]);
        try {
            const rows = await this.getObjectListAsync({
                startkey: `system.adapter.${LEGACY_BACKUP_ADAPTER_NAME}.`,
                endkey: `system.adapter.${LEGACY_BACKUP_ADAPTER_NAME}.\u9999`,
            });
            for (const row of rows.rows || []) {
                if (new RegExp(`^system\\.adapter\\.${LEGACY_BACKUP_ADAPTER_NAME}\\.\\d+$`).test(row.id || '')) {
                    ids.add(row.id);
                }
            }
        }
        catch (e) {
            this.log.debug(`Cannot scan internal backup instances for EOS visibility guard: ${e instanceof Error ? e.message : String(e)}`);
        }
        return [...ids];
    }
    async ensureLegacyBackupVisibleOnlyToAdmins() {
        let changed = false;
        const ids = await this.getLegacyBackupAclObjectIds();
        if (!this.shouldHideLegacyBackupFromNonAdmins()) {
            for (const id of ids) {
                changed = (await this.restoreObjectAclManagedByEos(id)) || changed;
            }
            if (changed) {
                this.log.info('EOS ACL guard restored internal backup visibility because the restriction is disabled');
            }
            return;
        }
        for (const id of ids) {
            changed = (await this.ensureObjectAdminOnlyAcl(id)) || changed;
        }
        if (changed) {
            this.log.info(`EOS ACL guard restricted internal ${LEGACY_BACKUP_ADAPTER_NAME} reserve to ${this.getAdminOnlyGroup()}`);
        }
    }
    getLegacyAdminLockPort() {
        const configured = Number(this.config.eosLegacyAdminLockPort);
        if (!Number.isInteger(configured) || configured < 1 || configured > 65_535) {
            return DEFAULT_LEGACY_ADMIN_LOCK_PORT;
        }
        return configured;
    }
    getLegacyAdminLockBind() {
        const configured = typeof this.config.eosLegacyAdminLockBind === 'string' ? this.config.eosLegacyAdminLockBind.trim() : '';
        return configured || DEFAULT_LEGACY_ADMIN_LOCK_BIND;
    }
    getProtectedAdapterNames() {
        // v47: delete protection is intentionally limited to the fixed EOS core list.
        // Older installations may have stored additional entries in eosProtectedAdapters;
        // those must not make ordinary runtime adapters undeletable in Dienste/Module.
        const result = new Set([LEGACY_ADMIN_ADAPTER_NAME, ...CORE_PROTECTED_ADAPTER_NAMES]);
        return [...result].sort();
    }
    parseAdapterObjectId(id) {
        const raw = String(id || '')
            .replace(/^system\.adapter\./, '')
            .trim()
            .toLowerCase();
        const match = raw.match(/^([a-z0-9_-]+)(?:\.(\d+))?$/i);
        if (!match) {
            return { adapter: raw.replace(/\.\d+$/, '') };
        }
        return { adapter: match[1], instance: match[2] };
    }
    isProtectedDeleteObjectId(id, protectedAdapters = new Set(this.getProtectedAdapterNames())) {
        const { adapter, instance } = this.parseAdapterObjectId(id);
        if (!adapter || !protectedAdapters.has(adapter)) {
            return false;
        }
        // v58: Only the primary Admin/EOS Admin instance is locked. Additional
        // eos-admin/admin test instances such as eos-admin.1 must remain deletable.
        // The package adapter object itself (without instance number) stays protected.
        if (adapter === EOS_ADMIN_ADAPTER_NAME || adapter === LEGACY_ADMIN_ADAPTER_NAME) {
            return instance === undefined || instance === '0';
        }
        return true;
    }
    scheduleEosSecurityGuard(reason) {
        if (this.eosSecurityDebounce) {
            clearTimeout(this.eosSecurityDebounce);
        }
        this.eosSecurityDebounce = setTimeout(() => {
            this.eosSecurityDebounce = null;
            void this.enforceEosSecurity(reason);
        }, 750);
    }
    async ensureObjectProtectionPolicy(id, options) {
        const obj = (await this.getForeignObjectAsync(id));
        if (!obj?.common) {
            return false;
        }
        let changed = false;
        obj.common = obj.common || {};
        // v29: keep adapters updateable. Do not set common.dontDelete here.
        // Protected business adapters are protected by administrator-only ACLs and EOS UI policy.
        // Older builds set dontDelete on eos-admin; remove the stale flag so upgrades can run.
        if (obj.common.dontDelete === true) {
            delete obj.common.dontDelete;
            changed = true;
        }
        // Keep updates possible. nondeletable=true blocks adapter updates in ioBroker.
        if (clearLegacyNondeletable(obj.common)) {
            changed = true;
        }
        const targetAcl = this.getAdminOnlyAcl();
        if (options.adminOnlyAcl) {
            const acl = (obj.acl ||= { owner: ADMIN_OWNER_USER, ownerGroup: 'system.group.administrator', object: 0 });
            if (acl.owner !== targetAcl.owner) {
                acl.owner = targetAcl.owner;
                changed = true;
            }
            if (acl.ownerGroup !== targetAcl.ownerGroup) {
                acl.ownerGroup = targetAcl.ownerGroup;
                changed = true;
            }
            if (acl.object !== targetAcl.object) {
                acl.object = targetAcl.object;
                changed = true;
            }
        }
        else if (obj.acl &&
            obj.acl.owner === targetAcl.owner &&
            obj.acl.ownerGroup === targetAcl.ownerGroup &&
            obj.acl.object === targetAcl.object) {
            // v37 repair: remove stale EOS admin-only ACLs from runtime adapters such as
            // BackItUp. Those ACLs can disturb adapter internals and adapter-owned config UIs.
            delete obj.acl;
            changed = true;
        }
        if (changed) {
            await this.setForeignObjectAsync(id, obj);
        }
        return changed;
    }
    async clearStaleAdapterDeleteLocks(id, protectedAdapters) {
        const obj = (await this.getForeignObjectAsync(id));
        if (!obj?.common) {
            return false;
        }
        const isProtected = this.isProtectedDeleteObjectId(id, protectedAdapters);
        // v47/v58: never "repair" fixed protected core adapter objects here. On some systems
        // ioBroker or another guard restores their delete flags immediately, which created
        // a repair/reapply loop and filled the log every debounce cycle. Additional EOS Admin
        // instances such as eos-admin.1 are not protected and are cleaned below.
        if (isProtected) {
            return false;
        }
        let changed = false;
        obj.common = obj.common || {};
        // v45/v47: old builds could leave common.dontDelete/common.nondeletable on normal
        // adapter or instance objects. Those flags block ioBroker del even if the UI allows it.
        if (obj.common.dontDelete === true) {
            delete obj.common.dontDelete;
            changed = true;
        }
        if (clearLegacyNondeletable(obj.common)) {
            changed = true;
        }
        // Also undo stale admin-only ACLs for adapters that are no longer protected by the
        // hard core list. UI protection remains for real core modules.
        if (!isProtected && obj.acl) {
            const targetAcl = this.getAdminOnlyAcl();
            const acl = obj.acl;
            if (acl.owner === targetAcl.owner &&
                acl.ownerGroup === targetAcl.ownerGroup &&
                acl.object === targetAcl.object) {
                delete obj.acl;
                changed = true;
            }
        }
        if (changed) {
            await this.setForeignObjectAsync(id, obj);
        }
        return changed;
    }
    async repairStaleAdapterDeleteLocks() {
        const protectedAdapters = new Set(this.getProtectedAdapterNames());
        const ids = new Set();
        const collect = async (type) => {
            try {
                const view = await this.getObjectViewAsync('system', type, {
                    startkey: 'system.adapter.',
                    endkey: 'system.adapter.香',
                });
                for (const row of view.rows || []) {
                    if (row.id) {
                        ids.add(row.id);
                    }
                }
            }
            catch (e) {
                this.log.warn(`Cannot scan ${type} objects for stale delete locks: ${e instanceof Error ? e.message : String(e)}`);
            }
        };
        await collect('adapter');
        await collect('instance');
        let changed = 0;
        for (const id of ids) {
            if (await this.clearStaleAdapterDeleteLocks(id, protectedAdapters)) {
                changed++;
            }
        }
        if (changed) {
            this.log.debug(`EOS delete guard repaired stale delete locks on ${changed} adapter/instance object(s)`);
        }
    }
    async ensureProtectedAdapter(adapter) {
        if (!adapter || adapter === LEGACY_ADMIN_ADAPTER_NAME) {
            return;
        }
        const isEosAdmin = adapter === EOS_ADMIN_ADAPTER_NAME;
        // v87 role access: EOS Admin itself must stay readable for authenticated installer and
        // end-user sessions. Deletion is still blocked by EOS policy, but an administrator-only
        // object ACL prevents the socket from reading its own instance and causes permissionError.
        const adminOnlyAcl = !isEosAdmin && this.shouldApplyAdminOnlyAclToProtectedAdapters() && adapter !== 'backitup';
        // v37 BackItUp/runtime-adapter compatibility:
        // default EOS protection is UI/role based. Do not rewrite common/ACL of runtime adapters
        // such as backitup unless the admin explicitly enables ACL protection for protected adapters.
        // EOS Admin is reconciled even without strict ACL mode so stale v86 admin-only ACLs are restored.
        if (!isEosAdmin && !adminOnlyAcl) {
            return;
        }
        const reconcileObject = async (id, protectWithAdminAcl) => {
            let objectChanged = false;
            if (isEosAdmin) {
                objectChanged = await this.restoreObjectAclManagedByEos(id);
                objectChanged = (await this.ensureEosRoleReadableAcl(id)) || objectChanged;
            }
            objectChanged =
                (await this.ensureObjectProtectionPolicy(id, {
                    keepDontDelete: false,
                    adminOnlyAcl: protectWithAdminAcl,
                })) || objectChanged;
            return objectChanged;
        };
        let changed = await reconcileObject(`system.adapter.${adapter}`, adminOnlyAcl);
        try {
            const instances = await this.getObjectViewAsync('system', 'instance', {
                startkey: `system.adapter.${adapter}.`,
                endkey: `system.adapter.${adapter}.香`,
            });
            for (const row of instances.rows) {
                const protectThisInstance = this.isProtectedDeleteObjectId(row.id, new Set(this.getProtectedAdapterNames()));
                changed = (await reconcileObject(row.id, protectThisInstance && adminOnlyAcl)) || changed;
            }
        }
        catch (e) {
            this.log.warn(`Cannot protect instances of adapter "${adapter}": ${e instanceof Error ? e.message : String(e)}`);
        }
        if (changed) {
            this.log.debug(`EOS ACL/UI delete guard applied to adapter "${adapter}"`);
        }
    }
    async ensureLegacyAdminLocked() {
        if (!this.isLegacyAdminLockEnabled()) {
            return;
        }
        const obj = (await this.getForeignObjectAsync(LEGACY_ADMIN_INSTANCE_ID));
        if (!obj?.common) {
            return;
        }
        const targetPort = this.getLegacyAdminLockPort();
        const targetBind = this.getLegacyAdminLockBind();
        let changed = false;
        const native = (obj.native ||= {});
        if (obj.common.enabled !== false) {
            obj.common.enabled = false;
            changed = true;
        }
        if (native.port !== targetPort) {
            native.port = targetPort;
            changed = true;
        }
        if (native.bind !== targetBind) {
            native.bind = targetBind;
            changed = true;
        }
        if (clearLegacyNondeletable(obj.common)) {
            changed = true;
        }
        if (changed) {
            await this.setForeignObjectAsync(LEGACY_ADMIN_INSTANCE_ID, obj);
            this.log.warn(`EOS security guard disabled legacy admin.0 and moved it to ${targetBind}:${targetPort}. Disable "Legacy Admin lock" in EOS Admin settings before intentionally starting the old admin.`);
        }
    }
    async enforceEosSecurity(reason = 'periodic') {
        if (this.eosSecurityRunning) {
            return;
        }
        this.eosSecurityRunning = true;
        try {
            await this.ensureEosRoleModel();
            await this.ensureEosSystemObjectAccess();
            await this.ensureEosSmartHomeEnumAccess();
            await this.ensureLegacyAdminLocked();
            await this.ensureLegacyAdminVisibleOnlyToAdmins();
            await this.ensureLegacyBackupVisibleOnlyToAdmins();
            if (!this.eosDeleteLockRepairFinished) {
                await this.repairStaleAdapterDeleteLocks();
                this.eosDeleteLockRepairFinished = true;
            }
            if (this.config.eosProtectAdapterDeletion !== false) {
                for (const adapter of this.getProtectedAdapterNames()) {
                    await this.ensureProtectedAdapter(adapter);
                }
            }
        }
        catch (e) {
            this.log.warn(`Cannot apply EOS security guard (${reason}): ${e instanceof Error ? e.message : String(e)}`);
        }
        finally {
            this.eosSecurityRunning = false;
        }
    }
    startEosSecurityGuard() {
        for (const adapter of this.getProtectedAdapterNames()) {
            this.subscribeForeignObjects(`system.adapter.${adapter}`);
            this.subscribeForeignObjects(`system.adapter.${adapter}.*`);
        }
        this.subscribeForeignObjects('system.group.*');
        this.subscribeForeignObjects('system.user.*');
        this.subscribeForeignObjects('system.credentials.*');
        this.subscribeForeignObjects('system.config');
        this.subscribeForeignObjects('system.repositories');
        this.subscribeForeignObjects('system.certificates');
        this.subscribeForeignObjects('system.licenses');
        this.subscribeForeignObjects('enum.rooms.*');
        this.subscribeForeignObjects('enum.functions.*');
        void this.enforceEosSecurity('startup');
        if (!this.eosSecurityTimer) {
            this.eosSecurityTimer = setInterval(() => {
                void this.enforceEosSecurity('periodic');
            }, 300_000);
        }
    }
    async createUpdateInfo() {
        const promises = [];
        // create a connected object and state
        const updatesNumberObj = objects[`${this.namespace}.info.updatesNumber`];
        if (!updatesNumberObj || !updatesNumberObj.common || updatesNumberObj.common.type !== 'number') {
            const obj = {
                _id: 'info.updatesNumber',
                type: 'state',
                common: {
                    role: 'state',
                    name: {
                        en: 'Number of adapters to update',
                        de: 'Anzahl der zu aktualisierenden Adapter',
                        ru: 'Количество адаптеров для обновления',
                        pt: 'Número de adaptadores para atualizar',
                        nl: 'Aantal adapters om te updaten',
                        fr: "Nombre d'adaptateurs à mettre à jour",
                        it: 'Numero di adattatori da aggiornare',
                        es: 'Número de adaptadores para actualizar',
                        pl: 'Liczba adapterów do aktualizacji',
                        uk: 'Кількість адаптерів для оновлення',
                        'zh-cn': '要更新的适配器数量',
                    },
                    type: 'number',
                    read: true,
                    write: false,
                    def: 0,
                },
                native: {},
            };
            await this.setObject(obj._id, obj);
        }
        const updatesListObj = objects[`${this.namespace}.info.updatesList`];
        if (!updatesListObj || !updatesListObj.common || updatesListObj.common.type !== 'string') {
            const obj = {
                _id: 'info.updatesList',
                type: 'state',
                common: {
                    role: 'indicator.updates',
                    name: {
                        en: 'List of adapters to update',
                        de: 'Liste der zu aktualisierenden Adapter',
                        ru: 'Список адаптеров для обновления',
                        pt: 'Lista de adaptadores para atualizar',
                        nl: 'Lijst met adapters die moeten worden bijgewerkt',
                        fr: 'Liste des adaptateurs à mettre à jour',
                        it: 'Elenco degli adattatori da aggiornare',
                        es: 'Lista de adaptadores para actualizar',
                        pl: 'Lista adapterów do aktualizacji',
                        uk: 'Список адаптерів для оновлення',
                        'zh-cn': '要更新的适配器列表',
                    },
                    type: 'string',
                    read: true,
                    write: false,
                    def: '',
                },
                native: {},
            };
            await this.setObject(obj._id, obj);
        }
        const newUpdatesObj = objects[`${this.namespace}.info.newUpdates`];
        if (!newUpdatesObj || !newUpdatesObj.common || newUpdatesObj.common.type !== 'boolean') {
            const obj = {
                _id: 'info.newUpdates',
                type: 'state',
                common: {
                    role: 'indicator.updates',
                    name: {
                        en: 'Indicator if new adapter updates are available',
                        de: 'Anzeige, ob neue Adapter-Updates verfügbar sind',
                        ru: 'Индикатор наличия новых обновлений адаптера',
                        pt: 'Indicador se novas atualizações do adaptador estão disponíveis',
                        nl: 'Indicator of er nieuwe adapter-updates beschikbaar zijn',
                        fr: "Indicateur si de nouvelles mises à jour de l'adaptateur sont disponibles",
                        it: "Indicatore se sono disponibili nuovi aggiornamenti dell'adattatore",
                        es: 'Indicador si hay nuevas actualizaciones de adaptadores disponibles',
                        pl: 'Wskaźnik, czy dostępne są nowe aktualizacje adaptera',
                        uk: 'Індикатор наявності нових оновлень адаптера',
                        'zh-cn': '指示是否有新的适配器更新可用',
                    },
                    type: 'boolean',
                    read: true,
                    write: false,
                    def: false,
                },
                native: {},
            };
            promises.push(this.setObjectAsync(obj._id, obj));
        }
        const updatesJsonObj = objects[`${this.namespace}.info.updatesJson`];
        if (!updatesJsonObj || !updatesJsonObj.common || updatesJsonObj.common.type !== 'string') {
            const obj = {
                _id: 'info.updatesJson',
                type: 'state',
                common: {
                    role: 'indicator.updates',
                    name: {
                        en: 'JSON string with adapter update information',
                        de: 'JSON-String mit Adapteraktualisierungsinformationen',
                        ru: 'Строка JSON с информацией об обновлении адаптера',
                        pt: 'String JSON com informações de atualização do adaptador',
                        nl: 'JSON-tekenreeks met adapter-update-informatie',
                        fr: "Chaîne JSON avec les informations de mise à jour de l'adaptateur",
                        it: "Stringa JSON con informazioni sull'aggiornamento dell'adattatore",
                        es: 'Cadena JSON con información de actualización del adaptador',
                        pl: 'Ciąg JSON z informacjami o aktualizacji adaptera',
                        uk: 'Рядок JSON з інформацією про оновлення адаптера',
                        'zh-cn': '带有适配器更新信息的 JSON 字符串',
                    },
                    type: 'string',
                    read: true,
                    write: false,
                    def: '{}',
                },
                native: {},
            };
            promises.push(this.setObjectAsync(obj._id, obj));
        }
        const lastUpdateCheckObj = objects[`${this.namespace}.info.lastUpdateCheck`];
        if (!lastUpdateCheckObj || !lastUpdateCheckObj.common || lastUpdateCheckObj.common.type !== 'number') {
            const obj = {
                _id: 'info.lastUpdateCheck',
                type: 'state',
                common: {
                    role: 'value.time',
                    name: {
                        en: 'Timestamp of last update check',
                        de: 'Zeitstempel der letzten UpdatePrüfung',
                        ru: 'Отметка времени последней проверки обнвлений',
                        pt: 'Timestamp da última verificação de atualizaçã',
                        nl: 'Tijdstempel van laatste updatecontrole',
                        fr: 'Horodatage de la dernière vérificationde mise à jour',
                        it: "Timestamp dell'ultimo controllo di aggiornamento",
                        es: 'Marca de tiempo de la última verificación de actalización',
                        pl: 'Znacznik czasu ostatniego sprawdzenia aktualizacji',
                        uk: 'Відмітка часу останньої перевірки оновлень',
                        'zh-cn': '上次更新检查的时间戳',
                    },
                    type: 'number',
                    read: true,
                    write: false,
                    def: 0,
                },
                native: {},
            };
            promises.push(this.setObjectAsync(obj._id, obj));
        }
        await Promise.all(promises);
    }
    upToDate(v1, v2) {
        return semver.gt(v2, v1);
    }
    /**
     * Write the update information to the states
     */
    async writeUpdateInfo(
    /** current sources, if given */
    sources) {
        if (!objects['system.config'] || !objects['system.config'].common) {
            return this.log.warn('Repository cannot be read. Invalid "system.config" object.');
        }
        const activeRepo = objects['system.config']
            .common?.activeRepo;
        const systemRepos = objects['system.repositories'];
        if (!sources) {
            sources = {};
            // If a multi-repo case. Actual case
            if (Array.isArray(activeRepo)) {
                if (systemRepos?.native?.repositories) {
                    for (const repo of activeRepo) {
                        if (systemRepos.native.repositories[repo]?.json) {
                            Object.assign(sources, systemRepos.native.repositories[repo].json);
                        }
                        else {
                            await this.setState('info.updatesNumber', 0, true);
                            await this.setState('info.updatesList', '', true);
                            await this.setState('info.newUpdates', false, true);
                            await this.setState('info.updatesJson', '{}', true);
                            await this.setState('info.lastUpdateCheck', Date.now(), true);
                            if (systemRepos.native.repositories[repo]) {
                                this.log.warn(`Repository cannot be read: Active repo - ${repo}`);
                            }
                            else {
                                this.log.warn('No repository source configured');
                            }
                        }
                    }
                }
            }
            else if (activeRepo && systemRepos?.native?.repositories?.[activeRepo]?.json) {
                // This is deprecated and must be deleted after a couple of years: BF 2025.02.07
                // `native` is `Record<string, any>`, so the cast keeps `sources` narrowed to non-undefined
                sources = systemRepos.native.repositories[activeRepo].json;
            }
        }
        if (!Object.keys(sources).length) {
            await this.setState('info.updatesNumber', 0, true);
            await this.setState('info.updatesList', '', true);
            await this.setState('info.newUpdates', false, true);
            await this.setState('info.updatesJson', '{}', true);
            await this.setState('info.lastUpdateCheck', Date.now(), true);
            if (Array.isArray(activeRepo)) {
                let found = false;
                if (systemRepos?.native?.repositories) {
                    activeRepo.forEach(repo => {
                        if (systemRepos.native.repositories[repo]) {
                            this.log.warn(`Active repository "${repo}" cannot be read`);
                            found = true;
                        }
                    });
                }
                if (!found) {
                    this.log.warn(`No repository source configured. Possible values: ${systemRepos?.native?.repositories
                        ? Object.keys(systemRepos.native.repositories).join(', ')
                        : 'none'}. Active repo(s): "${activeRepo.join('", "')}"`);
                }
            }
            else if (activeRepo && systemRepos?.native?.repositories?.[activeRepo]) {
                this.log.warn(`Repository cannot be read. Active repo: ${JSON.stringify(activeRepo)}`);
            }
            else {
                this.log.warn(`No repository source configured. Possible values: ${systemRepos?.native?.repositories
                    ? Object.keys(systemRepos.native.repositories).join(', ')
                    : 'none'}. Active repo: ${JSON.stringify(activeRepo)}`);
            }
            return;
        }
        const installed = getInstalledInfo();
        const list = [];
        const updatesJson = {};
        let newUpdateIndicator = false;
        const state = await this.getStateAsync('info.updatesJson');
        let oldUpdates;
        if (typeof state?.val === 'string') {
            try {
                oldUpdates = JSON.parse(state.val) || {};
            }
            catch (e) {
                oldUpdates = {};
                this.log.warn(`Cannot parse info.updatesJson: ${e.toString()}`);
            }
        }
        else {
            oldUpdates = {};
        }
        Object.keys(sources).forEach(name => {
            try {
                if (installed[name]?.version && sources[name].version) {
                    if (sources[name].version !== installed[name].version &&
                        !this.upToDate(sources[name].version, installed[name].version)) {
                        // Check if updates are new or already known to user
                        if (!oldUpdates ||
                            !oldUpdates[name] ||
                            oldUpdates[name].availableVersion !== sources[name].version) {
                            newUpdateIndicator = true;
                        } // endIf
                        updatesJson[name] = {
                            availableVersion: sources[name].version,
                            installedVersion: installed[name].version,
                        };
                        // remove the first part of the name
                        const n = name.indexOf('.');
                        list.push(n === -1 ? name : name.substring(n + 1));
                    }
                }
            }
            catch (err) {
                this.log.warn(`Error on version check for ${name}: ${err.toString()}`);
            }
        });
        await this.setState('info.updatesNumber', list.length, true);
        await this.setState('info.updatesList', list.join(', '), true);
        await this.setState('info.newUpdates', newUpdateIndicator, true);
        await this.setState('info.updatesJson', JSON.stringify(updatesJson), true);
        await this.setState('info.lastUpdateCheck', Date.now(), true);
        if (!newUpdateIndicator) {
            return;
        }
        const textArr = [];
        for (const [adapter, updateInfo] of Object.entries(updatesJson)) {
            const text = (0, translations_1.getAdapterUpdateText)({
                adapter,
                installedVersion: updateInfo.installedVersion,
                newVersion: updateInfo.availableVersion,
                lang: systemLanguage,
            });
            textArr.push(text);
        }
        await this.registerNotification('admin', 'adapterUpdates', textArr.join('\n'));
    }
    async initSocket(server, store) {
        const settings = {
            language: this.config.language,
            defaultUser: this.config.defaultUser,
            ttl: normalizeLoginTimeout(this.config.ttl),
            secure: this.config.secure,
            auth: true,
            port: this.config.port,
            secret: this.secret,
        };
        // Build the synchronous socket-role cache before accepting the first client. Without
        // this barrier an installer could briefly be treated as an end user during a fresh start.
        try {
            await this.ensureEosRoleModel();
        }
        catch (e) {
            this.log.warn(`Cannot prepare EOS role cache before socket start: ${e instanceof Error ? e.message : String(e)}`);
        }
        socket = new socket_classes_1.SocketAdmin(settings, this, objects);
        if (!this.eosSessionSecurity || !isSocketSessionStore(store)) {
            throw new Error('EOS authentication services are unavailable');
        }
        this.eosSessionSecurity.bindSockets(socket);
        this.installEosSocketCommandGuard(socket);
        socket.start(server, ws_server_1.SocketIO, { store, oauth2Only: true, noBasicAuth: this.config.noBasicAuth });
        // subscribe to all object changes
        socket.subscribe('objectChange', '*');
        this.getForeignObjectAsync('system.meta.uuid')
            .then(async (obj) => {
            if (obj?.native) {
                try {
                    await socket.updateRatings();
                }
                catch (error) {
                    this.log.error(`Cannot fetch ratings: ${error.toString()}`);
                }
            }
        })
            .catch(error => this.log.error(`Cannot read UUID: ${error}`));
    }
    async applyRightsToObjects(pattern, types) {
        let len = 0;
        if (typeof types === 'object') {
            for (const type of types) {
                len += await this.applyRightsToObjects(pattern, type);
            }
        }
        else {
            try {
                const doc = await this.getObjectViewAsync('system', types, {
                    startkey: `${pattern}.`,
                    endkey: `${pattern}.\u9999`,
                });
                this._tasks = this._tasks || [];
                for (const row of doc.rows) {
                    const obj = row.value;
                    // objects without an ACL are left alone - the objects DB owns that structure
                    if (obj.acl && obj.acl.owner !== this.config.defaultUser) {
                        obj.acl.owner = this.config.defaultUser;
                        await this.setForeignObjectAsync(obj._id, obj);
                        len++;
                    }
                }
            }
            catch (e) {
                this.log.error(`Error applying rights to objects: ${e.message}`);
            }
        }
        return len;
    }
    async applyRights() {
        this.config.accessAllowedConfigs = this.config.accessAllowedConfigs || [];
        this.config.accessAllowedTabs = this.config.accessAllowedTabs || [];
        let len = 0;
        for (const id of this.config.accessAllowedConfigs) {
            const obj = await this.getForeignObjectAsync(`system.adapter.${id}`);
            if (obj?.acl && obj.acl.owner !== this.config.defaultUser) {
                obj.acl.owner = this.config.defaultUser;
                await this.setForeignObjectAsync(`system.adapter.${id}`, obj);
                len++;
            }
        }
        for (const id of this.config.accessAllowedTabs) {
            if (id.startsWith('devices.')) {
                // change rights of all `alias.*`
                len += await this.applyRightsToObjects('alias', ['state', 'channel']);
            }
            else if (id.startsWith('javascript.')) {
                // change rights of all script.js.*
                len += await this.applyRightsToObjects('javascript', ['script', 'channel']);
            }
            else if (id.startsWith('fullcalendar.')) {
                // change rights of all fullcalendar.*
                len += await this.applyRightsToObjects('fullcalendar', ['schedule']);
            }
            else if (id.startsWith('scenes.')) {
                // change rights of all scenes.*
                len += await this.applyRightsToObjects('scenes', ['state', 'channel']);
            }
        }
        if (len) {
            this.log.info(`Updated ${len} objects`);
        }
    }
    /**
     * Read news from the server and register them as notifications
     */
    async updateNews() {
        if (this.timerNews) {
            clearTimeout(this.timerNews);
            this.timerNews = undefined;
        }
        this.checkNodeJsVersion().catch(() => this.log.warn('Cannot check Node.js versions; bounded request or local update failed'));
        let oldNews;
        let newEtag;
        const oldEtag = (await this.getStateAsync('info.newsETag'))?.val;
        let etag;
        // Both sequential news requests share one monotonic five-second network budget.
        const newsRequestStarted = performance.now();
        const newsRemainingBudget = () => {
            const remaining = Math.floor(5000 - (performance.now() - newsRequestStarted));
            if (remaining <= 0) {
                throw new Error('EOS_NEWS_REQUEST_DEADLINE');
            }
            return remaining;
        };
        try {
            etag = await (0, eosHttpsClient_1.requestHttpsJson)('https://iobroker.live/repo/news-hash.json', {
                allowedHosts: ['iobroker.live'],
                maxBytes: 16_384,
                budgetMs: newsRemainingBudget(),
            });
        }
        catch {
            this.log.warn('Cannot update news; bounded request or local update failed');
        }
        let _newNews;
        if (etag && etag.hash !== oldEtag) {
            newEtag = etag.hash;
            try {
                _newNews = await (0, eosHttpsClient_1.requestHttpsJson)('https://iobroker.live/repo/news.json', {
                    allowedHosts: ['iobroker.live'],
                    maxBytes: 1_048_576,
                    budgetMs: newsRemainingBudget(),
                });
            }
            catch {
                this.log.warn('Cannot fetch news feed; bounded HTTPS request failed');
            }
        }
        else {
            newEtag = oldEtag;
            _newNews = [];
        }
        const newNews = Array.isArray(_newNews) ? _newNews : [];
        const newsState = await this.getStateAsync('info.newsFeed');
        try {
            oldNews = newsState?.val ? JSON.parse(newsState.val) : [];
        }
        catch {
            oldNews = [];
        }
        const originalOldNews = JSON.stringify(oldNews);
        const lastState = await this.getStateAsync('info.newsLastId');
        // find time of last ID
        let time = '';
        if (lastState?.val) {
            const item = oldNews.find(item => item.id === lastState.val);
            if (item) {
                time = item.created;
            }
        }
        try {
            // add all IDs newer than last seen
            newNews.forEach(item => {
                if (!lastState || !time || item.created > time) {
                    if (!oldNews.find(it => it.created === item.created)) {
                        oldNews.push(item);
                    }
                }
            });
            oldNews.sort((a, b) => (a.created > b.created ? -1 : a.created < b.created ? 1 : 0));
            // delete news older than 3 months
            let i;
            for (i = oldNews.length - 1; i >= 0; i--) {
                if (Date.now() - new Date(oldNews[i].created).getTime() > 180 * 24 * 3_600_000) {
                    oldNews.splice(i, 1);
                }
            }
            if (originalOldNews !== JSON.stringify(oldNews)) {
                await this.registerNewsNotifications(oldNews, lastState?.val);
                await this.setStateAsync('info.newsFeed', JSON.stringify(oldNews), true);
            }
            if (newEtag !== oldEtag) {
                await this.setStateAsync('info.newsETag', newEtag, true);
            }
        }
        catch {
            this.log.warn('Cannot update news; bounded request or local update failed');
        }
        this.timerNews = this.setTimeout(() => {
            this.updateNews().catch(() => this.log.warn('Cannot update news'));
        }, 24 * ONE_HOUR_MS + 1);
    }
    /**
     * Add the news to the notification system
     *
     * @param messages sorted news
     * @param lastMessageId lastMessageId, all after this has already been seen
     */
    async registerNewsNotifications(messages, lastMessageId) {
        const adapters = await this.getObjectViewAsync('system', 'adapter', {
            startkey: 'system.adapter.\u0000',
            endkey: 'system.adapter.\u9999',
        });
        const operatingSystem = (0, node_os_1.platform)();
        const instances = await this.getObjectViewAsync('system', 'instance', {
            startkey: 'system.adapter.\u0000',
            endkey: 'system.adapter.\u9999',
        });
        const activeRepo = (await this.getForeignObjectAsync('system.config'))?.common.activeRepo;
        const uuid = (await this.getForeignObjectAsync('system.meta.uuid'))?.native.uuid;
        const nodeVersion = process.version;
        const npmVersion = await this.getNpmVersion();
        const today = Date.now();
        let objectCount;
        for (const message of messages) {
            if (!message) {
                continue;
            }
            if (message.id === lastMessageId) {
                break;
            }
            let showIt = true;
            if (showIt && message['date-start'] && new Date(message['date-start']).getTime() > today) {
                showIt = false;
            }
            else if (showIt && message['date-end'] && new Date(message['date-end']).getTime() < today) {
                showIt = false;
            }
            else if (showIt && message.conditions && Object.keys(message.conditions).length > 0) {
                Object.keys(message.conditions).forEach(key => {
                    if (showIt) {
                        const adapter = adapters.rows.find(adapter => adapter.id === `system.adapter.${key}`);
                        const condition = message.conditions[key];
                        if (!adapter && condition !== '!installed') {
                            showIt = false;
                        }
                        else if (adapter && condition === '!installed') {
                            showIt = false;
                        }
                        else if (adapter && condition === 'active') {
                            showIt = this.checkActive(key, instances);
                        }
                        else if (adapter && condition === '!active') {
                            showIt = !this.checkActive(key, instances);
                        }
                        else if (adapter?.value) {
                            showIt = this.checkConditions(condition, adapter.value.common.version);
                        }
                    }
                });
            }
            if (showIt && message['node-version']) {
                showIt = this.checkConditions(message['node-version'], nodeVersion);
            }
            if (showIt && message['npm-version']) {
                showIt = this.checkConditions(message['npm-version'], npmVersion);
            }
            if (showIt && message.os) {
                showIt = operatingSystem === message.os;
            }
            if (showIt && message.repo) {
                // If multi-repo
                if (Array.isArray(activeRepo)) {
                    showIt = activeRepo.includes(message.repo);
                }
                else {
                    showIt = activeRepo === message.repo;
                }
            }
            if (showIt && message.uuid) {
                if (Array.isArray(message.uuid)) {
                    showIt = uuid && message.uuid.find(msgUuid => uuid === msgUuid);
                }
                else {
                    showIt = !!(uuid && uuid === message.uuid);
                }
            }
            if (showIt && message['number-of-objects'] !== undefined) {
                if (objectCount === undefined) {
                    const res = await this.getObjectListAsync({ include_docs: false });
                    objectCount = res.rows.length;
                }
                showIt = (0, eosNewsSecurity_1.matchesObjectCount)(objectCount, message['number-of-objects']);
            }
            if (showIt && message['objects-db-type']) {
                const objectsDbType = await this.getObjectsDbType();
                if (!message['objects-db-type'].includes(objectsDbType)) {
                    showIt = false;
                }
            }
            if (showIt) {
                this.log.info(`register notification ${message.class}`);
                await this.registerNotification('admin', `${message.class}News`, `${message.title.en}\n${message.content.en}`);
            }
        }
    }
    /**
     * Check if the adapter is active
     *
     * @param adapterName name of the adapter
     * @param instances list of instances
     */
    checkActive(adapterName, instances) {
        return !!Object.keys(instances)
            .filter(id => id.startsWith(`adapter.system.${adapterName}.`))
            .find(id => instances.rows.find(row => id === row.id)?.value?.common.enabled);
    }
    /**
     * Check if conditions met
     *
     * @param condition condition to check
     * @param installedVersion installed version
     */
    checkConditions(condition, installedVersion) {
        if (condition.startsWith('equals')) {
            const vers = condition.substring(7, condition.length - 1).trim();
            return installedVersion === vers;
        }
        if (condition.startsWith('bigger') || condition.startsWith('greater')) {
            const vers = condition.substring(7, condition.length - 1).trim();
            try {
                return semver.gt(vers, installedVersion);
            }
            catch {
                return false;
            }
        }
        else if (condition.startsWith('smaller')) {
            const vers = condition.substring(8, condition.length - 1).trim();
            try {
                return semver.lt(installedVersion, vers);
            }
            catch {
                return false;
            }
        }
        else if (condition.startsWith('between')) {
            const vers1 = condition.substring(8, condition.indexOf(',')).trim();
            const vers2 = condition.substring(condition.indexOf(',') + 1, condition.length - 1).trim();
            try {
                return semver.gte(installedVersion, vers1) && semver.lte(installedVersion, vers2);
            }
            catch {
                return false;
            }
        }
        else {
            return true;
        }
    }
    /**
     * Get the objects db type
     */
    async getObjectsDbType() {
        const hostAlive = await this.getForeignStateAsync(`system.host.${this.host}.alive`);
        if (!hostAlive?.val) {
            return 'jsonl';
        }
        const diagData = await this.sendToHostAsync(this.host, 'getDiagData', 'normal');
        const type = isRecord(diagData) ? diagData.objectsType : undefined;
        return type === 'file' || type === 'redis' ? type : 'jsonl';
    }
    /**
     * Get the installed js-controller version. The controller is core infrastructure and not a
     * regular adapter, so its version cannot be read from the `system.adapter.*` objects.
     */
    getJsControllerVersion() {
        try {
            return getInstalledInfo()['js-controller']?.version || '';
        }
        catch (e) {
            this.log.warn(`Cannot determine js-controller version: ${e.toString()}`);
            return '';
        }
    }
    /**
     * Get the current npm version from the controller
     */
    async getNpmVersion() {
        const hostAlive = await this.getForeignStateAsync(`system.host.${this.host}.alive`);
        if (!hostAlive?.val) {
            throw new Error('Host is offline');
        }
        const hostInfo = await this.sendToHostAsync(this.host, 'getHostInfo', {});
        if (!isRecord(hostInfo) || typeof hostInfo.NPM !== 'string' || !semver.valid(hostInfo.NPM)) {
            throw new Error('Host did not report its npm version');
        }
        return hostInfo.NPM;
    }
    /**
     * Send a message to a host.
     *
     * On CI systems the test frameworks (`@iobroker/testing`, `@iobroker/legacy-testing`) start only the adapters,
     * but no js-controller host. Requests to the host (`getRepository`, `getInstalled`, `readBaseSettings`, ...)
     * are then never answered, and the GUI waits for its read timeout (15 seconds) before it continues.
     * To speed up the CI runs, such requests are answered immediately with a timeout error if the host is not alive.
     * Outside a CI system this method behaves exactly like `Adapter.sendToHost`.
     *
     * @param hostName Name of the host with or without the `system.host.` prefix, or `null` for all hosts
     * @param command Command for the host
     * @param message Command-specific message
     * @param callback Called with the answer of the host
     */
    sendToHost(hostName, command, message, callback, options) {
        if (!this.ciSystem || !hostName || typeof callback !== 'function') {
            super.sendToHost(hostName, command, message, callback, options);
            return;
        }
        const cb = callback;
        const hostId = hostName.startsWith('system.host.') ? hostName : `system.host.${hostName}`;
        void this.getForeignState(`${hostId}.alive`, (_err, state) => {
            if (state?.val) {
                super.sendToHost(hostName, command, message, cb, options);
                return;
            }
            this.log.debug(`[CI] Host "${hostId}" is not alive: request "${command}" timed out`);
            const answer = command === 'getRepository' || command === 'getInstalled' ? {} : { error: 'timeout' };
            // Controller callbacks receive command data, not complete Message envelopes.
            Reflect.apply(cb, undefined, [answer]);
        });
    }
    async checkNodeJsVersion() {
        // allow only one admin instance to check the versions for every host
        if (this.instance !== 0) {
            const objs = await this.getObjectViewAsync('system', 'instance', {
                startkey: 'system.adapter.eos-admin.',
                endkey: 'system.adapter.eos-admin.\u9999',
            });
            let min = null;
            // find the lowest active instance on the same host
            for (const row of objs.rows) {
                const obj = row.value;
                if (obj?.common.enabled && obj.common.host === this.host) {
                    const instance = parseInt(row.id.split('.').pop() || '', 10);
                    if (min === null || min < instance) {
                        min = instance;
                    }
                }
            }
            if (this.instance !== min) {
                return;
            }
        }
        const response = {
            data: (0, eosNewsSecurity_1.validateNodeReleaseIndex)(await (0, eosHttpsClient_1.requestHttpsJson)('https://nodejs.org/download/release/index.json', {
                allowedHosts: ['nodejs.org'],
                maxBytes: 2_097_152,
                budgetMs: 5000,
            })),
        };
        const result = {
            nodeNewest: '',
            nodeNewestNext: '',
            npmNewest: '',
            npmNewestNext: '',
            npmCurrent: '',
            nodeCurrent: process.version,
        };
        try {
            result.npmCurrent = await this.getNpmVersion();
        }
        catch (error) {
            this.log.warn(`Cannot get current npm version: ${String(error)}`);
        }
        // https://nodejs.org/download/release/index.json
        // detect a new version of the same major version and new major version (that is allowed by ioBroker)
        try {
            const recommendedVersions = await this.getRecommendedVersions();
            // find newest suggested version
            const nodeNewestNext = response.data.find(item => item.version.startsWith(`v${recommendedVersions.node}.`));
            const nodeCurrentMajor = process.version.split('.')[0];
            const nodeNewest = response.data.find(item => item.version.startsWith(`${nodeCurrentMajor}.`));
            if (nodeNewestNext) {
                result.nodeNewestNext = nodeNewestNext.version;
            }
            if (nodeNewest) {
                result.nodeNewest = nodeNewest.version;
            }
            // find newest suggested version
            const npmNewestNext = nodeNewestNext || response.data.find(item => item.npm.startsWith(`${recommendedVersions.npm}.`));
            const npmNewest = response.data.find(item => item.version === process.version);
            if (npmNewestNext) {
                result.npmNewestNext = npmNewestNext.npm;
            }
            if (npmNewest) {
                result.npmNewest = npmNewest.npm;
            }
            const prefix = `system.host.${this.host}.versions`;
            await this.setForeignObjectNotExistsAsync(prefix, {
                type: 'channel',
                common: {
                    name: {
                        en: 'Node.js/Npm versions',
                        de: 'Node.js/Npm Versionen',
                        ru: 'Node.js/Npm версии',
                        pt: 'Versões Node.js/Npm',
                        nl: 'Node.js/Npm versions',
                        fr: 'Node.js/Npm versions',
                        it: 'Node.js/Npm versioni',
                        es: 'Node.js/Npm versiones',
                        pl: 'Wersja node.js/Npm',
                        uk: 'Версії Node.js/Npm',
                        'zh-cn': '页: 1',
                    },
                },
                native: {},
            });
            const states = [
                {
                    _id: 'nodeCurrent',
                    type: 'state',
                    common: {
                        role: 'state',
                        name: {
                            en: 'Current node.js version',
                            de: 'Aktuelle node.js Version',
                            ru: 'Текущая версия node.js',
                            pt: 'Versão atual do node.js',
                            nl: 'Current Node',
                            fr: 'Version actuelle node.js',
                            it: 'Versione attuale node.js',
                            es: 'Versión actual node.js',
                            pl: 'Aktualna wersja.js',
                            uk: 'Поточна версія вузла',
                            'zh-cn': '目前没有。',
                        },
                        type: 'string',
                        read: true,
                        write: false,
                        def: '',
                    },
                    native: {},
                },
                {
                    _id: 'nodeNewest',
                    type: 'state',
                    common: {
                        role: 'state',
                        name: {
                            en: 'Newest node.js version',
                            de: 'Neueste node.js Version',
                            ru: 'Новейшая версия node.js',
                            pt: 'Mais recente versão node.js',
                            nl: 'Nieuwste node',
                            fr: 'Nouvelle version node.js',
                            it: 'Nuova versione node.js',
                            es: 'Versión más reciente node.js',
                            pl: 'Najnowsza wersja węzła.js',
                            uk: 'Остання версія вузла',
                            'zh-cn': '最新版本',
                        },
                        type: 'string',
                        read: true,
                        write: false,
                        def: '',
                    },
                    native: {},
                },
                {
                    _id: 'nodeNewestNext',
                    type: 'state',
                    common: {
                        role: 'state',
                        name: {
                            en: 'Newest next major node.js version',
                            de: 'Neueste nächste große node.js Version',
                            ru: 'Новейшая следующая версия node.js',
                            pt: 'Mais nova versão principal node.js',
                            nl: 'Nieuwste volgende grote node',
                            fr: 'Nouvelle prochaine version node.js',
                            it: 'Nuova versione principale node.js',
                            es: 'Versión más reciente node.js',
                            pl: 'Najnowsza wersja węzła.js',
                            uk: 'Новейшая наступна версія вузла',
                            'zh-cn': '今后最新的重要内容。',
                        },
                        type: 'string',
                        read: true,
                        write: false,
                        def: '',
                    },
                    native: {},
                },
                {
                    _id: 'npmCurrent',
                    type: 'state',
                    common: {
                        role: 'state',
                        name: {
                            en: 'Current npm version',
                            de: 'Aktuelle Version',
                            ru: 'Текущая версия npm',
                            pt: 'Versão actual npm',
                            nl: 'Current Npm versie',
                            fr: 'Version actuelle npm',
                            it: 'Versione npm attuale',
                            es: 'Versión actual npm',
                            pl: 'Aktualna wersja',
                            uk: 'Поточна версія npm',
                            'zh-cn': '目前的印本',
                        },
                        type: 'string',
                        read: true,
                        write: false,
                        def: '',
                    },
                    native: {},
                },
                {
                    _id: 'npmNewest',
                    type: 'state',
                    common: {
                        role: 'state',
                        name: {
                            en: 'Newest npm version',
                            de: 'Neueste Version',
                            ru: 'Новейшая версия npm',
                            pt: 'Versão mais recente npm',
                            nl: 'Newest Npm versie',
                            fr: 'Nouvelle version npm',
                            it: 'Nuova versione npm',
                            es: 'Versión más reciente npm',
                            pl: 'Wersja nowa',
                            uk: 'Остання версія npm',
                            'zh-cn': '最新版本',
                        },
                        type: 'string',
                        read: true,
                        write: false,
                        def: '',
                    },
                    native: {},
                },
                {
                    _id: 'npmNewestNext',
                    type: 'state',
                    common: {
                        role: 'state',
                        name: {
                            en: 'Newest next major NPM version',
                            de: 'Neueste nächste große NPM-Version',
                            ru: 'Новейшая следующая крупная версия NPM',
                            pt: 'Mais nova versão principal do NPM',
                            nl: 'NPM',
                            fr: 'La version la plus récente',
                            it: 'Nuova versione NPM',
                            es: 'Versión NPM más reciente',
                            pl: 'Nowa wersja NPM',
                            uk: 'Новейша наступна велика версія NPM',
                            'zh-cn': '下一次主要国家预防计划',
                        },
                        type: 'string',
                        read: true,
                        write: false,
                        def: '',
                    },
                    native: {},
                },
            ];
            for (const state of states) {
                await this.setForeignObjectNotExistsAsync(`${prefix}.${state._id}`, state);
            }
            for (const [key, value] of Object.entries(result)) {
                await this.setForeignStateAsync(`${prefix}.${key}`, value.replace(/^v/, ''), true);
            }
        }
        catch {
            this.log.warn('Cannot check node.js/npm version');
        }
    }
    getData(callback) {
        this.log.info('requesting all objects');
        this.getObjectList({ include_docs: true }, (_err, res) => {
            this.log.info('received all objects');
            if (res) {
                objects = {};
                let tmpPath = '';
                for (const row of res.rows) {
                    objects[row.doc._id] = row.doc;
                    if (row.doc.type === 'instance' && row.doc.common?.tmpPath) {
                        if (tmpPath) {
                            this.log.warn('tmpPath has multiple definitions!!');
                        }
                        tmpPath = row.doc.common.tmpPath;
                    }
                }
                // Some adapters want access on specified tmp directory
                if (tmpPath) {
                    this.config.tmpPath = tmpPath;
                    this.config.tmpPathAllow = true;
                }
                void this.createUpdateInfo().then(() => this.writeUpdateInfo());
            }
            if (callback) {
                callback(this);
            }
        });
    }
    /**
     * Add the repository read timestamp to the repository data structure
     */
    async addRepositoryReadTimestamp(repository, activeRepo) {
        try {
            const readTime = new Date().toISOString();
            // Add read timestamp to the repository info structure
            if (isRecord(repository) && isRecord(repository._repoInfo)) {
                repository._repoInfo.repoReadTime = readTime;
            }
            // Update the system.repositories object to store the read timestamp
            const repos = await this.getForeignObjectAsync('system.repositories');
            if (repos?.native?.repositories) {
                if (Array.isArray(activeRepo)) {
                    // Handle multiple repositories
                    for (const repo of activeRepo) {
                        if (repos.native.repositories[repo]?.json?._repoInfo) {
                            repos.native.repositories[repo].json._repoInfo.repoReadTime = readTime;
                        }
                    }
                }
                else {
                    // Handle single repository
                    if (repos.native.repositories[activeRepo]?.json?._repoInfo) {
                        repos.native.repositories[activeRepo].json._repoInfo.repoReadTime = readTime;
                    }
                }
                // Save the updated repositories object
                await this.setForeignObjectAsync('system.repositories', repos);
                this.log.debug(`Repository read timestamp updated: ${readTime}`);
            }
        }
        catch (err) {
            this.log.error(`Cannot add repository read timestamp: ${err.toString()}`);
        }
    }
    async checkRevokedVersions(repository) {
        if (!isRecord(repository)) {
            throw new Error('Invalid repository response');
        }
        try {
            const adapters = Object.keys(repository);
            const instances = await this.getObjectViewAsync('system', 'instance', {
                startkey: 'system.adapter.',
                endkey: 'system.adapter.\u9999',
            });
            for (const _adapter of adapters) {
                const entry = repository[_adapter];
                if (!isRecord(entry)) {
                    continue;
                }
                if (entry.blockedVersions) {
                    // read the current version
                    if (Array.isArray(entry.blockedVersions)) {
                        const instance = instances.rows.find(item => item.value?.common.name === _adapter && item.value.common.enabled);
                        if (instance?.value?.common?.version) {
                            for (let i = 0; i < entry.blockedVersions.length; i++) {
                                try {
                                    if (semver.satisfies(instance.value.common.version, typeof entry.blockedVersions[i] === 'string'
                                        ? entry.blockedVersions[i]
                                        : '')) {
                                        // stop all instances
                                        for (let k = 0; k < instances.rows.length; k++) {
                                            const obj = instances.rows[k].value;
                                            if (obj?.common.enabled && obj.common.name === _adapter) {
                                                obj.common.enabled = false;
                                                await this.setForeignObjectAsync(obj._id, obj);
                                                this.log.warn(`Instance ${obj._id.replace('system.adapter.', '')} was disabled because blocked. Please update ${_adapter} to newer or available version`);
                                                const hostAlive = await this.getForeignStateAsync(`system.host.${obj.common.host}.alive`);
                                                if (hostAlive?.val) {
                                                    this.sendToHost(obj.common.host, 'addNotification', {
                                                        scope: 'system',
                                                        category: 'accessErrors', // change to 'blocked' when js-controller 4.1. released
                                                        instance: obj._id,
                                                        message: `Instance version was blocked. Please check for updates and update before restarting the instance`,
                                                    });
                                                }
                                                else {
                                                    this.log.warn(`Cannot add notification to ${obj.common.host} as it is offline`);
                                                }
                                            }
                                        }
                                    }
                                }
                                catch {
                                    this.log.error(`Cannot check revoked versions: ${entry.blockedVersions[i]}`);
                                    // ignore
                                }
                            }
                        }
                    }
                    else {
                        this.log.error(`Invalid blockedVersions for ${_adapter}: ${JSON.stringify(entry.blockedVersions)}. Expected array like ["<= 3.17.4"] or also ["~3.14.0", "~3.15.0", "~3.16.0"]`);
                    }
                }
            }
        }
        catch (e) {
            this.log.error(`Cannot check revoked versions: ${e.toString()}`);
        }
    }
    restartRepoUpdate() {
        // start the next cycle
        if (this.config.autoUpdate) {
            if (this.timerRepo) {
                this.clearTimeout(this.timerRepo);
                this.timerRepo = undefined;
            }
            this.log.debug(`Next repo update on ${new Date(Date.now() + this.config.autoUpdate * ONE_HOUR_MS + 1).toLocaleString()}`);
            this.timerRepo = this.setTimeout(async () => {
                this.timerRepo = undefined;
                await this.updateRegister();
            }, this.config.autoUpdate * ONE_HOUR_MS + 1);
        }
    }
    async getRecommendedVersions() {
        // Check if the host running
        const hostAlive = await this.getForeignStateAsync(`system.host.${this.host}.alive`);
        if (!hostAlive?.val) {
            return {
                node: CURRENT_MAX_MAJOR_NODEJS,
                npm: CURRENT_MAX_MAJOR_NPM,
            };
        }
        const repository = await this.sendToHostAsync(this.host, 'getRepository', {});
        const repoInfo = isRecord(repository) ? repository._repoInfo : undefined;
        const recommended = isRecord(repoInfo) ? repoInfo.recommendedVersions : undefined;
        if (isRecord(recommended) &&
            Number.isInteger(recommended.nodeJsRecommended) &&
            Number.isInteger(recommended.npmRecommended) &&
            typeof recommended.nodeJsRecommended === 'number' &&
            recommended.nodeJsRecommended >= 24 &&
            typeof recommended.npmRecommended === 'number' &&
            recommended.npmRecommended >= 11) {
            return { node: recommended.nodeJsRecommended, npm: recommended.npmRecommended };
        }
        return {
            node: CURRENT_MAX_MAJOR_NODEJS,
            npm: CURRENT_MAX_MAJOR_NPM,
        };
    }
    /**
     * Read repository information from the active repository
     */
    async updateRegister() {
        if (lastRepoUpdate && Date.now() - lastRepoUpdate < 3600000) {
            this.log.error('Automatic repository update is not allowed more than once an hour');
            this.restartRepoUpdate();
            return;
        }
        lastRepoUpdate = Date.now();
        try {
            const systemConfig = await this.getForeignObjectAsync('system.config');
            if (systemConfig?.common) {
                try {
                    const repos = await this.getForeignObjectAsync('system.repositories');
                    if (!repos || repos.ts === undefined) {
                        // start the next cycle
                        this.restartRepoUpdate();
                        return;
                    }
                    // Check if repositories exist
                    let exists = false;
                    const active = systemConfig.common.activeRepo;
                    // if repo is valid and actual
                    if (Array.isArray(active)) {
                        if (Date.now() < repos.ts + this.config.autoUpdate * ONE_HOUR_MS &&
                            !active.find(repo => !repos?.native?.repositories?.[repo]?.json)) {
                            exists = true;
                        }
                    }
                    else if (repos?.native?.repositories?.[active]?.json &&
                        Date.now() < repos.ts + this.config.autoUpdate * ONE_HOUR_MS) {
                        exists = true;
                    }
                    if (!exists) {
                        this.log.info('Request actual repository...');
                        // first check if the host is running
                        const aliveState = await this.getForeignStateAsync(`system.host.${this.host}.alive`);
                        if (!aliveState?.val) {
                            this.log.error('Host is not alive');
                            // start the next cycle
                            this.restartRepoUpdate();
                            return;
                        }
                        // request repo from host
                        this.sendToHost(this.host, 'getRepository', {
                            repo: active,
                            update: true,
                        }, async (_repository) => {
                            if ((typeof _repository === 'string' || _repository instanceof Error) &&
                                _repository.toString().includes(ERROR_PERMISSION)) {
                                this.log.error('May not read "getRepository"');
                            }
                            else {
                                this.log.info('Repository received successfully.');
                                // Add repository read timestamp to the repository data
                                await this.addRepositoryReadTimestamp(_repository, active);
                                socket?.repoUpdated();
                                this.checkRevokedVersions(_repository).catch(e => this.log.error(`Cannot check revoked versions: ${e}`));
                            }
                            // start the next cycle
                            this.restartRepoUpdate();
                        });
                    }
                    else if (this.config.autoUpdate) {
                        let interval = repos.ts + this.config.autoUpdate * ONE_HOUR_MS - Date.now() + 1;
                        if (interval > 0x7fffffff) {
                            interval = 0x7fffffff;
                        }
                        this.log.debug(`Next repo update on ${new Date(Date.now() + interval).toLocaleString()}`);
                        if (this.timerRepo) {
                            this.clearTimeout(this.timerRepo);
                        }
                        this.timerRepo = this.setTimeout(async () => {
                            this.timerRepo = undefined;
                            await this.updateRegister();
                        }, interval);
                    }
                }
                catch (err) {
                    this.log.error(`May not read "system.repositories": ${err.toString()}`);
                }
            }
        }
        catch {
            this.log.error('May not read "system.config"');
        }
    }
    /**
     * Initialize the adapter
     */
    init() {
        this.config.defaultUser = this.config.defaultUser || 'admin';
        if (!this.config.defaultUser.match(/^system\.user\./)) {
            this.config.defaultUser = `system.user.${this.config.defaultUser}`;
        }
        (0, objectFixes_1.verifyAdapterCore)(this).catch((e) => this.log.warn(`Cannot check @adapter-core version: ${e?.message}`));
        this.startEosSecurityGuard();
        (0, objectFixes_1.checkCommonObjects)(this).catch((e) => this.log.warn(`Cannot check common objects: ${e?.message}`));
        this.getData(adapter => (webServer = new web_1.default(adapter.config, adapter, this.initSocket.bind(this), { systemLanguage })));
        if (this.config.accessApplyRights &&
            this.config.accessLimit &&
            !this.config.auth &&
            this.config.defaultUser !== 'system.user.admin') {
            this.applyRights().catch((e) => this.log.warn(`Cannot apply rights: ${e?.message}`));
        }
        // By default, update repository every 24 hours
        if (this.config.autoUpdate === undefined || this.config.autoUpdate === null) {
            this.config.autoUpdate = 24;
        }
        // interval in hours
        this.config.autoUpdate = Number(this.config.autoUpdate) || 0;
        if (this.config.autoUpdate && this.config.autoUpdate < 4) {
            this.config.autoUpdate = 4; // only every 4 hours - it is a minimal update interval
        }
        else if (this.config.autoUpdate > 590) {
            // 0x7FFFFFFF / ONE_HOUR_MS = 596
            this.config.autoUpdate = 590; // max interval is 2147483647 milliseconds
        }
        // check info.connected
        void this.getObjectAsync('info.connected').then(obj => {
            if (!obj) {
                const packageJson = JSON.parse((0, node_fs_1.readFileSync)(`${__dirname}/../io-package.json`).toString('utf8'));
                const obj = packageJson.instanceObjects.find((o) => o._id === 'info.connected');
                if (obj) {
                    return this.setObjectAsync(obj._id, obj);
                }
            }
        });
        if (this.config.autoUpdate) {
            void this.updateRegister().catch(e => this.log.error(`Cannot update repository: ${e}`));
        }
        void this.updateNews().catch(() => this.log.error('Cannot update news; bounded request or local update failed'));
        (0, objectFixes_1.updateIcons)(this);
        void (0, objectFixes_1.validateUserData0)(this).catch(e => this.log.error(`Cannot validate 0_userdata: ${e}`));
        void (0, objectFixes_1.updateDevicesObject)(this).catch(e => this.log.error(`Cannot update devices objects: ${e}`));
        this.log.info('Operating-system password testing and changes are disabled in EOS; use authorized OS maintenance.');
        this.subscribeForeignObjects(`system.adapter.${this.namespace}.plugins.sentry.enabled`);
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new Admin(options);
}
else {
    // otherwise start the instance directly
    (() => new Admin())();
}
//# sourceMappingURL=main.js.map