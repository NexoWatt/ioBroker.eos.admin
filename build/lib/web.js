"use strict";
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
const adapter_core_1 = require("@iobroker/adapter-core");
const webserver_1 = require("@iobroker/webserver");
const express_1 = __importDefault(require("express"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const compression_1 = __importDefault(require("compression"));
const mime_types_1 = require("mime-types");
const node_crypto_1 = require("node:crypto");
const ajv_1 = require("ajv");
const json5_1 = require("json5");
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const session = __importStar(require("express-session"));
const bodyParser = __importStar(require("body-parser"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const eosRequestSecurity_1 = require("./eosRequestSecurity");
const eosAutoUpdate_1 = require("./eosAutoUpdate");
const eosLicenseHttp_1 = require("./eosLicenseHttp");
const eosHttpsClient_1 = require("./eosHttpsClient");
const eosWebResources_1 = require("./eosWebResources");
const eosUploadGuard_1 = require("./eosUploadGuard");
const eosFileTransferSecurity_1 = require("./eosFileTransferSecurity");
const utils_1 = require("./utils");
const instanceProxy_1 = require("./instanceProxy");
let AdapterStore;
/** Content of a socket-io file */
let socketIoFile;
/** UUID of the installation */
let uuid;
const page404 = (0, node_fs_1.readFileSync)(`${__dirname}/../../public/404.html`).toString('utf8');
const logTemplate = (0, node_fs_1.readFileSync)(`${__dirname}/../../public/logTemplate.html`).toString('utf8');
const EOS_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;
const EOS_PASSWORD_SERVICE_USER = 'system.user.admin';
const LEGACY_BACKUP_ADAPTER_NAME = 'backitup';
const CUSTOMER_BACKUP_ADAPTER_NAMES = ['nexowatt-backup', 'eos-backup'];
const CORE_PROTECTED_ADAPTER_NAMES = [
    'admin',
    'eos-admin',
    'backitup',
    'nexowatt-backup',
    'eos-backup',
    'nexowatt-devices',
    'nexowatt-device',
    'nexowatt-dev',
    'nexowatt-ui',
];
/**
 * The only endpoints a browser on another origin may call.
 *
 * A page served by another adapter - or an MCP client - has to fetch a token from admin before it
 * can talk to it at all, and the OAuth2 endpoints are built for exactly that. Everything else stays
 * same-origin only.
 */
const CORS_ENABLED_PATHS = [
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/oauth/token',
    '/oauth/register',
    '/oauth/revoke',
];
// const FORBIDDEN_CHARS = /[\]\[*,;'"`<>\\\s?]/g; // with space
/**
 * Vite names every chunk `<name>-<hash>.<ext>` below `assets/`, and the hash changes with the content. A name like
 * `material-icons-outlined.woff2` has the same shape, so the hash must also hold a digit or an upper-case letter: a
 * real hash without one only loses the long caching, a wrong match would pin a file that changes with the next update.
 */
const HASHED_ASSET = /(^|[\\/])assets[\\/][^\\/]+-(?=[\w-]*[0-9A-Z])[\w-]{8}\.[a-z0-9]+$/;
/**
 * Cache-Control for a file of the admin GUI or of the admin pages of an adapter.
 *
 * A chunk with a content hash in its name never changes, so the browser keeps it for a year without asking again.
 * Everything else - `index.html`, but also `mf-manifest.json`, `remoteEntry.js` or `lib/js/*`, which belong to the
 * current version - is asked for on every load and answered with 304 while it is unchanged. So the admin loads from
 * the cache, and a new version is visible at once.
 *
 * @param path URL or file system path of the file
 */
function getCacheControl(path) {
    return HASHED_ASSET.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache';
}
// copied from here: https://github.com/component/escape-html/blob/master/index.js
const matchHtmlRegExp = /["'&<>]/;
function escapeHtml(string) {
    const str = `${string}`;
    const match = matchHtmlRegExp.exec(str);
    if (!match) {
        return str;
    }
    let escape;
    let html = '';
    let index;
    let lastIndex = 0;
    for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
            case 34: // "
                escape = '&quot;';
                break;
            case 38: // &
                escape = '&amp;';
                break;
            case 39: // '
                escape = '&#39;';
                break;
            case 60: // <
                escape = '&lt;';
                break;
            case 62: // >
                escape = '&gt;';
                break;
            default:
                continue;
        }
        if (lastIndex !== index) {
            html += str.substring(lastIndex, index);
        }
        lastIndex = index + 1;
        html += escape;
    }
    return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}
/** A JSON tab may omit the root type and declare an opening command. */
function adaptSchemaForTab(schema) {
    const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    const roots = [schema.then, schema.else].filter(isRecord);
    if (!roots.length) {
        roots.push(schema);
    }
    for (const root of roots) {
        const properties = isRecord(root.properties) ? root.properties : {};
        properties.command = {
            description: 'Message that is sent to the instance as the tab is opened',
            type: 'string',
        };
        root.properties = properties;
        if (Array.isArray(root.required)) {
            root.required = root.required.filter(name => name !== 'type');
        }
    }
}
/** Webserver class */
class Web {
    nexowattStableUpdateManager;
    server = {
        app: null,
        server: null,
    };
    /**
     * Configured public mount (`/` or `/admin/`), like web `rootPath`.
     * Incoming `/admin/…` is stripped so `:8081/admin/` and the proxy share one path.
     */
    publicPath;
    /** Login URL as the browser must see it. */
    get loginPage() {
        return `${this.publicPath}index.html?login`;
    }
    /** URL to the JSON config schema */
    JSON_CONFIG_SCHEMA_URL = 
    // 'https://raw.githubusercontent.com/ioBroker/NexoWatt EOS Admin/master/packages/jsonConfig/schemas/jsonConfig.json';
    'https://raw.githubusercontent.com/ioBroker/json-config/main/schemas/jsonConfig.json';
    /** Compiled JSON schemas for `jsonConfig.json` and for the JSON tabs */
    jsonValidators = {};
    store = null;
    indexHTML = '';
    baseDir = (0, node_path_1.join)(__dirname, '..', '..');
    dirName = (0, node_path_1.normalize)(`${this.baseDir}/admin/`.replace(/\\/g, '/')).replace(/\\/g, '/');
    unprotectedFiles = null;
    systemConfig = {};
    // todo delete after React will be main
    wwwDir = (0, node_path_1.join)(this.baseDir, 'adminWww');
    settings;
    adapter;
    options;
    onReady;
    systemLanguage;
    checkTimeout;
    oauth2Model = null;
    /** Authenticated, bounded forwarding to the web server of an installed instance. */
    instanceProxy;
    /**
     * Create a new instance of Web
     *
     * @param settings settings of the adapter
     * @param adapter instance of the adapter
     * @param onReady callback when the server is ready
     * @param options options for the webserver
     */
    constructor(settings, adapter, onReady, options) {
        this.settings = settings;
        this.adapter = adapter;
        this.onReady = onReady;
        this.options = options;
        this.systemLanguage = this.options?.systemLanguage || 'en';
        this.publicPath = (0, utils_1.getAdminPublicPath)(this.settings.reverseProxy, this.adapter.namespace);
        this.instanceProxy = new instanceProxy_1.InstanceProxy(this.adapter, this.publicPath);
        void this.#init();
    }
    decorateLogFile(fileName, text) {
        const log = text || (0, node_fs_1.readFileSync)(fileName).toString();
        return logTemplate.replace('@@title@@', (0, node_path_1.parse)(fileName).name).replace('@@body@@', escapeHtml(log));
    }
    setLanguage(lang) {
        this.systemLanguage = lang;
    }
    /**
     * Text of the 404 page in the language of admin; English as long as there is no translation
     *
     * @param key English text from `src/i18n`, may contain one `%s`
     * @param html HTML for `%s`
     */
    translate404(key, html) {
        let text = key;
        try {
            // Without a value for `%s`, getTranslatedObject() returns no language at all. It gets `%s` itself,
            // as it would take `$&` and the like in a real value for replacement patterns.
            const translated = adapter_core_1.I18n.getTranslatedObject(key, '%s');
            text = translated[this.systemLanguage] || translated.en || key;
        }
        catch {
            // I18n is not initialized yet
        }
        return html === undefined ? text : text.replace('%s', () => html);
    }
    /**
     * Render the 404 page in the language of admin. The page picks the theme of admin itself.
     *
     * @param detail English text from `src/i18n` saying what was not found, may contain one `%s`
     * @param value value for `%s`, e.g., the requested path. It is escaped here.
     */
    get404Page(detail, value) {
        const values = {
            LANGUAGE: this.systemLanguage,
            TITLE: this.translate404('Page not found'),
            MESSAGE: this.translate404('The page you are looking for does not exist or has been moved.'),
            DETAIL: detail
                ? this.translate404(detail, value === undefined ? undefined : `<code>${escapeHtml(value)}</code>`)
                : '',
            HOME: escapeHtml(this.publicPath),
            BACK: this.translate404('Back to start page'),
        };
        // In one pass: a value - like the requested path - must never be searched for placeholders itself
        return page404.replace(/%(LANGUAGE|TITLE|MESSAGE|DETAIL|HOME|BACK)%/g, (_match, name) => values[name]);
    }
    close() {
        if (this.checkTimeout) {
            this.adapter.clearTimeout(this.checkTimeout);
            this.checkTimeout = undefined;
        }
        this.nexowattStableUpdateManager?.stop();
        this.instanceProxy.close();
        void this.adapter.setState('info.connection', false, true);
        this.server.server?.close();
    }
    processMessage(msg) {
        return this.oauth2Model?.processMessage(msg) ?? false;
    }
    /**
     * Configuration of the identity provider for the single sign-on.
     *
     * Only a complete configuration is handed over. Without it, the webserver does not register the
     * SSO routes at all, and the login page does not offer the button.
     */
    getOidcConfig() {
        // EOS deliberately supports local accounts only until external identity mapping is verified.
        return undefined;
    }
    invalidateProxySessions() {
        this.instanceProxy.invalidate();
    }
    async prepareIndex(index) {
        let template = (0, node_fs_1.readFileSync)((0, node_path_1.join)(this.wwwDir, index)).toString('utf8');
        const m = template.match(/(["']?@@\w+@@["']?)/g) || [];
        for (let pattern of m) {
            pattern = pattern.replace(/@/g, '').replace(/'/g, '').replace(/"/g, '');
            if (pattern === 'ssoActive') {
                // The button on the login page may only appear if the SSO really works
                template = template.replace('@@ssoActive@@', this.getOidcConfig() ? 'true' : 'false');
            }
            else if (pattern === 'disableDataReporting') {
                // read sentry state
                const state = await this.adapter.getForeignStateAsync(`system.adapter.${this.adapter.namespace}.plugins.sentry.enabled`);
                template = template.replace(/['"]@@disableDataReporting@@["']/g, state?.val ? 'false' : 'true');
            }
            else if (pattern === 'loginBackgroundImage') {
                if (this.adapter.config.loginBackgroundImage) {
                    template = template.replace('@@loginBackgroundImage@@', `files/${this.adapter.namespace}/login-bg.png`);
                }
                else {
                    template = template.replace('@@loginBackgroundImage@@', '');
                }
            }
            else if (pattern === 'loginBackgroundColor') {
                template = template.replace('@@loginBackgroundColor@@', this.adapter.config.loginBackgroundColor || 'inherit');
            }
            else if (pattern === 'loadingBackgroundImage') {
                if (this.adapter.config.loadingBackgroundImage) {
                    template = template.replace('@@loadingBackgroundImage@@', `files/${this.adapter.namespace}/loading-bg.png`);
                }
                else {
                    template = template.replace('@@loadingBackgroundImage@@', '');
                }
            }
            else if (pattern === 'loadingBackgroundColor') {
                template = template.replace('@@loadingBackgroundColor@@', this.adapter.config.loadingBackgroundColor || '');
            }
            else if (pattern === 'vendorPrefix') {
                template = template.replace(`@@vendorPrefix@@`, this.systemConfig.native?.vendor.uuidPrefix || (uuid.length > 36 ? uuid.substring(0, 2) : ''));
            }
            else if (pattern === 'loginMotto') {
                template = template.replace(`@@loginMotto@@`, this.systemConfig.native?.vendor.admin.login.motto || this.adapter.config.loginMotto || '');
            }
            else if (pattern === 'loginLogo') {
                template = template.replace(`@@loginLogo@@`, this.systemConfig.native?.vendor.icon || '');
            }
            else if (pattern === 'loginLink') {
                template = template.replace(`@@loginLink@@`, this.systemConfig.native?.vendor.admin.login.link || '');
            }
            else if (pattern === 'loginTitle') {
                template = template.replace(`@@loginTitle@@`, this.systemConfig.native?.vendor.admin.login.title || '');
            }
            else if (pattern === 'socketPath') {
                // Same as web `rootPath`: WS URL only. Empty when admin is at `/`.
                template = template.replace(/@@socketPath@@/g, this.publicPath === '/' ? '' : this.publicPath);
            }
            else {
                const value = { ...this.adapter.config }[pattern];
                const text = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                    ? String(value)
                    : '';
                template = template.replace(`@@${pattern}@@`, text);
            }
        }
        return template;
    }
    getInfoJs() {
        const result = [`window.sysLang = "${this.systemLanguage}";`];
        if (this.publicPath && this.publicPath !== '/') {
            result.push(`window.socketPath = ${JSON.stringify(this.publicPath)};`);
        }
        if (uuid?.length === 38) {
            result.push(`window.vendorPrefix = "${uuid.substring(0, 2)}";`);
        }
        if (this.adapter.config.loadingBackgroundColor) {
            result.push(`window.loadingBackgroundColor = "${this.adapter.config.loadingBackgroundColor}";`);
        }
        if (this.adapter.config.loadingBackgroundImage) {
            result.push(`window.loadingBackgroundImage = "${this.adapter.config.loadingBackgroundImage}";`);
        }
        return result.join('\n');
    }
    /*
        force load _socket/info.js so window.socketPath is set for adapters that do not load info.js themselves.
        (typically tab.html and index.html (admin instance settings page) for non json-config adapters)
     */
    withInfoJs(url, body) {
        if (this.publicPath === '/' || !/\.html?$/i.test(url.split('?')[0])) {
            return body;
        }
        let html = typeof body === 'string' ? body : body.toString('utf8');
        if (html.includes('_socket/info.js') || html.includes('window.socketPath')) {
            return body;
        }
        const script = `<script src="${this.publicPath}_socket/info.js"></script>`;
        html = /<head>/i.test(html) ? html.replace(/<head>/i, match => `${match}${script}`) : script + html;
        return html;
    }
    getErrorRedirect(origin) {
        // LOGIN_PAGE /index.html?login
        // origin can be "?login&href=" -
        // or "/?login&href=" -
        //
        if (origin) {
            const parts = origin.split('&');
            if (!parts.includes('error')) {
                parts.splice(1, 0, 'error');
                origin = parts.join('&');
            }
            if (origin.startsWith('?login')) {
                return this.loginPage + origin.substring(6);
            }
            if (origin.startsWith('/?login')) {
                return this.loginPage + origin.substring(7);
            }
            if (origin.startsWith(this.loginPage)) {
                return origin;
            }
            return this.loginPage + origin;
        }
        return `${this.loginPage}&error`;
    }
    /**
     * Compile the JSON schema for `jsonConfig.json` or for a JSON tab and cache the result,
     * as the schema is quite big and it is used with every opened config page or tab
     *
     * @param type `config` for `admin/jsonConfig.json(5)`, `tab` for the JSON file of an admin tab
     */
    async getJsonValidator(type) {
        if (this.jsonValidators[type]) {
            return this.jsonValidators[type];
        }
        let schema;
        try {
            this.adapter.log.debug(`retrieving json schema from ${this.JSON_CONFIG_SCHEMA_URL}`);
            const downloaded = await (0, eosHttpsClient_1.requestHttpsJson)(this.JSON_CONFIG_SCHEMA_URL, {
                allowedHosts: ['raw.githubusercontent.com'],
                maxBytes: 1024 * 1024,
                budgetMs: 5000,
            });
            if (!downloaded || typeof downloaded !== 'object' || Array.isArray(downloaded)) {
                throw new Error('Invalid JSON configuration schema');
            }
            schema = downloaded;
        }
        catch (e) {
            this.adapter.log.debug(`Could not get jsonConfig schema: ${e.message}`);
            return null;
        }
        if (type === 'tab') {
            adaptSchemaForTab(schema);
        }
        try {
            const ajv = new ajv_1.Ajv({
                allErrors: false,
                strict: 'log',
            });
            this.jsonValidators[type] = ajv.compile(schema);
            return this.jsonValidators[type];
        }
        catch (e) {
            this.adapter.log.debug(`Could not compile jsonConfig schema: ${e.message}`);
            return null;
        }
    }
    /**
     * Read one of the given files from the `admin` folder of an adapter.
     * The files are read from the objects DB first, so that adapters on other hosts are covered too,
     * and only if they were never uploaded, from the local installation.
     *
     * @param adapterName name of the adapter
     * @param fileNames possible file names. The first existing file is returned
     */
    async readAdminFile(adapterName, fileNames) {
        for (const fileName of fileNames) {
            try {
                // this.adapter.readFile is sanitized
                if (await this.adapter.fileExists(`${adapterName}.admin`, fileName)) {
                    const { file } = await this.adapter.readFileAsync(`${adapterName}.admin`, fileName);
                    if (file) {
                        return { fileName, text: file.toString() };
                    }
                }
            }
            catch {
                // try the next file or the local installation
            }
        }
        try {
            const adapterPath = (0, node_path_1.dirname)(require.resolve(`iobroker.${adapterName}/package.json`));
            for (const fileName of fileNames) {
                const filePath = (0, node_path_1.join)(adapterPath, 'admin', fileName);
                if ((0, node_fs_1.existsSync)(filePath)) {
                    return { fileName, text: (0, node_fs_1.readFileSync)(filePath, { encoding: 'utf-8' }) };
                }
            }
        }
        catch {
            // the adapter is not installed on this host
        }
        return null;
    }
    /**
     * Validate the JSON configuration or the JSON tab of an adapter against the current schema
     *
     * @param adapterName name of the adapter
     * @param type `config` for `admin/jsonConfig.json(5)`, `tab` for the JSON file of an admin tab
     */
    async validateJsonConfig(adapterName, type = 'config') {
        const res = await this.adapter.getForeignObjectAsync(`system.adapter.${adapterName}`);
        if (!res) {
            return;
        }
        let fileNames;
        if (type === 'tab') {
            // Like the front-end (see `CustomTab`), a tab is a JSON config if its link points to a JSON file.
            // The name is free and relative to the `admin` folder. Every other link is a page or an external URL.
            const link = (res.common.adminTab?.link || '').split('?')[0];
            if ((!link.endsWith('.json') && !link.endsWith('.json5')) ||
                link.includes('..') ||
                link.includes('://') ||
                link.includes('%')) {
                return;
            }
            fileNames = [link];
        }
        else {
            if (res.common.adminUI?.config !== 'json') {
                return;
            }
            fileNames = ['jsonConfig.json', 'jsonConfig.json5'];
        }
        const validate = await this.getJsonValidator(type);
        if (!validate) {
            return;
        }
        try {
            const jsonConf = await this.readAdminFile(adapterName, fileNames);
            if (!jsonConf) {
                this.adapter.log.debug(`Cannot find ${fileNames.join(' or ')} of ${adapterName}`);
                return;
            }
            if (!validate((0, json5_1.parse)(jsonConf.text))) {
                this.adapter.log.warn(`${adapterName} has an invalid ${type === 'tab' ? jsonConf.fileName : 'jsonConfig'}: ${JSON.stringify(validate.errors)}`);
            }
        }
        catch (e) {
            this.adapter.log.debug(`Error validating schema of ${adapterName}: ${e.message}`);
        }
    }
    /** Buffers sent via sendTo arrive serialized; reject malformed or excessive payloads. */
    static toBuffer(data) {
        const maxBytes = 32 * 1024 * 1024;
        if (Buffer.isBuffer(data)) {
            if (data.length > maxBytes) {
                throw new Error('Log exceeds the transfer limit');
            }
            return data;
        }
        if (typeof data === 'string') {
            if (Buffer.byteLength(data, 'utf8') > maxBytes) {
                throw new Error('Log exceeds the transfer limit');
            }
            return Buffer.from(data, 'utf8');
        }
        if (data &&
            typeof data === 'object' &&
            'type' in data &&
            data.type === 'Buffer' &&
            'data' in data &&
            Array.isArray(data.data) &&
            data.data.length <= maxBytes &&
            data.data.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
            return Buffer.from(data.data);
        }
        throw new Error('Invalid serialized log buffer');
    }
    async sendRemoteLog(fileName, result, res) {
        if (!result ||
            typeof result !== 'object' ||
            ('error' in result && result.error) ||
            !('data' in result) ||
            result.data === undefined ||
            result.data === null) {
            res.status(404).send(this.get404Page('File %s not found', fileName));
            return;
        }
        const data = Web.toBuffer(result.data);
        if ('gz' in result && result.gz === true) {
            if (data.length > 1024 * 1024) {
                res.header('Content-Type', 'application/gzip');
                res.send(data);
            }
            else {
                await this.unzipFile(fileName, data, res);
            }
        }
        else if (data.length > 2 * 1024 * 1024) {
            res.header('Content-Type', 'text/plain');
            res.send(data.toString('utf8'));
        }
        else {
            res.header('Content-Type', 'text/html');
            res.send(this.decorateLogFile(fileName, data.toString('utf8')));
        }
    }
    async unzipFile(fileName, data, res) {
        // extract the file
        try {
            const text = await (0, eosWebResources_1.inflateLog)(data);
            if (text.length > 2 * 1024 * 1024) {
                res.header('Content-Type', 'text/plain');
                res.send(text);
            }
            else {
                res.header('Content-Type', 'text/html');
                res.send(this.decorateLogFile(fileName, text));
            }
        }
        catch {
            res.header('Content-Type', 'application/gzip');
            res.send(data);
            this.adapter.log.warn('Compressed log preview unavailable; original gzip returned.');
        }
    }
    normalizeEosGroupId(value) {
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
    normalizeEosUserId(value) {
        if (!value) {
            return null;
        }
        let candidate = value;
        if (value && typeof value === 'object') {
            const identity = value;
            candidate = identity.id || identity._id || identity.user || identity.name;
        }
        if (typeof candidate !== 'string') {
            return null;
        }
        let user = candidate.trim();
        if (!user) {
            return null;
        }
        if (!user.startsWith('system.user.')) {
            user = `system.user.${user.replace(/^user\./, '')}`;
        }
        return /^system\.user\.[a-z0-9_.-]+$/i.test(user) ? user : null;
    }
    normalizeEosAdapterName(value) {
        if (typeof value !== 'string') {
            return null;
        }
        let adapter = value.trim().toLowerCase();
        if (!adapter) {
            return null;
        }
        adapter = adapter
            .replace(/^system\.adapter\./, '')
            .replace(/^iobroker\./, '')
            .replace(/^@nexowatt\/iobroker\./, '')
            .replace(/^@nexowatt\//, '');
        adapter = adapter.replace(/\.\d+$/, '');
        return /^[a-z0-9_-]+$/.test(adapter) ? adapter : null;
    }
    getEosSecurityAdminGroups() {
        const configured = [
            this.settings.eosAdminOnlyGroups,
            this.settings.eosSecurityAdminGroups,
            this.settings.eosAdminOnlyGroup,
            this.settings.eosServiceGroups,
            this.settings.eosNexoWattServiceGroups,
        ];
        const groups = new Set();
        const add = (value) => {
            if (!value) {
                return;
            }
            if (Array.isArray(value)) {
                value.forEach(add);
                return;
            }
            if (typeof value === 'object') {
                const row = value;
                if (row.enabled === false) {
                    return;
                }
                add(row.group || row.id || row.name);
                return;
            }
            const group = this.normalizeEosGroupId(value);
            if (group) {
                groups.add(group);
            }
        };
        add(configured);
        groups.add('system.group.administrator');
        // NexoWatt-specific service groups are full administrator/service roles.
        // Generic installer/service wording is never enough to grant full access.
        groups.add('system.group.nexowatt-service');
        groups.add('system.group.eos-service');
        return [...groups].sort();
    }
    getEosProtectedAdapterNames() {
        // v47: frontend delete protection is core-only. Ignore old eosProtectedAdapters
        // settings so normal installed adapters/instances remain deletable.
        return [...new Set(CORE_PROTECTED_ADAPTER_NAMES)].sort();
    }
    readAccessTokenFromRequest(req) {
        const cookieHeader = req.headers.cookie || '';
        const accessCookie = cookieHeader
            .split(';')
            .map(cookie => cookie.trim())
            .find(cookie => cookie.startsWith('access_token='));
        let token = accessCookie ? accessCookie.split('=').slice(1).join('=') : '';
        if (!token && req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.substring('Bearer '.length);
        }
        if (!token) {
            return null;
        }
        try {
            token = decodeURIComponent(token);
        }
        catch {
            // keep raw token
        }
        token = token.trim();
        if (token.startsWith('Bearer ')) {
            token = token.substring('Bearer '.length).trim();
        }
        if (token.startsWith('s:')) {
            token = token.substring(2);
        }
        // Express signed cookies are encoded as s:<token>.<signature>. ioBroker tokens are not JWTs.
        if (token.includes('.') && !token.startsWith('eyJ')) {
            token = token.substring(0, token.indexOf('.'));
        }
        return token || null;
    }
    readSession(id) {
        return new Promise(resolve => this.adapter.getSession(id, token => resolve(token)));
    }
    async readEosCurrentUser(req) {
        if (this.settings.auth !== true) {
            return null;
        }
        const enabledUser = async (candidate) => {
            const userId = this.normalizeEosUserId(candidate);
            if (!userId) {
                return null;
            }
            const user = (await this.adapter
                .getForeignObjectAsync(userId)
                .catch(() => null));
            return user?.type === 'user' && user.common?.enabled !== false ? userId : null;
        };
        // req.user is set only by the upstream authenticated middleware, never by body/query input.
        if (req.user) {
            return enabledUser(req.user);
        }
        const token = this.readAccessTokenFromRequest(req);
        if (!token || token.length < 16 || token.length > 4096) {
            return null;
        }
        // Only the actual access-token namespace is accepted. Refresh sessions and shortened
        // candidate tokens must never authenticate a protected EOS endpoint.
        const id = token.startsWith('a:') ? token : `a:${token}`;
        const session = await this.readSession(id).catch(() => null);
        if (!session ||
            typeof session.aExp !== 'number' ||
            !Number.isFinite(session.aExp) ||
            session.aExp <= Date.now()) {
            return null;
        }
        return enabledUser(session.user);
    }
    getEosConfiguredRoleGroups(...keys) {
        const groups = new Set();
        const add = (value) => {
            if (!value) {
                return;
            }
            if (Array.isArray(value)) {
                value.forEach(add);
                return;
            }
            if (typeof value === 'object') {
                const row = value;
                if (row.enabled === false) {
                    return;
                }
                add(row.group || row.id || row.name);
                return;
            }
            const group = this.normalizeEosGroupId(value);
            if (group) {
                groups.add(group);
            }
        };
        const settings = { ...this.settings };
        keys.forEach(key => add(settings[key]));
        return [...groups].sort();
    }
    getEosInstallerGroups() {
        const groups = new Set(this.getEosConfiguredRoleGroups('eosInstallerGroups', 'eosInstallateurGroups', 'eosCommissioningGroups'));
        groups.add('system.group.installateur');
        groups.add('system.group.installateure');
        groups.add('system.group.installer');
        groups.add('system.group.techniker');
        groups.add('system.group.inbetriebnahme');
        groups.add('system.group.integrator');
        return [...groups].sort();
    }
    getEosEndUserGroups() {
        const groups = new Set(this.getEosConfiguredRoleGroups('eosEndUserGroups', 'eosEndkundeGroups', 'eosCustomerGroups'));
        groups.add('system.group.endkunde');
        groups.add('system.group.endkunden');
        groups.add('system.group.kunde');
        groups.add('system.group.kunden');
        groups.add('system.group.user');
        groups.add('system.group.users');
        return [...groups].sort();
    }
    getTranslatedName(value) {
        if (!value) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        return String(value.de || value.en || Object.values(value)[0] || '');
    }
    async getEosGroupDetailsForUser(userId) {
        const groups = [];
        try {
            const result = await this.adapter.getObjectViewAsync('system', 'group', {
                startkey: 'system.group.',
                endkey: 'system.group.香',
            });
            for (const row of result.rows) {
                const group = row.value;
                const members = Array.isArray(group?.common?.members) ? group.common.members : [];
                if (members.includes(userId)) {
                    groups.push({
                        id: row.id,
                        name: this.getTranslatedName(group?.common?.name),
                        desc: this.getTranslatedName(group?.common?.desc),
                    });
                }
            }
        }
        catch (e) {
            this.adapter.log.debug(`Cannot resolve EOS security groups for ${userId}: ${e instanceof Error ? e.message : 'unknown error'}`);
        }
        return groups.sort((a, b) => a.id.localeCompare(b.id));
    }
    async getEosGroupsForUser(userId) {
        return (await this.getEosGroupDetailsForUser(userId)).map(group => group.id);
    }
    normalizeEosRoleText(value) {
        return (typeof value === 'string' ? value : '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/^system\.group\./, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }
    resolveEosRole(userId, groups, groupNames, adminGroups) {
        if (userId === 'system.user.admin' ||
            groups.includes('system.group.administrator') ||
            groups.some(group => adminGroups.includes(group))) {
            return 'admin';
        }
        const installerGroups = this.getEosInstallerGroups();
        if (groups.some(group => installerGroups.includes(group))) {
            return 'installer';
        }
        const endUserGroups = this.getEosEndUserGroups();
        if (groups.some(group => endUserGroups.includes(group))) {
            return 'enduser';
        }
        // Display names and descriptions are presentation data, never role credentials.
        // Secure default: a normal authenticated, non-admin ioBroker user is an EOS end user.
        return 'enduser';
    }
    async getEosAccessForUserId(userId) {
        const groupDetails = userId ? await this.getEosGroupDetailsForUser(userId) : [];
        const groups = groupDetails.map(group => group.id);
        const groupNames = groupDetails.flatMap(group => [group.name, group.desc]).filter(Boolean);
        const adminGroups = this.getEosSecurityAdminGroups();
        const role = this.resolveEosRole(userId, groups, groupNames, adminGroups);
        return { userId, groupDetails, groups, groupNames, adminGroups, role };
    }
    async getEosRequestAccess(req) {
        return this.getEosAccessForUserId(await this.readEosCurrentUser(req));
    }
    getEosRoleCapabilities(role) {
        const technical = role === 'admin' || role === 'installer';
        return {
            smartHome: true,
            commissioning: technical,
            troubleshooting: technical,
            adapterManagement: technical,
            instanceManagement: technical,
            objectDiagnostics: technical,
            logDiagnostics: technical,
            basicSystemSettings: technical,
            emsAppCenter: technical,
            simulation: role === 'admin',
            licenseAdministration: role === 'admin',
            fullSystemSettings: role === 'admin',
            expertMode: role === 'admin',
            userManagement: role === 'admin',
            accountPasswordReset: role === 'admin' || role === 'installer',
            nexowattBackup: true,
            internalBackupReserve: role === 'admin',
            securityAdministration: role === 'admin',
        };
    }
    getEosFirstLoginPasswordMinLength() {
        const configured = Number(this.settings.eosFirstLoginPasswordMinLength);
        if (!Number.isInteger(configured) || configured < 8 || configured > 64) {
            return 10;
        }
        return configured;
    }
    async getEosFirstLoginPasswordState(userId, role) {
        const minLength = this.getEosFirstLoginPasswordMinLength();
        if (!this.settings.auth || !userId || role === 'admin') {
            return { required: false, initialized: true, minLength, version: 1 };
        }
        try {
            const userObject = (await this.adapter.getForeignObjectAsync(userId));
            const native = (userObject?.native || {});
            const account = (native.nexowattEosAccount || {});
            const initialized = account.passwordInitialized === true ||
                Number(account.passwordSetupVersion || account.passwordInitializationVersion || 0) >= 1;
            const stableForced = native.nexowattPasswordChangeRequired === true ||
                native.eosPasswordChangeRequired === true ||
                native.nexowattFirstLoginPending === true ||
                native.eosFirstLoginRequired === true;
            const forced = account.forcePasswordChange === true || stableForced;
            return { required: forced || !initialized, initialized: initialized && !forced, minLength, version: 1 };
        }
        catch (e) {
            this.adapter.log.warn(`Cannot read EOS first-login state for ${userId}: ${e instanceof Error ? e.message : 'unknown error'}`);
            // Fail closed for non-admin accounts: do not grant the full UI while the account
            // initialization state cannot be verified.
            return { required: true, initialized: false, minLength, version: 1 };
        }
    }
    validateEosFirstLoginPassword(password, passwordRepeat, userId) {
        const value = typeof password === 'string' ? password : '';
        const repeat = typeof passwordRepeat === 'string' ? passwordRepeat : '';
        const minLength = this.getEosFirstLoginPasswordMinLength();
        if (!value || !repeat) {
            return { valid: false, error: 'passwordRequired' };
        }
        if (value !== repeat) {
            return { valid: false, error: 'passwordMismatch' };
        }
        if (value.length < minLength || value.length > 128) {
            return { valid: false, error: 'passwordLength' };
        }
        if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
            return { valid: false, error: 'passwordComplexity' };
        }
        const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
        const userName = userId
            .replace(/^system\.user\./, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
        if ([
            'password',
            'passwort',
            'nexowatt',
            'installer',
            'installateur',
            'endkunde',
            'administrator',
            '12345678',
            '1234567890',
        ].includes(normalized) ||
            (userName.length >= 4 && normalized.includes(userName))) {
            return { valid: false, error: 'passwordTooEasy' };
        }
        return { valid: true, password: value };
    }
    getEosPasswordUserName(userId) {
        const userName = String(userId || '')
            .trim()
            .replace(/^system\.user\./, '');
        if (!/^[A-Za-z0-9_.@-]+$/.test(userName)) {
            throw new Error('invalidPasswordTarget');
        }
        return userName;
    }
    async setEosUserPassword(userId, password) {
        // ioBroker's password API expects the account name (for example "user"), not the
        // object id ("system.user.user"). Supplying the object id can return without changing
        // the password on some controller versions. Always normalize to the real account name.
        const userName = this.getEosPasswordUserName(userId);
        // The server-side Admin/Service context performs the controller password write, so managed
        // Installer and End User accounts do not need global users.write rights in the browser.
        const options = { user: EOS_PASSWORD_SERVICE_USER };
        if (!this.adapter.eosSessionSecurity) {
            throw new Error('sessionSecurityUnavailable');
        }
        this.adapter.eosSessionSecurity.revoke();
        this.invalidateProxySessions();
        if (typeof this.adapter.setPasswordAsync === 'function') {
            await this.adapter.setPasswordAsync(userName, password, options);
        }
        else if (typeof this.adapter.setPassword === 'function') {
            await new Promise((resolve, reject) => {
                void Promise.resolve(this.adapter.setPassword(userName, password, options, error => (error ? reject(error) : resolve()))).catch(reject);
            });
        }
        else {
            throw new Error('passwordApiUnavailable');
        }
        // Verify the write with the controller API whenever it is exposed. This prevents the
        // UI from reporting success while the object database still contains the old hash.
        if (typeof this.adapter.checkPasswordAsync === 'function') {
            const result = await this.adapter.checkPasswordAsync(userName, password, options);
            const valid = Array.isArray(result) ? result[0] === true : result === true;
            if (!valid) {
                throw new Error('passwordVerificationFailed');
            }
            return;
        }
        // Compatibility fallback for older controllers: require a non-empty stored password hash.
        const userObject = (await this.adapter.getForeignObjectAsync(userId));
        if (!String(userObject?.common?.password || '').trim()) {
            throw new Error('passwordWriteFailed');
        }
    }
    async updateEosAccountMetadata(userId, updater) {
        const userObject = (await this.adapter.getForeignObjectAsync(userId));
        if (!userObject) {
            throw new Error('userObjectUnavailableAfterPasswordChange');
        }
        const native = { ...(userObject.native || {}) };
        const account = { ...(native.nexowattEosAccount || {}) };
        native.nexowattEosAccount = account;
        updater(native, account);
        // Extend only the EOS metadata. Replacing the complete user object here could overwrite the
        // password hash which was just written by setPasswordAsync/changePassword.
        await this.adapter.extendForeignObjectAsync(userId, { native }, { user: EOS_PASSWORD_SERVICE_USER });
    }
    async destroyEosRequestSessions(req) {
        const token = this.readAccessTokenFromRequest(req);
        if (!token || typeof this.adapter.destroySession !== 'function') {
            return;
        }
        // Depending on the authentication path, the same session can be addressed by the raw
        // token or by the adapter-session prefix. Remove every supported representation so a
        // password change cannot leave the old authenticated browser session active.
        const sessionIds = new Set([token, token.startsWith('a:') ? token : `a:${token}`]);
        await Promise.all([...sessionIds].map(async (id) => {
            try {
                await this.adapter.destroySession(id);
            }
            catch {
                this.adapter.log.debug('Cannot destroy EOS first-login session');
            }
        }));
    }
    async saveEosFirstLoginPassword(req, res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const access = await this.getEosRequestAccess(req);
        if (!access.userId || access.role === 'admin') {
            res.status(403).json({ error: 'passwordSetupNotAllowed' });
            return;
        }
        if (!this.isEosSameOriginWrite(req) || req.headers['x-nexowatt-eos-first-login'] !== '1') {
            res.status(403).json({ error: 'invalidRequestOrigin' });
            return;
        }
        const passwordState = await this.getEosFirstLoginPasswordState(access.userId, access.role);
        if (!passwordState.required) {
            res.status(200).json({ success: true, alreadyInitialized: true });
            return;
        }
        const body = (req.body || {});
        if (typeof body.currentPassword !== 'string' || !body.currentPassword || body.currentPassword.length > 128) {
            res.status(400).json({ error: 'currentPasswordRequired' });
            return;
        }
        if (typeof this.adapter.checkPasswordAsync !== 'function') {
            res.status(503).json({ error: 'passwordVerificationUnavailable' });
            return;
        }
        // A session issued before administrative reset cannot claim the new password without
        // proving possession of the current random temporary credential.
        const check = await this.adapter.checkPasswordAsync(this.getEosPasswordUserName(access.userId), body.currentPassword, { user: EOS_PASSWORD_SERVICE_USER });
        if (!(Array.isArray(check) ? check[0] === true : check === true)) {
            res.status(403).json({ error: 'currentPasswordInvalid' });
            return;
        }
        const validation = this.validateEosFirstLoginPassword(body.password, body.passwordRepeat, access.userId);
        if (!validation.valid) {
            res.status(400).json({
                error: validation.error,
                minLength: passwordState.minLength,
            });
            return;
        }
        await this.setEosUserPassword(access.userId, validation.password);
        const now = new Date().toISOString();
        await this.updateEosAccountMetadata(access.userId, (native, account) => {
            account.passwordInitialized = true;
            account.passwordInitializedAt = Date.now();
            account.passwordInitializationVersion = 1;
            account.passwordInitializedBy = 'self';
            account.passwordSetupVersion = 1;
            account.passwordSetAt = now;
            account.firstLoginCompletedAt = now;
            account.forcePasswordChange = false;
            account.passwordlessFirstLoginAllowed = false;
            native.nexowattPasswordChangeRequired = false;
            native.eosPasswordChangeRequired = false;
            native.nexowattFirstLoginPending = false;
            native.eosFirstLoginRequired = false;
            native.nexowattInitialPasswordApplied = false;
            native.nexowattPasswordChangedAt = now;
        });
        await this.destroyEosRequestSessions(req);
        for (const cookie of ['access_token', 'refresh_token', 'connect.sid']) {
            res.clearCookie(cookie);
        }
        this.adapter.log.info(`EOS first-login password initialized for ${access.userId}`);
        res.status(200).json({ success: true, role: access.role, logoutRequired: true, sessionInvalidated: true });
    }
    denyEosAnonymousActivation(res) {
        // Old configuration flags and previously issued claims cannot reactivate this path.
        res.setHeader('Cache-Control', 'no-store');
        res.clearCookie('nexowatt_eos_first_login', { path: '/nexowatt/account' });
        res.status(410).json({ error: 'passwordlessActivationDisabled', eligible: false });
    }
    getEosPasswordlessFirstLoginStatus(_req, res) {
        return Promise.resolve().then(() => this.denyEosAnonymousActivation(res));
    }
    startEosPasswordlessFirstLogin(_req, res) {
        return Promise.resolve().then(() => this.denyEosAnonymousActivation(res));
    }
    saveEosPasswordlessFirstLogin(_req, res) {
        return Promise.resolve().then(() => this.denyEosAnonymousActivation(res));
    }
    async getEosManagedAccounts(requesterRole) {
        const users = new Map();
        const collect = async (role, groupIds) => {
            for (const groupId of groupIds) {
                const group = (await this.adapter.getForeignObjectAsync(groupId));
                for (const userId of group?.common?.members || []) {
                    const current = users.get(userId);
                    if (!current || role === 'installer') {
                        users.set(userId, role);
                    }
                }
            }
        };
        await collect('enduser', this.getEosEndUserGroups());
        await collect('installer', this.getEosInstallerGroups());
        const result = [];
        for (const [userId, role] of [...users.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            if (requesterRole === 'installer' && role !== 'enduser') {
                continue;
            }
            const user = (await this.adapter.getForeignObjectAsync(userId));
            if (!user || userId === 'system.user.admin') {
                continue;
            }
            const native = (user.native || {});
            const account = (native.nexowattEosAccount || {});
            const setup = await this.getEosFirstLoginPasswordState(userId, role);
            result.push({
                id: userId,
                userName: userId.replace(/^system\.user\./, ''),
                displayName: this.getTranslatedName(user.common?.name),
                role,
                enabled: user.common?.enabled !== false,
                migrationDisabled: account.disabledForCredentialMigration === true,
                firstLoginRequired: setup.required,
                passwordInitialized: setup.initialized,
                passwordlessFirstLoginAllowed: false,
                passwordSetAt: account.passwordSetAt || account.firstLoginCompletedAt || null,
                passwordResetAt: account.passwordResetAt || null,
                passwordResetBy: account.passwordResetBy || null,
            });
        }
        return result;
    }
    async sendEosAccountManagement(req, res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const access = await this.getEosRequestAccess(req);
        if (!access.userId || (access.role !== 'admin' && access.role !== 'installer')) {
            res.status(403).json({ error: 'permissionError' });
            return;
        }
        res.status(200).json({
            role: access.role,
            canResetInstaller: access.role === 'admin',
            canResetEndUser: true,
            accounts: await this.getEosManagedAccounts(access.role),
        });
    }
    async resetEosAccountPassword(req, res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const access = await this.getEosRequestAccess(req);
        if (!access.userId || (access.role !== 'admin' && access.role !== 'installer')) {
            res.status(403).json({ error: 'permissionError' });
            return;
        }
        if (!this.isEosSameOriginWrite(req) || req.headers['x-nexowatt-eos-account-reset'] !== '1') {
            res.status(403).json({ error: 'invalidRequestOrigin' });
            return;
        }
        const targetUserId = this.normalizeEosUserId(req.body?.user);
        if (!targetUserId || targetUserId === 'system.user.admin' || targetUserId === access.userId) {
            res.status(400).json({ error: 'invalidTarget' });
            return;
        }
        const targetAccess = await this.getEosAccessForUserId(targetUserId);
        const explicitInstaller = targetAccess.groups.some(group => this.getEosInstallerGroups().includes(group));
        const explicitEndUser = targetAccess.groups.some(group => this.getEosEndUserGroups().includes(group));
        const explicitlyManagedRole = explicitInstaller
            ? 'installer'
            : explicitEndUser
                ? 'enduser'
                : null;
        if (targetAccess.role === 'admin' ||
            !explicitlyManagedRole ||
            (access.role === 'installer' && explicitlyManagedRole !== 'enduser')) {
            // Never rely on the secure-default "enduser" classification for a password reset. The
            // target must be an explicit member of a managed EOS installer/end-user group.
            res.status(403).json({ error: 'permissionError' });
            return;
        }
        const currentUser = (await this.adapter.getForeignObjectAsync(targetUserId));
        if (!currentUser) {
            res.status(404).json({ error: 'accountNotFound' });
            return;
        }
        const accountMetadata = currentUser.native?.nexowattEosAccount;
        const migrationDisabled = !!accountMetadata &&
            typeof accountMetadata === 'object' &&
            'disabledForCredentialMigration' in accountMetadata &&
            accountMetadata.disabledForCredentialMigration === true;
        if (currentUser.common?.enabled === false && (!migrationDisabled || access.role !== 'admin')) {
            res.status(409).json({ error: 'accountDisabled' });
            return;
        }
        const temporaryPassword = `${(0, node_crypto_1.randomBytes)(24).toString('base64url')}!aA1`;
        await this.setEosUserPassword(targetUserId, temporaryPassword);
        const now = new Date().toISOString();
        await this.updateEosAccountMetadata(targetUserId, (native, account) => {
            account.passwordInitialized = false;
            account.passwordSetupVersion = 0;
            account.passwordInitializationVersion = 0;
            account.forcePasswordChange = true;
            account.passwordlessFirstLoginAllowed = false;
            account.passwordResetAt = now;
            account.passwordResetBy = access.userId;
            account.passwordResetMode = 'unique-temporary-password';
            account.disabledForCredentialMigration = false;
            account.passwordSetAt = null;
            account.firstLoginCompletedAt = null;
            native.nexowattPasswordChangeRequired = true;
            native.eosPasswordChangeRequired = true;
            native.nexowattFirstLoginPending = true;
            native.eosFirstLoginRequired = true;
            native.nexowattInitialPasswordApplied = true;
            native.nexowattInitialPasswordVersion = 1;
            native.nexowattStableInitialCredentialVersion = 1;
        });
        if (migrationDisabled) {
            await this.adapter.extendForeignObjectAsync(targetUserId, { common: { enabled: true } }, { user: EOS_PASSWORD_SERVICE_USER });
        }
        this.adapter.log.warn(`EOS account ${targetUserId} was reset to the mandatory initial-password flow by ${access.userId}`);
        res.status(200).json({
            success: true,
            user: targetUserId,
            role: explicitlyManagedRole,
            firstLoginRequired: true,
            passwordlessFirstLoginAllowed: false,
            initialPasswordRequired: true,
            temporaryPassword,
        });
    }
    async getEosHistoryInstances() {
        try {
            const instances = await this.adapter.getObjectViewAsync('system', 'instance', {
                startkey: 'system.adapter.',
                endkey: 'system.adapter.香',
            });
            return (instances.rows || [])
                .map(row => row.value)
                .filter(instance => !!instance?.common?.getHistory)
                .map(instance => instance._id.replace(/^system\.adapter\./, ''))
                .sort();
        }
        catch (e) {
            this.adapter.log.debug(`Cannot read history instances for EOS basic settings: ${e instanceof Error ? e.message : 'unknown error'}`);
            return [];
        }
    }
    async sendEosBasicSettings(req, res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const access = await this.getEosRequestAccess(req);
        if (access.role !== 'installer' && access.role !== 'admin') {
            res.status(403).json({ error: 'permissionError', role: access.role });
            return;
        }
        const systemConfig = (await this.adapter.getForeignObjectAsync('system.config'));
        const common = systemConfig?.common || {};
        const histories = await this.getEosHistoryInstances();
        res.status(200).json({
            role: access.role,
            editable: access.role === 'installer' || access.role === 'admin',
            settings: {
                siteName: common.siteName || '',
                language: common.language || 'de',
                tempUnit: common.tempUnit || '°C',
                currency: common.currency || '€',
                dateFormat: common.dateFormat || 'DD.MM.YYYY',
                isFloatComma: common.isFloatComma !== false,
                defaultHistory: common.defaultHistory || '',
                defaultLogLevel: common.defaultLogLevel || 'info',
                firstDayOfWeek: common.firstDayOfWeek || 'monday',
                country: common.country || '',
                city: common.city || '',
                latitude: Number(common.latitude || 0),
                longitude: Number(common.longitude || 0),
            },
            options: {
                languages: ['de', 'en', 'nl', 'fr', 'it', 'es', 'pl', 'pt', 'ru', 'uk', 'zh-cn'],
                tempUnits: ['°C', '°F'],
                dateFormats: ['DD.MM.YYYY', 'YYYY.MM.DD', 'MM/DD/YYYY'],
                firstDaysOfWeek: ['monday', 'sunday'],
                logLevels: ['debug', 'info', 'warn', 'error'],
                histories: ['', ...histories],
            },
            hiddenAdminAreas: [
                'repositories',
                'licenses',
                'certificates',
                'credentials',
                'letsEncrypt',
                'defaultAcl',
                'expertMode',
            ],
        });
    }
    getNexoWattStableUpdateManager() {
        this.nexowattStableUpdateManager ||= new eosAutoUpdate_1.NexoWattStableUpdateManager(this.adapter);
        return this.nexowattStableUpdateManager;
    }
    async sendNexoWattStableUpdateStatus(req, res) {
        const access = await this.getEosRequestAccess(req);
        if (access.role !== 'admin') {
            res.status(403).json({ error: 'permissionError' });
            return;
        }
        res.status(200).json(await this.getNexoWattStableUpdateManager().getStatus(false));
    }
    async saveNexoWattStableUpdateSettings(req, res) {
        const access = await this.getEosRequestAccess(req);
        if (access.role !== 'admin') {
            res.status(403).json({ error: 'permissionError' });
            return;
        }
        if (req.headers['x-nexowatt-eos-auto-update'] !== '1' || !this.isEosSameOriginWrite(req)) {
            res.status(403).json({ error: 'invalidRequest' });
            return;
        }
        if (typeof req.body?.enabled !== 'boolean') {
            res.status(400).json({ error: 'invalidEnabledValue' });
            return;
        }
        res.status(200).json(await this.getNexoWattStableUpdateManager().setEnabled(req.body.enabled));
    }
    isEosSameOriginWrite(req) {
        // This profile terminates TLS here; untrusted proxy headers cannot change the scheme.
        return (0, eosRequestSecurity_1.isEosSameOriginRequest)(req.headers, this.settings.secure === true ? 'https:' : 'http:');
    }
    async saveEosBasicSettings(req, res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const access = await this.getEosRequestAccess(req);
        if (access.role !== 'installer' && access.role !== 'admin') {
            res.status(403).json({ error: 'permissionError', role: access.role });
            return;
        }
        if (!this.isEosSameOriginWrite(req) || req.headers['x-nexowatt-eos-role-settings'] !== '1') {
            res.status(403).json({ error: 'invalidRequestOrigin' });
            return;
        }
        const input = (req.body?.settings ||
            req.body ||
            {});
        const systemConfig = (await this.adapter.getForeignObjectAsync('system.config'));
        if (!systemConfig?.common) {
            res.status(503).json({ error: 'systemConfigUnavailable' });
            return;
        }
        const next = { ...systemConfig, common: { ...systemConfig.common } };
        const common = { ...next.common };
        const setString = (key, maxLength, allowed) => {
            if (!(key in input)) {
                return;
            }
            const inputValue = input[key];
            if (typeof inputValue !== 'string' && typeof inputValue !== 'number' && typeof inputValue !== 'boolean') {
                return;
            }
            const value = String(inputValue).trim().slice(0, maxLength);
            if (!allowed || allowed.includes(value)) {
                common[key] = value;
            }
        };
        const setCoordinate = (key, min, max) => {
            if (!(key in input)) {
                return;
            }
            const value = Number(input[key]);
            if (Number.isFinite(value) && value >= min && value <= max) {
                common[key] = value;
            }
        };
        setString('siteName', 120);
        setString('language', 8, ['de', 'en', 'nl', 'fr', 'it', 'es', 'pl', 'pt', 'ru', 'uk', 'zh-cn']);
        setString('tempUnit', 3, ['°C', '°F']);
        setString('currency', 8);
        setString('dateFormat', 16, ['DD.MM.YYYY', 'YYYY.MM.DD', 'MM/DD/YYYY']);
        if ('isFloatComma' in input) {
            common.isFloatComma =
                input.isFloatComma === true || input.isFloatComma === 'true' || input.isFloatComma === 1;
        }
        const histories = await this.getEosHistoryInstances();
        setString('defaultHistory', 100, ['', ...histories]);
        setString('defaultLogLevel', 8, ['debug', 'info', 'warn', 'error']);
        setString('firstDayOfWeek', 8, ['monday', 'sunday']);
        setString('country', 3);
        setString('city', 120);
        setCoordinate('latitude', -90, 90);
        setCoordinate('longitude', -180, 180);
        // Explicitly ignore every privilege/security field even if a manipulated browser submits it.
        delete common.expertMode;
        common.expertMode = systemConfig.common.expertMode === true;
        common.activeRepo = systemConfig.common.activeRepo;
        common.defaultNewAcl = systemConfig.common.defaultNewAcl;
        Object.assign(next.common, common);
        await this.adapter.setForeignObjectAsync('system.config', next);
        this.adapter.log.info(`EOS installer basic settings updated by ${access.userId || 'unknown user'}`);
        await this.sendEosBasicSettings(req, res);
    }
    getEosReadonlySystemInfo() {
        return (0, eosWebResources_1.readSystemInfo)();
    }
    async sendEosReadonlySystemInfo(req, res) {
        const access = await this.getEosRequestAccess(req);
        const authenticated = !this.settings.auth || !!access.userId;
        if (!authenticated) {
            res.status(401).json({ error: 'authenticationRequired' });
            return;
        }
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(await this.getEosReadonlySystemInfo());
    }
    async sendEosSecuritySession(req, res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const { userId, groups, groupNames, adminGroups, role } = await this.getEosRequestAccess(req);
        const passwordSetup = await this.getEosFirstLoginPasswordState(userId, role);
        const isAdministrator = role === 'admin' && (userId === 'system.user.admin' || groups.includes('system.group.administrator'));
        const isEosAdminGroup = role === 'admin';
        const isInstaller = role === 'installer';
        const isEndUser = role === 'enduser';
        const authenticated = !this.settings.auth || !!userId;
        res.status(200).json({
            authenticated,
            user: userId,
            groups,
            groupNames,
            adminGroups,
            installerGroups: this.getEosInstallerGroups(),
            endUserGroups: this.getEosEndUserGroups(),
            role,
            isAdministrator,
            isEosAdminGroup,
            isInstaller,
            isEndUser,
            isAdmin: isEosAdminGroup,
            mustChangePassword: passwordSetup.required,
            passwordSetup: { ...passwordSetup, userName: userId?.replace(/^system\.user\./, '') || '' },
            capabilities: this.getEosRoleCapabilities(role),
            hideLegacyAdminForNonAdmins: this.settings.eosHideLegacyAdminForNonAdmins !== false &&
                this.settings.eosHideLegacyAdminFromNonAdmins !== false,
            hideLegacyAdminFromNonAdmins: this.settings.eosHideLegacyAdminForNonAdmins !== false &&
                this.settings.eosHideLegacyAdminFromNonAdmins !== false,
            hideLegacyBackupFromNonAdmins: this.settings.eosHideLegacyBackupFromNonAdmins !== false,
            restrictProtectedAdapterControls: this.settings.eosRestrictProtectedAdapterControls !== false,
            legacyAdminAdapter: 'admin',
            legacyAdminInstance: 'admin.0',
            legacyBackupAdapter: LEGACY_BACKUP_ADAPTER_NAME,
            customerBackupAdapters: [...CUSTOMER_BACKUP_ADAPTER_NAMES],
            protectedAdapters: this.getEosProtectedAdapterNames(),
        });
    }
    resetIndexHtml() {
        this.indexHTML = '';
    }
    extractAccessToken(req) {
        const cookies = req.headers.cookie?.split(';').find(c => c.trim().startsWith('access_token='));
        let tokenCookie = cookies?.split('=')[1] || null;
        if (!tokenCookie && req.headers.authorization?.startsWith('Bearer ')) {
            tokenCookie = req.headers.authorization.split(' ')[1];
        }
        return tokenCookie || null;
    }
    async getSessionUser(req) {
        return this.readEosCurrentUser(req);
    }
    async getGroupsForUser(userId) {
        if (!userId) {
            return [];
        }
        try {
            const groups = await this.adapter.getForeignObjectsAsync('system.group.*', 'group');
            return Object.values(groups || {})
                .filter(group => Array.isArray(group?.common?.members) && group.common.members.some(member => member === userId))
                .map(group => group._id)
                .filter(id => !!id);
        }
        catch (e) {
            this.adapter.log.debug(`Cannot read groups for NexoWatt security context: ${e instanceof Error ? e.message : 'unknown error'}`);
            return [];
        }
    }
    async getNexowattSecurityContext(req) {
        const user = await this.getSessionUser(req);
        const groups = await this.getGroupsForUser(user);
        const adminOnlyGroups = this.getEosSecurityAdminGroups();
        const isAdminGroup = user === 'system.user.admin' || adminOnlyGroups.some(group => groups.includes(group));
        const hideLegacyAdmin = this.adapter.config.eosHideLegacyAdminForNonAdmins !== false && !isAdminGroup;
        return {
            user,
            groups,
            adminOnlyGroups,
            isAdminGroup,
            hideLegacyAdmin,
            hideLegacyBackup: this.adapter.config.eosHideLegacyBackupFromNonAdmins !== false && !isAdminGroup,
            legacyBackupAdapter: LEGACY_BACKUP_ADAPTER_NAME,
            customerBackupAdapters: [...CUSTOMER_BACKUP_ADAPTER_NAMES],
            protectedAdapters: this.getEosProtectedAdapterNames(),
        };
    }
    eosAuthenticatedRouteGuard() {
        return (req, res, next) => {
            void (async () => {
                const access = await this.getEosRequestAccess(req);
                if (!access.userId) {
                    res.status(401).json({ error: 'authenticationRequired' });
                    return;
                }
                if ((await this.getEosFirstLoginPasswordState(access.userId, access.role)).required) {
                    res.status(403).json({ error: 'passwordChangeRequired' });
                    return;
                }
                res.locals.eosAuthenticatedUser = access.userId;
                next();
            })().catch(() => res.status(503).json({ error: 'securityContextUnavailable' }));
        };
    }
    eosTechnicalRouteGuard(adminOnly, write = false) {
        return (req, res, next) => {
            void (async () => {
                const access = await this.getEosRequestAccess(req);
                if (!access.userId || (access.role !== 'admin' && (adminOnly || access.role !== 'installer'))) {
                    res.status(403).json({ error: 'permissionError' });
                    return;
                }
                if ((await this.getEosFirstLoginPasswordState(access.userId, access.role)).required) {
                    res.status(403).json({ error: 'passwordChangeRequired' });
                    return;
                }
                if (write && !this.isEosSameOriginWrite(req)) {
                    res.status(403).json({ error: 'invalidRequestOrigin' });
                    return;
                }
                next();
            })().catch(() => res.status(503).json({ error: 'securityContextUnavailable' }));
        };
    }
    getSafeLoginOrigin(req) {
        return (0, eosRequestSecurity_1.safeEosLoginPrefix)(req.url);
    }
    /**
     * Initialize the server
     */
    async #init() {
        if (!this.adapter.eosSessionSecurity || !this.adapter.eosLicenseService) {
            this.adapter.log.error('EOS session and license security must be initialized before HTTP startup');
            this.adapter.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            return;
        }
        const bind = (0, eosWebResources_1.safeWebBind)(this.settings);
        if (bind !== this.settings.bind && !this.settings.secure) {
            this.adapter.log.warn('Plain HTTP is restricted to loopback. Configure TLS before network access; use a local console or SSH tunnel for setup.');
        }
        this.settings = { ...this.settings, bind, auth: true };
        if (this.settings.port) {
            this.server.app = (0, express_1.default)();
            this.server.app.use((0, eosWebResources_1.loopbackHttpGuard)(this.settings.secure));
            // Upstream also accepts query credentials. Reject them before any OAuth or body processing.
            this.server.app.use((req, res, next) => {
                if ((0, eosRequestSecurity_1.hasEosUrlCredentials)(req.query)) {
                    res.setHeader('Cache-Control', 'no-store');
                    res.status(400).json({ error: 'credentialsInUrlForbidden' });
                    return;
                }
                next();
            });
            // Streaming proxy responses must not be buffered or recompressed by Admin.
            this.server.app.use((0, compression_1.default)({
                filter: (req, res) => !this.instanceProxy.matches(req.url) && compression_1.default.filter(req, res),
            }));
            this.settings.ttl = Math.round(Number(this.settings.ttl)) || 3_600;
            this.settings.refreshTokenTtlDays = Math.max(1, Math.min(30, Math.round(Number(this.settings.refreshTokenTtlDays)) || 7));
            this.settings.accessAllowedConfigs ||= [];
            this.settings.accessAllowedTabs ||= [];
            this.server.app.disable('x-powered-by');
            // Strip the configured sub-path, so that `ip:8081/admin/x`, `ip:8081/x` and a reverse proxy that
            // does not remove the prefix itself all end on the same routes.
            // Only a real prefix may be removed: `/adapter/admin/admin.svg` contains "/admin/" too.
            if (this.publicPath !== '/') {
                // '/admin/' => '/admin'
                const prefix = this.publicPath.substring(0, this.publicPath.length - 1);
                this.server.app.use((req, _res, next) => {
                    if (req.url === prefix) {
                        req.url = '/';
                    }
                    else if (req.url.startsWith(`${prefix}/`)) {
                        req.url = req.url.substring(prefix.length);
                    }
                    else if (req.url.startsWith(`${prefix}?`)) {
                        req.url = `/${req.url.substring(prefix.length)}`;
                    }
                    next();
                });
            }
            // In front of every route below: an Express middleware only ever sees a request that the
            // routes registered before it passed on, and the OAuth2 routes answer without calling
            // next(). Registered further down, this would leave `/oauth/token` - the one endpoint a
            // cross-origin client has to reach before it owns a token - without a single CORS header,
            // and the browser rejects the answer with `No Access-Control-Allow-Origin header is present`.
            //
            // `*` rather than the reflected origin, and no `Access-Control-Allow-Credentials`: these
            // endpoints authenticate through the request body and the `Authorization` header, never
            // through the `access_token` cookie. Reflecting the origin *and* allowing credentials is
            // what would hand every website a logged-in admin session.
            this.server.app.use((req, res, next) => {
                if (!CORS_ENABLED_PATHS.includes(req.url.split('?')[0])) {
                    next();
                    return;
                }
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
                res.header('Access-Control-Max-Age', '86400');
                if (req.method === 'OPTIONS') {
                    // The routes below answer GET and POST only, so nobody would answer the preflight.
                    res.status(204).end();
                }
                else {
                    next();
                }
            });
            // enable use of i-frames together with HTTPS
            this.server.app.get('/*any', (_req, res, next) => {
                res.header('X-Frame-Options', 'SAMEORIGIN');
                next(); // http://expressjs.com/guide.html#passing-route control
            });
            // ONLY for DEBUG
            /*server.app.use((req: Request, res: Response, next: NextFunction): void => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
                next();
            });*/
            void this.getNexoWattStableUpdateManager()
                .start()
                .catch(error => this.adapter.log.warn(`[NexoWatt stable updates] Startup reconciliation failed: ${error instanceof Error ? error.message : 'unknown error'}`));
            this.server.app.get('/version', (_req, res) => {
                res.status(200).send(this.adapter.version);
            });
            // v36: Repair stale/broken URLs generated by older EOS hard-logout builds.
            this.server.app.use((req, res, next) => {
                const requested = String(req.originalUrl || req.url || '');
                if (/(?:%2f|%252f)(?:%23|%2523)|\/login\/|\/logout\/|hard=1/i.test(requested) &&
                    /index\.html|login|hard=1|origin=|%23|%2523/i.test(requested)) {
                    res.redirect(this.loginPage);
                    return;
                }
                next();
            });
            // replace socket.io
            this.server.app.use((req, res, next) => {
                const url = req.url.split('?')[0];
                // return favicon always
                if (url === '/auth') {
                    // User can ask server if authentication enabled
                    res.setHeader('Content-Type', 'application/json');
                    res.json({ auth: this.settings.auth });
                }
                else if (url === '/favicon.ico') {
                    res.set('Content-Type', 'image/x-icon');
                    if (this.systemConfig.native?.vendor.ico) {
                        // convert base64 to ico
                        const text = this.systemConfig.native.vendor.ico.split(',')[1];
                        res.send(Buffer.from(text, 'base64'));
                        return;
                    }
                    res.send((0, node_fs_1.readFileSync)((0, node_path_1.join)(this.wwwDir, 'favicon.ico')));
                    return;
                }
                else if (socketIoFile !== false && url.includes('socket.io.js')) {
                    if (socketIoFile) {
                        res.contentType('text/javascript');
                        res.status(200).send(socketIoFile);
                        return;
                    }
                    socketIoFile = (0, node_fs_1.readFileSync)((0, node_path_1.join)(this.wwwDir, 'lib', 'js', 'socket.io.js'), {
                        encoding: 'utf-8',
                    });
                    if (socketIoFile) {
                        res.contentType('text/javascript');
                        res.status(200).send(socketIoFile);
                        return;
                    }
                    socketIoFile = false;
                    res.status(404).send(this.get404Page());
                    return;
                }
                next();
            });
            this.server.app.get(/.*\/_socket\/info\.js/, (_req, res) => {
                res.set('Content-Type', 'application/javascript');
                res.status(200).send(this.getInfoJs());
            });
            if (this.settings.auth) {
                AdapterStore = adapter_core_1.commonTools.session(session, this.settings.ttl);
                this.store = new AdapterStore({ adapter: this.adapter });
                this.server.app.use((0, cookie_parser_1.default)());
                // License imports must pass authentication, Origin and rate limits
                // before their small dedicated JSON parser consumes any body.
                const genericUrlencoded = bodyParser.urlencoded({ extended: true });
                const genericJson = bodyParser.json();
                const isLicensePath = (req) => /^\/nexowatt\/license(?:\/|$)/i.test(req.path);
                this.server.app.use((req, res, next) => {
                    if (isLicensePath(req) || this.instanceProxy.matches(req.url)) {
                        next();
                        return;
                    }
                    genericUrlencoded(req, res, next);
                });
                this.server.app.use((req, res, next) => {
                    if (isLicensePath(req) || this.instanceProxy.matches(req.url)) {
                        next();
                        return;
                    }
                    genericJson(req, res, next);
                });
                this.server.app.use(this.instanceProxy.hideAuthorization);
                // Hardened local profile: do not allow SSO to perform remote account side effects.
                this.server.app.all(['/sso', '/sso-callback', '/sso-token'], (_req, res) => {
                    res.status(403).json({ error: 'ssoUnavailableInLocalSecurityProfile' });
                });
                // Bind upstream OAuth issuance and reads to the revocable EOS credential snapshot.
                this.oauth2Model = (0, webserver_1.createOAuth2Server)(this.adapter, {
                    app: this.server.app,
                    oidc: this.getOidcConfig(),
                    // Only a one-time code goes into the URL after a single sign-on, not the tokens
                    ssoHandoff: 'code',
                    authorizationCode: false,
                    dynamicClientRegistration: false,
                    secure: this.settings.secure,
                    accessLifetime: this.settings.ttl,
                    refreshLifetime: this.settings.refreshTokenTtlDays * 24 * 60 * 60,
                    noBasicAuth: this.settings.noBasicAuth,
                    loginPage: (req) => {
                        const isDev = req.url.includes('?dev');
                        const origin = this.getSafeLoginOrigin(req);
                        if (isDev) {
                            return 'http://127.0.0.1:3000/index.html?login';
                        }
                        return origin ? `${origin}/index.html?login` : this.loginPage;
                    },
                });
                this.adapter.eosSessionSecurity.bindOAuthModel(this.oauth2Model);
                this.server.app.get('/session', (req, res) => {
                    let accessToken = req.headers.cookie
                        ?.split(';')
                        .find(cookie => cookie.trim().startsWith('access_token='))
                        ?.split('=')[1];
                    if (!accessToken && req.headers.authorization?.startsWith('Bearer ')) {
                        accessToken = req.headers.authorization.slice('Bearer '.length);
                    }
                    if (accessToken) {
                        const tokenId = accessToken.startsWith('a:') ? accessToken : `a:${accessToken}`;
                        this.adapter.getSession(tokenId, token => {
                            res.json({
                                expireInSec: token?.user && typeof token.aExp === 'number' && token.aExp > Date.now()
                                    ? Math.round((token.aExp - Date.now()) / 1000)
                                    : 0,
                            });
                        });
                        return;
                    }
                    res.json({ error: 'Cannot find session' });
                });
                this.server.app.get(/.*\/nexowatt\/security\/(?:context|session)$/, (req, res) => {
                    void this.sendEosSecuritySession(req, res).catch(e => {
                        this.adapter.log.warn(`Cannot create NexoWatt security context: ${e instanceof Error ? e.message : 'unknown error'}`);
                        res.status(503).json({
                            error: 'EOS security context temporarily unavailable',
                            transient: true,
                            authenticated: false,
                            user: null,
                            groups: [],
                            groupNames: [],
                            adminGroups: ['system.group.administrator'],
                            installerGroups: this.getEosInstallerGroups(),
                            endUserGroups: this.getEosEndUserGroups(),
                            role: 'unknown',
                            isAdministrator: false,
                            isEosAdminGroup: false,
                            isInstaller: false,
                            isEndUser: false,
                            isAdmin: false,
                            mustChangePassword: false,
                            passwordSetup: {
                                required: false,
                                initialized: false,
                                minLength: this.getEosFirstLoginPasswordMinLength(),
                                version: 1,
                                userName: '',
                            },
                            capabilities: {},
                            hideLegacyAdminForNonAdmins: true,
                            hideLegacyAdminFromNonAdmins: true,
                            restrictProtectedAdapterControls: true,
                            protectedAdapters: this.getEosProtectedAdapterNames(),
                        });
                    });
                });
                this.server.app.get('/logout', (req, res) => {
                    const isDev = req.url.includes('?dev');
                    const origin = this.getSafeLoginOrigin(req);
                    // v36: normal logout; remove known auth cookies before redirecting.
                    for (const cookieName of [
                        'access_token',
                        'refresh_token',
                        'connect.sid',
                        'io',
                        'ioBroker.sid',
                        'eos-admin.sid',
                    ]) {
                        res.clearCookie(cookieName, { path: '/' });
                    }
                    const sessionReq = req;
                    sessionReq.session?.destroy?.(() => undefined);
                    if (isDev) {
                        res.redirect('http://127.0.0.1:3000/index.html?login');
                    }
                    else {
                        res.redirect(origin ? `${origin}/index.html?login` : this.loginPage);
                    }
                });
                // Retired anonymous activation endpoints always return 410. Legacy flags/cookies
                // cannot grant an account; ordinary credential-based first login remains separate.
                this.server.app.post('/nexowatt/account/passwordless-status', (req, res) => {
                    void this.getEosPasswordlessFirstLoginStatus(req, res).catch(e => {
                        this.adapter.log.debug(`Cannot read EOS passwordless activation status: ${e instanceof Error ? e.message : 'unknown error'}`);
                        res.status(200).json({ success: true, eligible: false });
                    });
                });
                this.server.app.post('/nexowatt/account/passwordless-claim', (req, res) => {
                    void this.startEosPasswordlessFirstLogin(req, res).catch(e => {
                        this.adapter.log.warn(`Cannot start EOS passwordless activation: ${e instanceof Error ? e.message : 'unknown error'}`);
                        res.status(500).json({ error: 'claimUnavailable' });
                    });
                });
                this.server.app.post('/nexowatt/account/passwordless-password', (req, res) => {
                    void this.saveEosPasswordlessFirstLogin(req, res).catch(e => {
                        this.adapter.log.warn(`Cannot complete EOS passwordless activation: ${e instanceof Error ? e.message : 'unknown error'}`);
                        res.status(500).json({ error: 'passwordSetupFailed' });
                    });
                });
                // route middleware to make sure a user is logged in
                this.server.app.use((req, res, next) => {
                    // return favicon always
                    if (req.url === '/favicon.ico') {
                        res.set('Content-Type', 'image/x-icon');
                        if (this.systemConfig.native?.vendor.ico) {
                            // convert base64 to ico
                            const text = this.systemConfig.native.vendor.ico.split(',')[1];
                            res.send(Buffer.from(text, 'base64'));
                            return;
                        }
                        res.send((0, node_fs_1.readFileSync)((0, node_path_1.join)(this.wwwDir, 'favicon.ico')));
                        return;
                    }
                    if (/admin\.\d+\/login-bg\.png(\?.*)?$/.test(req.originalUrl)) {
                        // Read the names of files for gong
                        this.adapter.readFile(this.adapter.namespace, 'login-bg.png', null, (err, file) => {
                            if (!err && file) {
                                res.set('Content-Type', 'image/png');
                                res.status(200).send(file);
                            }
                            else {
                                res.status(404).send(this.get404Page());
                            }
                        });
                        return;
                    }
                    if ((req.isAuthenticated && !req.isAuthenticated()) || (!req.isAuthenticated && !req.user)) {
                        const pathName = req.url.split('?')[0];
                        if (pathName.startsWith('/login/') ||
                            // OAuth callbacks arrive cross-site without Strict session cookies.
                            // The receiving adapter must validate the OAuth state it issued.
                            pathName.startsWith('/oauth2_callbacks/')) {
                            return next();
                        }
                        // protect all paths except
                        this.unprotectedFiles ||= (0, node_fs_1.readdirSync)(this.wwwDir).map(file => {
                            const stat = (0, node_fs_1.lstatSync)((0, node_path_1.join)(this.wwwDir, file));
                            return { name: file, isDir: stat.isDirectory() };
                        });
                        if (pathName &&
                            pathName !== '/' &&
                            !this.unprotectedFiles.find(file => file.isDir ? pathName.startsWith(`/${file.name}/`) : `/${file.name}` === pathName)) {
                            res.redirect(`${this.loginPage}&href=${encodeURIComponent(this.publicPath + req.url.replace(/^\//, ''))}`);
                        }
                        else {
                            next();
                            return;
                        }
                    }
                    else {
                        next();
                        return;
                    }
                });
            }
            else {
                this.server.app.get('/logout', (_req, res) => res.redirect(this.publicPath));
            }
            this.server.app.get('/nexowatt/updates/status', this.eosTechnicalRouteGuard(true), (req, res) => {
                void this.sendNexoWattStableUpdateStatus(req, res).catch(() => res.status(500).json({ error: 'updateStatusFailed' }));
            });
            this.server.app.post('/nexowatt/updates/settings', this.eosTechnicalRouteGuard(true, true), (req, res) => {
                void this.saveNexoWattStableUpdateSettings(req, res).catch(() => res.status(500).json({ error: 'updateSettingsFailed' }));
            });
            (0, eosLicenseHttp_1.registerLicenseRoutes)(this.server.app, {
                service: this.adapter.eosLicenseService,
                secure: this.settings.secure === true,
                authorize: async (req) => {
                    if (!this.settings.auth) {
                        return false;
                    }
                    const access = await this.getEosRequestAccess(req);
                    return (!!access.userId &&
                        access.role === 'admin' &&
                        !(await this.getEosFirstLoginPasswordState(access.userId, access.role)).required);
                },
                jsonParser: bodyParser.json({ limit: '20kb', strict: true }),
                pagePath: (0, node_path_1.join)(__dirname, '../../public/nexowatt-license.html'),
                scriptPath: (0, node_path_1.join)(__dirname, '../../public/nexowatt-license.js'),
            });
            const sendSecuritySession = (req, res) => {
                void this.sendEosSecuritySession(req, res).catch(e => {
                    this.adapter.log.warn(`Cannot read EOS security session: ${e instanceof Error ? e.message : 'unknown error'}`);
                    res.status(503).json({
                        error: 'EOS security context temporarily unavailable',
                        transient: true,
                        authenticated: false,
                        user: null,
                        role: 'unknown',
                        mustChangePassword: false,
                    });
                });
            };
            this.server.app.get('/eos/security/status', sendSecuritySession);
            this.server.app.get('/nexowatt/security/session', sendSecuritySession);
            this.server.app.get('/nexowatt/security/context', sendSecuritySession);
            this.server.app.get('/nexowatt/readonly/system-info', (req, res) => {
                void this.sendEosReadonlySystemInfo(req, res).catch(e => {
                    this.adapter.log.warn(`Cannot read EOS readonly system info: ${e instanceof Error ? e.message : 'unknown error'}`);
                    res.status(500).json({ error: 'readonlySystemInfoFailed' });
                });
            });
            this.server.app.get('/nexowatt/role-settings/basic', (req, res) => {
                void this.sendEosBasicSettings(req, res).catch(e => {
                    this.adapter.log.warn(`Cannot read EOS basic settings: ${e instanceof Error ? e.message : 'unknown error'}`);
                    res.status(500).json({ error: 'basicSettingsReadFailed' });
                });
            });
            this.server.app.post('/nexowatt/role-settings/basic', this.eosTechnicalRouteGuard(false, true), (req, res) => {
                void this.saveEosBasicSettings(req, res).catch(e => {
                    this.adapter.log.warn(`Cannot save EOS basic settings: ${e instanceof Error ? e.message : 'unknown error'}`);
                    res.status(500).json({ error: 'basicSettingsSaveFailed' });
                });
            });
            this.server.app.post('/nexowatt/account/first-password', (req, res) => {
                void this.saveEosFirstLoginPassword(req, res).catch(e => {
                    this.adapter.log.warn(`Cannot initialize EOS first-login password: ${e instanceof Error ? e.message : 'unknown error'}`);
                    res.status(500).json({ error: 'passwordSetupFailed' });
                });
            });
            this.server.app.get('/nexowatt/account/manage', this.eosTechnicalRouteGuard(false), (req, res) => {
                void this.sendEosAccountManagement(req, res).catch(e => {
                    this.adapter.log.warn(`Cannot read EOS account management: ${e instanceof Error ? e.message : 'unknown error'}`);
                    res.status(500).json({ error: 'accountManagementFailed' });
                });
            });
            this.server.app.post('/nexowatt/account/reset', this.eosTechnicalRouteGuard(false, true), (req, res) => {
                void this.resetEosAccountPassword(req, res).catch(e => {
                    this.adapter.log.warn(`Cannot reset EOS account: ${e instanceof Error ? e.message : 'unknown error'}`);
                    res.status(500).json({ error: 'accountResetFailed' });
                });
            });
            // Both the Admin session and first-password boundary apply before proxy forwarding.
            this.server.app.use((req, res, next) => {
                if (this.instanceProxy.matches(req.url)) {
                    this.eosAuthenticatedRouteGuard()(req, res, next);
                }
                else {
                    next();
                }
            });
            this.server.app.use(this.instanceProxy.handleRequest);
            this.server.app.get('/iobroker_check.html', (_req, res) => {
                res.status(200).send('ioBroker');
            });
            this.server.app.get('/validate_config/*any', this.eosTechnicalRouteGuard(true), async (req, res) => {
                const adapterName = req.url.split('?')[0].split('/').pop() || '';
                await this.validateJsonConfig(adapterName.toLowerCase(), 'config');
                res.status(200).send('validated');
            });
            // Called by the admin UI as a JSON tab (`common.adminTab.link`) is opened
            this.server.app.get('/validate_tab/*any', this.eosTechnicalRouteGuard(true), async (req, res) => {
                const adapterName = req.url.split('?')[0].split('/').pop() || '';
                await this.validateJsonConfig(adapterName.toLowerCase(), 'tab');
                res.status(200).send('validated');
            });
            // send log files
            this.server.app.get('/log/*any', this.eosTechnicalRouteGuard(false), async (req, res) => {
                let parts = decodeURIComponent(req.url).split('/');
                if (parts.length === 5) {
                    // remove first "/"
                    parts.shift();
                    // remove "log"
                    parts.shift();
                    const [host, transport] = parts;
                    parts = parts.splice(2);
                    const fileName = parts.join('/');
                    if (fileName.includes('..')) {
                        res.status(404).send(this.get404Page('File %s not found. Do not use relative paths!', fileName));
                        return;
                    }
                    this.adapter.sendToHost(`system.host.${host}`, 'getLogFile', { filename: fileName, transport }, result => {
                        void this.sendRemoteLog(fileName, result, res).catch(() => {
                            if (!res.headersSent) {
                                res.status(502).json({ error: 'invalidLogResponse' });
                            }
                            else {
                                res.destroy();
                            }
                        });
                    });
                }
                else {
                    parts = parts.splice(2);
                    const transport = parts.shift();
                    let fileName = parts.join('/');
                    const config = this.adapter.systemConfig;
                    // detect file log
                    if (transport && config?.log?.transport) {
                        if (transport in config.log.transport && config.log.transport[transport].type === 'file') {
                            let logFolder;
                            if (config.log.transport[transport].filename) {
                                parts = config.log.transport[transport].filename.replace(/\\/g, '/').split('/');
                                parts.pop();
                                logFolder = (0, node_path_1.normalize)(parts.join('/'));
                            }
                            else {
                                logFolder = (0, node_path_1.join)(process.cwd(), 'log');
                            }
                            if (logFolder[0] !== '/' && logFolder[0] !== '\\' && !logFolder.match(/^[a-zA-Z]:/)) {
                                const _logFolder = (0, node_path_1.normalize)((0, node_path_1.join)(`${this.baseDir}/../../`, logFolder).replace(/\\/g, '/')).replace(/\\/g, '/');
                                if (!(0, node_fs_1.existsSync)(_logFolder)) {
                                    logFolder = (0, node_path_1.normalize)((0, node_path_1.join)(`${this.baseDir}/../`, logFolder).replace(/\\/g, '/')).replace(/\\/g, '/');
                                }
                                else {
                                    logFolder = _logFolder;
                                }
                            }
                            fileName = (0, node_path_1.normalize)((0, node_path_1.join)(logFolder, fileName).replace(/\\/g, '/')).replace(/\\/g, '/');
                            if ((0, node_fs_1.existsSync)(fileName) &&
                                (() => {
                                    const rel = (0, node_path_1.relative)((0, node_fs_1.realpathSync)(logFolder), (0, node_fs_1.realpathSync)(fileName));
                                    return (!!rel &&
                                        rel !== '..' &&
                                        !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
                                        !(0, node_path_1.isAbsolute)(rel));
                                })()) {
                                const stat = (0, node_fs_1.lstatSync)(fileName);
                                // if a file is an archive
                                if (fileName.toLowerCase().endsWith('.gz')) {
                                    // try to not process to big files
                                    if (stat.size > 1024 * 1024 /* || !existsSync('/dev/null')*/) {
                                        res.header('Content-Type', 'application/gzip');
                                        res.sendFile(fileName);
                                    }
                                    else {
                                        try {
                                            await this.unzipFile(fileName, (0, node_fs_1.readFileSync)(fileName), res);
                                        }
                                        catch {
                                            res.header('Content-Type', 'application/gzip');
                                            res.sendFile(fileName);
                                            this.adapter.log.warn('Compressed log preview unavailable; original gzip returned.');
                                        }
                                    }
                                }
                                else if (stat.size > 2 * 1024 * 1024) {
                                    res.header('Content-Type', 'text/plain');
                                    res.sendFile(fileName);
                                }
                                else {
                                    res.header('Content-Type', 'text/html');
                                    res.send(this.decorateLogFile(fileName));
                                }
                                return;
                            }
                        }
                    }
                    res.status(404).send(this.get404Page('File %s not found', fileName));
                }
            });
            if (this.settings.tmpPathAllow && this.settings.tmpPath) {
                this.server.app.use('/tmp/', this.eosTechnicalRouteGuard(true), express_1.default.static(this.settings.tmpPath, { maxAge: 0 }));
                this.server.app.post('/upload', this.eosTechnicalRouteGuard(true, true), (0, eosUploadGuard_1.createUploadMiddleware)(express_fileupload_1.default, this.adapter.log), (req, res) => {
                    if (!req.files) {
                        res.status(400).send('No files were uploaded.');
                        return;
                    }
                    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
                    let myFile;
                    // take the first non-empty file
                    for (const file of Object.values(req.files)) {
                        if (file) {
                            myFile = file;
                            break;
                        }
                    }
                    if (myFile) {
                        if (myFile.truncated || myFile.size > EOS_UPLOAD_MAX_BYTES) {
                            res.header('Content-Type', 'text/plain');
                            res.status(413).send('File is too big. (Max 200MB)');
                            return;
                        }
                        void (0, eosUploadGuard_1.storeRestoreUpload)(req, myFile.tempFilePath, (0, node_path_1.join)(this.settings.tmpPath, 'restore.iob'))
                            .then(() => {
                            if (req.aborted || res.destroyed || res.writableEnded) {
                                return;
                            }
                            res.header('Content-Type', 'text/plain');
                            res.status(200).send('File uploaded!');
                        })
                            .catch(() => {
                            if (!req.aborted && !res.destroyed && !res.writableEnded) {
                                res.status(500).json({ error: 'uploadStoreFailed' });
                            }
                        });
                    }
                    else {
                        res.header('Content-Type', 'text/plain');
                        res.status(500).send('File not uploaded');
                    }
                });
            }
            // Endpoint to upload adapter .tgz files for installation
            this.server.app.post('/upload-adapter', this.eosTechnicalRouteGuard(true, true), (0, eosUploadGuard_1.createUploadMiddleware)(express_fileupload_1.default, this.adapter.log), (req, res) => {
                if (!req.files) {
                    res.status(400).json({ error: 'No files were uploaded.' });
                    return;
                }
                let myFile;
                for (const file of Object.values(req.files)) {
                    if (file) {
                        myFile = file;
                        break;
                    }
                }
                if (!myFile) {
                    res.status(400).json({ error: 'File not uploaded' });
                    return;
                }
                if (myFile.truncated || myFile.size > EOS_UPLOAD_MAX_BYTES) {
                    res.status(413).json({ error: 'File is too big. (Max 200MB)' });
                    return;
                }
                const originalName = myFile.name || 'adapter.tgz';
                if (!originalName.toLowerCase().endsWith('.tgz')) {
                    res.status(400).json({ error: 'Only .tgz files are allowed' });
                    return;
                }
                // Sanitize filename to prevent path traversal
                const sanitizedName = `eos-${(0, node_crypto_1.randomBytes)(16).toString('hex')}.tgz`;
                const targetPath = (0, node_path_1.join)((0, eosUploadGuard_1.getUploadDirectory)(req), sanitizedName);
                myFile.mv(targetPath, err => {
                    if (req.aborted || res.destroyed || res.writableEnded) {
                        return;
                    }
                    if (err) {
                        res.status(500).json({
                            error: 'uploadStoreFailed',
                        });
                    }
                    else {
                        try {
                            (0, node_fs_1.chmodSync)(targetPath, 0o600);
                        }
                        catch {
                            res.status(500).json({ error: 'uploadPermissionsFailed' });
                            return;
                        }
                        (0, eosUploadGuard_1.retainUpload)(req);
                        res.json({ filePath: targetPath, fileName: sanitizedName });
                    }
                });
            });
            if (!(0, node_fs_1.existsSync)(this.wwwDir)) {
                this.server.app.use('/', (_req, res) => {
                    res.header('Content-Type', 'text/plain');
                    res.status(404).send('This adapter cannot be installed directly from GitHub.<br>You must install it from npm.<br>Write for that <i>"npm install iobroker.eos-admin"</i> in according directory.');
                });
            }
            else {
                this.server.app.get('/empty.html', (_req, res) => {
                    res.status(200).send('');
                });
                // Stability release: entrypoints and module-federation manifests must always
                // revalidate. Hashed leaf assets remain cacheable through express.static.
                this.server.app.use((req, res, next) => {
                    const pathName = req.path || req.url.split('?')[0];
                    if (pathName === '/' ||
                        pathName === '/index.html' ||
                        pathName === '/mf-manifest.json' ||
                        /^\/remoteEntry(?:-v\d+)?\.js$/.test(pathName) ||
                        /^\/assets\/hostInit-[^/]+\.js$/.test(pathName)) {
                        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                    }
                    next();
                });
                this.server.app.get('/index.html', async (_req, res) => {
                    this.indexHTML ||= await this.prepareIndex('/index.html');
                    res.header('Content-Type', 'text/html');
                    res.header('Cache-Control', 'no-cache');
                    res.status(200).send(this.indexHTML);
                });
                this.server.app.get('/', async (_req, res) => {
                    this.indexHTML ||= await this.prepareIndex('/index.html');
                    res.header('Content-Type', 'text/html');
                    res.header('Cache-Control', 'no-cache');
                    res.status(200).send(this.indexHTML);
                });
                this.server.app.use('/', express_1.default.static(this.wwwDir, {
                    setHeaders: (res, filePath) => {
                        res.setHeader('Cache-Control', getCacheControl(filePath));
                    },
                }));
            }
            // reverse proxy with url rewrite for couchdb attachments in <adapter-name>.admin
            this.server.app.use('/adapter/', this.eosAuthenticatedRouteGuard(), (req, res) => {
                // Example: /example/?0&attr=1
                let url;
                try {
                    url = decodeURIComponent(req.url);
                }
                catch {
                    // ignore
                    url = req.url;
                }
                // sanitize url
                // add index.html
                url = url.replace(/\/($|\?|#)/, '/index.html$1');
                // Read config files for admin from /adapters/admin/admin/...
                if (url.startsWith(`/${this.adapter.name}/`)) {
                    url = url.replace(`/${this.adapter.name}/`, this.dirName);
                    // important: Linux does not normalize "\" but readFile accepts it as '/'
                    url = (0, node_path_1.normalize)(url.replace(/\?.*/, '').replace(/\\/g, '/')).replace(/\\/g, '/');
                    if (url.startsWith(this.dirName)) {
                        try {
                            if ((0, node_fs_1.existsSync)(url)) {
                                res.contentType((0, mime_types_1.lookup)(url) || 'text/javascript');
                                (0, node_fs_1.createReadStream)(url).pipe(res);
                            }
                            else {
                                res.status(404).send(this.get404Page('File not found'));
                            }
                        }
                        catch (e) {
                            res.status(404).send(this.get404Page('File not found: %s', JSON.stringify(e)));
                        }
                    }
                    else {
                        res.status(404).send(this.get404Page('File %s not found', url));
                    }
                    return;
                }
                const parts = url.split('/');
                // Skip first /
                parts.shift();
                // Get ID
                const adapterName = parts.shift();
                const id = `${adapterName}.admin`;
                url = parts.join('/');
                const pos = url.indexOf('?');
                let _instance = 0;
                if (pos !== -1) {
                    _instance = parseInt(url.substring(pos + 1), 10) || 0;
                    url = url.substring(0, pos);
                }
                if (this.settings.accessLimit) {
                    if (url === 'index.html' || url === 'index_m.html') {
                        const anyConfig = this.settings.accessAllowedConfigs.includes(`${adapterName}.${_instance}`);
                        if (!anyConfig) {
                            res.contentType('text/html');
                            res.status(403).send('You are not allowed to access this page');
                            return;
                        }
                    }
                    if (url === 'tab.html' || url === 'tab_m.html') {
                        const anyTabs = this.settings.accessAllowedTabs.includes(`${adapterName}.${_instance}`);
                        if (!anyTabs) {
                            res.contentType('text/html');
                            res.status(403).send('You are not allowed to access this page');
                            return;
                        }
                    }
                }
                // this.adapter.readFile is sanitized
                this.adapter.readFile(id, url, { user: res.locals.eosAuthenticatedUser }, (err, buffer, mimeType) => {
                    if (!buffer || err) {
                        res.contentType('text/html');
                        res.status(404).send(this.get404Page('File %s not found', url));
                    }
                    else {
                        if (mimeType) {
                            res.contentType(mimeType);
                        }
                        else {
                            try {
                                const _mimeType = (0, mime_types_1.lookup)(url);
                                res.contentType(_mimeType || 'text/javascript');
                            }
                            catch {
                                res.contentType('text/javascript');
                            }
                        }
                        res.set('Cache-Control', getCacheControl(url));
                        res.send(this.withInfoJs(url, buffer));
                    }
                });
            });
            // File reads have their own identity boundary; public asset suffixes never authorize DB files.
            this.server.app.use('/files/', this.eosAuthenticatedRouteGuard(), async (req, res) => {
                try {
                    const { namespace, filePath } = (0, eosFileTransferSecurity_1.parseDbFileRequest)(req.url);
                    if (!namespace) {
                        throw new Error('Invalid file namespace');
                    }
                    if (this.settings.accessLimit) {
                        const instance = Number((req.url.split('?')[1] || '').match(/^\d+/)?.[0] || 0);
                        const accessId = /\.\d+$/.test(namespace) ? namespace : `${namespace}.${instance}`;
                        const configDenied = ['index.html', 'index_m.html'].includes(filePath) &&
                            !this.settings.accessAllowedConfigs.includes(accessId);
                        const tabDenied = ['tab.html', 'tab_m.html'].includes(filePath) &&
                            !this.settings.accessAllowedTabs.includes(accessId);
                        if (configDenied || tabDenied) {
                            res.status(403).json({ error: 'permissionError' });
                            return;
                        }
                    }
                    await (0, eosFileTransferSecurity_1.serveDbFile)({
                        adapter: this.adapter,
                        req,
                        res,
                        namespace,
                        filePath,
                        user: res.locals.eosAuthenticatedUser,
                    });
                }
                catch {
                    if (!res.headersSent) {
                        res.status(400).json({ error: 'invalidFileRequest' });
                    }
                    else {
                        res.destroy();
                    }
                }
            });
            // handler for oauth2 redirects
            this.server.app.use('/oauth2_callbacks/', this.eosTechnicalRouteGuard(false), (req, res) => {
                res.setHeader('Cache-Control', 'no-store');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Referrer-Policy', 'no-referrer');
                res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
                // extract instance from "http://localhost:8081/oauth2_callbacks/netatmo.0/?state=ABC&code=CDE"
                const [_instance, params] = req.url.split('?');
                const instance = _instance.replace(/^\//, '').replace(/\/$/, ''); // remove last and first "/" in "/netatmo.0/"
                if (!/^[a-z0-9][a-z0-9_-]*\.\d+$/i.test(instance)) {
                    res.status(400).json({ error: 'invalidCallbackTarget' });
                    return;
                }
                const query = {};
                (params || '').split('&').forEach(param => {
                    if (!param) {
                        return;
                    }
                    const [key, value] = param.split('=');
                    query[key] = value === undefined ? true : value;
                    if (Number.isFinite(query[key])) {
                        query[key] = parseFloat(query[key]);
                    }
                    else if (query[key] === 'true') {
                        query[key] = true;
                    }
                    else if (query[key] === 'false') {
                        query[key] = false;
                    }
                });
                query.timeout = Math.max(100, Math.min(5_000, Number(query.timeout) || 5_000));
                let timeout = this.adapter.setTimeout(() => {
                    if (timeout) {
                        timeout = undefined;
                        let text = (0, node_fs_1.readFileSync)(`${this.baseDir}/public/oauthError.html`).toString('utf8');
                        text = text.replace('%LANGUAGE%', ['en', 'de', 'es', 'fr', 'it', 'pl', 'nl', 'pt', 'ru', 'zh-CN'].includes(this.systemLanguage)
                            ? this.systemLanguage
                            : 'en');
                        text = text.replace('%ERROR%', 'TIMEOUT');
                        res.setHeader('Content-Type', 'text/html');
                        res.status(408).send(text);
                    }
                }, query.timeout || 5_000);
                this.adapter.sendTo(instance, 'oauth2Callback', query, result => {
                    const _result = result;
                    if (timeout) {
                        this.adapter.clearTimeout(timeout);
                        timeout = undefined;
                        if (_result?.error) {
                            let text = (0, node_fs_1.readFileSync)(`${this.baseDir}/public/oauthError.html`).toString('utf8');
                            text = text.replace('%LANGUAGE%', ['en', 'de', 'es', 'fr', 'it', 'pl', 'nl', 'pt', 'ru', 'zh-CN'].includes(this.systemLanguage)
                                ? this.systemLanguage
                                : 'en');
                            text = text.replace('%ERROR%', () => escapeHtml(String(_result.error).slice(0, 4096)));
                            res.setHeader('Content-Type', 'text/html');
                            res.status(500).send(text);
                        }
                        else {
                            let text = (0, node_fs_1.readFileSync)(`${this.baseDir}/public/oauthSuccess.html`).toString('utf8');
                            text = text.replace('%LANGUAGE%', ['en', 'de', 'es', 'fr', 'it', 'pl', 'nl', 'pt', 'ru', 'zh-CN'].includes(this.systemLanguage)
                                ? this.systemLanguage
                                : 'en');
                            text = text.replace('%MESSAGE%', () => escapeHtml(String(_result?.result || '').slice(0, 4096)));
                            res.setHeader('Content-Type', 'text/html');
                            res.status(200).send(text);
                        }
                    }
                });
            });
            try {
                const webserver = new webserver_1.WebServer({
                    app: this.server.app,
                    adapter: this.adapter,
                    secure: this.settings.secure,
                    acmeChallenge: this.settings.acmeChallenge,
                    // The EOS proxy/socket boundary is verified for TLS over HTTP/1.1.
                    http2: false,
                });
                const initialized = await webserver.init();
                this.server.server = Object.assign(initialized, { __server: this.server });
            }
            catch (err) {
                this.adapter.log.error(`Cannot create web-server: ${err instanceof Error ? err.message : 'unknown error'}`);
                this.adapter.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return;
            }
            if (!this.server.server) {
                this.adapter.log.error(`Cannot create web-server`);
                this.adapter.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return;
            }
            // Node's deadline protects incomplete headers/body in addition to the per-upload deadline.
            this.server.server.headersTimeout = 15000;
            this.server.server.requestTimeout = 60000;
            this.server.server.maxHeadersCount = 100;
            this.server.server.__server = this.server;
            this.instanceProxy.attach(this.server.server);
        }
        else {
            this.adapter.log.error('port missing');
            this.adapter.terminate('port missing', adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            return;
        }
        const systemConfig = await this.adapter.getForeignObjectAsync('system.config');
        this.systemConfig = systemConfig || {};
        this.systemConfig.native ||= {};
        this.systemConfig.native.vendor ||= {};
        this.systemConfig.native.vendor.admin ||= {};
        this.systemConfig.native.vendor.admin.login ||= {};
        const uuidObj = await this.adapter.getForeignObjectAsync('system.meta.uuid');
        if (uuidObj?.native) {
            uuid = uuidObj.native.uuid;
        }
        if (this.server.server) {
            // keep a local reference, so the callbacks below do not have to re-check `this.server.server`
            const server = this.server.server;
            let serverListening = false;
            let serverPort;
            server.on('error', e => {
                if (e.toString().includes('EACCES') && serverPort <= 1024) {
                    this.adapter.log.error(`node.js process has no rights to start server on the port ${serverPort}.\n` +
                        `Do you know that on linux you need special permissions for ports under 1024?\n` +
                        `You can call in shell following scrip to allow it for node.js: "iobroker fix"`);
                }
                else {
                    this.adapter.log.error(`Cannot start server on ${this.settings.bind || '0.0.0.0'}:${serverPort}: ${e.toString()}`);
                }
                if (!serverListening) {
                    if (this.adapter.terminate) {
                        this.adapter.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                    }
                    else {
                        process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                    }
                }
            });
            this.settings.port = parseInt(String(this.settings.port), 10) || 8081;
            serverPort = this.settings.port;
            if (!this.settings.disableMcp) {
                this.adapter.log.warn('External MCP is disabled by the EOS security profile until its authentication and authorization boundary is verified.');
            }
            // 404 handler. Registered only here, after the MCP routes: Express tries the routes in the order
            // they were added, and a catch-all in front of them made `/mcp` unreachable.
            this.server.app?.use((req, res) => {
                res.status(404).send(this.get404Page('File %s not found', req.url));
            });
            this.adapter.getPort(this.settings.port, !this.settings.bind || this.settings.bind === '0.0.0.0' ? undefined : this.settings.bind || undefined, port => {
                serverPort = port;
                // Start the web server
                server.listen(port, !this.settings.bind || this.settings.bind === '0.0.0.0'
                    ? undefined
                    : this.settings.bind || undefined, () => {
                    void this.adapter.setState('info.connection', true, true);
                    serverListening = true;
                    this.adapter.log.info(`http${this.settings.secure ? 's' : ''} server listening on port ${port}`);
                    this.adapter.log.info(`Use link "http${this.settings.secure ? 's' : ''}://127.0.0.1:${port}" to configure.`);
                    if (!this.adapter.config.doNotCheckPublicIP && !this.adapter.config.auth) {
                        this.checkTimeout = this.adapter.setTimeout(async () => {
                            this.checkTimeout = undefined;
                            try {
                                await (0, webserver_1.checkPublicIP)(this.settings.port, 'ioBroker', '/iobroker_check.html');
                            }
                            catch (e) {
                                // this supported first from js-controller 5.0.
                                this.adapter.sendToHost(`system.host.${this.adapter.host}`, 'addNotification', {
                                    scope: 'system',
                                    category: 'securityIssues',
                                    message: 'Your admin instance is accessible from the internet without any protection. ' +
                                        'Please enable authentication or disable the access from the internet.',
                                    instance: `system.adapter.${this.adapter.namespace}`,
                                }, ( /* result */) => {
                                    /* ignore */
                                });
                                this.adapter.log.error(e.toString());
                            }
                        }, 1000);
                    }
                });
                if (typeof this.onReady === 'function') {
                    void Promise.resolve(this.onReady(server, this.store, this.adapter)).catch(e => this.adapter.log.error(`Cannot finish EOS webserver startup: ${e instanceof Error ? e.message : 'unknown error'}`));
                }
            });
        }
    }
}
exports.default = Web;
//# sourceMappingURL=web.js.map