/**
 * Admin 8 instance-proxy contract, based on ioBroker Admin 8.3.5 (MIT).
 * EOS hardening: live authorization, TLS verification, scoped credentials and
 * bounded local HTTP / long-lived stream profiles. No external runtime library.
 */
import http, {
    type ClientRequest,
    type IncomingHttpHeaders,
    type IncomingMessage,
    type OutgoingHttpHeaders,
    type Server,
} from 'node:http';
import https from 'node:https';
import { isIP, Socket } from 'node:net';
import { Duplex, Transform } from 'node:stream';
import type { NextFunction, Request, Response } from 'express';

interface ProxyAdapter {
    host?: string;
    namespace?: string;
    config: { auth: boolean; secure: boolean };
    getSession(id: string, callback: (value?: unknown) => void): unknown;
    getForeignObjectAsync(id: string): Promise<unknown>;
    log: { debug(message: string): void };
}
interface Target {
    protocol: 'http:' | 'https:';
    host: string;
    port: number;
}
interface Parsed {
    instance: string;
    path: string | null;
    query: string;
}
interface Active {
    close: () => void;
}
interface Authorization {
    user: string;
    target: Target;
}
type ObjectValue = Record<string, unknown>;
const HIDDEN_AUTHORIZATION = Symbol('eosProxyAuthorization');
const ADMIN_COOKIES = new Set(['access_token', 'refresh_token', 'connect.sid', 'nexowatt_eos_first_login']);
const HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-connection',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'http2-settings',
]);
const MAX_ACTIVE = 32;
const MAX_DATABASE_PENDING = 64;
const LOOKUP_MS = 2_000;
// Local adapter authentication may take up to twelve seconds. This is not an
// external weather/tariff fetch; those retain their separate five-second budget.
const HTTP_MS = 15_000;
const STREAM_MS = 3_600_000;
const STREAM_IDLE_MS = 60_000;
const AUTH_RECHECK_MS = 5_000;
const REQUEST_BYTES = 16 * 1024 * 1024;
const RESPONSE_BYTES = 64 * 1024 * 1024;

function object(value: unknown): ObjectValue | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectValue) : null;
}
function userId(value: unknown): string | null {
    if (typeof value !== 'string' || !/^(?:system\.user\.)?[A-Za-z0-9_.@-]{1,128}$/.test(value)) {
        return null;
    }
    return value.startsWith('system.user.') ? value : `system.user.${value}`;
}
function token(headers: IncomingHttpHeaders): string | null {
    if (typeof headers.cookie !== 'string' || headers.cookie.length > 16_384) {
        return null;
    }
    const cookies = headers.cookie
        .split(';')
        .map(item => item.trim())
        .filter(item => item.startsWith('access_token='));
    const value = cookies.length === 1 ? cookies[0]?.slice(13) : undefined;
    return value && /^[A-Za-z0-9._~-]{1,4096}$/.test(value) ? value : null;
}
function checkedHost(value: unknown): string | null {
    if (typeof value !== 'string' || !value || value.length > 253) {
        return null;
    }
    const name = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
    if (isIP(name)) {
        return name;
    }
    return /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(
        name,
    )
        ? name
        : null;
}
function loopback(host: string): boolean {
    return host === 'localhost' || host === '::1' || host.startsWith('127.');
}
function limitedStream(limit: number): Transform {
    let bytes = 0;
    return new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length;
            callback(bytes > limit ? new Error('EOS_PROXY_SIZE_LIMIT') : null, bytes > limit ? undefined : chunk);
        },
    });
}
function connectionHeaders(headers: IncomingHttpHeaders): Set<string> {
    const denied = new Set(HOP_HEADERS);
    if (typeof headers.connection === 'string') {
        for (const field of headers.connection.split(',')) {
            denied.add(field.trim().toLowerCase());
        }
    }
    return denied;
}
function rejectUpgrade(socket: Duplex, status: number): void {
    const labels: Record<number, string> = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        429: 'Too Many Requests',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
    };
    if (socket.writable && !socket.destroyed) {
        socket.end(
            `HTTP/1.1 ${status} ${labels[status] || 'Bad Gateway'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
        );
    } else {
        socket.destroy();
    }
}

export class InstanceProxy {
    private readonly adapter: ProxyAdapter;
    private readonly publicPath: string;
    private readonly active = new Set<Active>();
    private databasePending = 0;
    private stopped = false;
    private generation = 0;
    private detach: (() => void) | undefined;

    constructor(adapter: ProxyAdapter, publicPath: string) {
        const parts = publicPath.slice(1, -1).split('/');
        if (
            publicPath.length > 256 ||
            !publicPath.startsWith('/') ||
            !publicPath.endsWith('/') ||
            (publicPath !== '/' &&
                parts.some(
                    part => !/^[A-Za-z0-9._~-]{1,128}$/.test(part) || part === '.' || part === '..' || part === 'proxy',
                ))
        ) {
            throw new Error('EOS_PROXY_PUBLIC_PATH_INVALID');
        }
        this.adapter = adapter;
        this.publicPath = publicPath;
    }

    private relative(url: string | undefined): string | null {
        if (!url || url.length > 8192) {
            return null;
        }
        return this.publicPath !== '/' && url.startsWith(this.publicPath) ? url.slice(this.publicPath.length - 1) : url;
    }
    matches(url: string | undefined): boolean {
        const relative = this.relative(url);
        return relative !== null && (relative === '/proxy' || relative.startsWith('/proxy/'));
    }
    private parse(url: string | undefined): Parsed | null {
        const relative = this.relative(url);
        if (
            !relative ||
            relative.includes('\\') ||
            relative.includes('#') ||
            [...relative].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
        ) {
            return null;
        }
        const match = /^\/proxy\/([a-z0-9][a-z0-9_-]{0,127}\.(?:0|[1-9]\d{0,5}))(\/[^?]*)?(\?.*)?$/.exec(relative);
        if (!match?.[1]) {
            return null;
        }
        const path = match[2] || null;
        if (path) {
            if (path.includes('//') || /%(?:2f|5c|25|0[0-9a-f]|1[0-9a-f]|7f)/i.test(path)) {
                return null;
            }
            try {
                const decoded = decodeURIComponent(path);
                if (decoded.split('/').some(part => part === '.' || part === '..')) {
                    return null;
                }
            } catch {
                return null;
            }
        }
        const query = match[3] || '';
        if (query.length > 4096) {
            return null;
        }
        const search = new URLSearchParams(query);
        if (['access_token', 'refresh_token', 'password', 'pass'].some(key => search.has(key))) {
            return null;
        }
        return { instance: match[1], path, query };
    }
    private prefix(instance: string): string {
        return `${this.publicPath}proxy/${instance}`;
    }

    private lookup<T>(operation: () => Promise<T>): Promise<T> {
        if (this.stopped || this.databasePending >= MAX_DATABASE_PENDING) {
            return Promise.reject(new Error('EOS_PROXY_LOOKUP_BUSY'));
        }
        this.databasePending++;
        const work = Promise.resolve()
            .then(operation)
            .finally(() => {
                this.databasePending--;
            });
        // An unresponsive database still occupies its slot after the caller times
        // out, preventing repeated requests from accumulating pending work.
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('EOS_PROXY_LOOKUP_TIMEOUT')), LOOKUP_MS);
            work.then(
                value => {
                    clearTimeout(timer);
                    resolve(value);
                },
                (error: unknown) => {
                    clearTimeout(timer);
                    reject(error instanceof Error ? error : new Error('EOS_PROXY_LOOKUP_FAILED'));
                },
            );
        });
    }
    private async getUser(headers: IncomingHttpHeaders): Promise<string | null> {
        if (this.adapter.config.auth !== true) {
            return null;
        }
        const access = token(headers);
        if (!access) {
            return null;
        }
        const raw = await this.lookup(
            () =>
                new Promise<unknown>(resolve => {
                    this.adapter.getSession(`a:${access}`, resolve);
                }),
        );
        const session = object(raw);
        if (
            !session ||
            session.aud ||
            session.clientId ||
            typeof session.aExp !== 'number' ||
            !Number.isFinite(session.aExp) ||
            session.aExp <= Date.now()
        ) {
            return null;
        }
        const user = userId(session.user);
        if (!user) {
            return null;
        }
        const account = object(await this.lookup(() => this.adapter.getForeignObjectAsync(user)));
        const common = object(account?.common);
        const native = object(account?.native);
        const accountMeta = object(native?.nexowattEosAccount);
        if (
            account?.type !== 'user' ||
            !common ||
            common.enabled === false ||
            accountMeta?.forcePasswordChange === true ||
            native?.nexowattPasswordChangeRequired === true ||
            native?.eosPasswordChangeRequired === true ||
            native?.nexowattFirstLoginPending === true ||
            native?.eosFirstLoginRequired === true
        ) {
            return null;
        }
        return user;
    }
    private async isAdministrator(user: string): Promise<boolean> {
        const group = object(await this.lookup(() => this.adapter.getForeignObjectAsync('system.group.administrator')));
        const members = object(group?.common)?.members;
        return group?.type === 'group' && Array.isArray(members) && members.length <= 4096 && members.includes(user);
    }
    private async getHostAddress(hostname: string): Promise<string | null> {
        const hostObject = object(
            await this.lookup(() => this.adapter.getForeignObjectAsync(`system.host.${hostname}`)),
        );
        const hardware = object(object(hostObject?.native)?.hardware);
        const interfaces = object(hardware?.networkInterfaces);
        if (interfaces && Object.keys(interfaces).length <= 128) {
            for (const values of Object.values(interfaces)) {
                if (!Array.isArray(values) || values.length > 64) {
                    continue;
                }
                for (const raw of values) {
                    const item = object(raw);
                    if (
                        item?.internal === false &&
                        item.family === 'IPv4' &&
                        typeof item.address === 'string' &&
                        isIP(item.address) === 4 &&
                        !loopback(item.address)
                    ) {
                        return item.address;
                    }
                }
            }
        }
        const addresses = object(hostObject?.common)?.address;
        if (Array.isArray(addresses)) {
            for (const value of addresses.slice(0, 64)) {
                const host = checkedHost(value);
                if (host && !loopback(host)) {
                    return host;
                }
            }
        }
        return null;
    }
    private async getTarget(instance: string): Promise<Target | null> {
        if (instance === this.adapter.namespace) {
            return null;
        }
        const value = object(await this.lookup(() => this.adapter.getForeignObjectAsync(`system.adapter.${instance}`)));
        const common = object(value?.common);
        const native = object(value?.native);
        if (
            value?.type !== 'instance' ||
            !common ||
            !native ||
            common.enabled === false ||
            object(common.adminTab)?.proxy !== true
        ) {
            return null;
        }
        const rawPort = native.port;
        const port =
            typeof rawPort === 'number'
                ? rawPort
                : typeof rawPort === 'string' && /^\d{1,5}$/.test(rawPort)
                  ? Number(rawPort)
                  : 0;
        if (
            !Number.isInteger(port) ||
            port < 1 ||
            port > 65535 ||
            (native.secure !== undefined && typeof native.secure !== 'boolean')
        ) {
            return null;
        }
        if (typeof common.host !== 'string' || !/^[A-Za-z0-9_.-]{1,253}$/.test(common.host)) {
            return null;
        }
        if (!this.adapter.host || !/^[A-Za-z0-9_.-]{1,253}$/.test(this.adapter.host)) {
            return null;
        }
        const sameHost = common.host === this.adapter.host;
        const bind = native.bind;
        let host: string | null;
        if (bind === undefined || bind === '' || bind === '0.0.0.0' || bind === '::') {
            host = sameHost ? '127.0.0.1' : await this.getHostAddress(common.host);
        } else {
            host = checkedHost(bind);
            if (!sameHost && host && loopback(host)) {
                return null;
            }
        }
        return host ? { protocol: native.secure === true ? 'https:' : 'http:', host, port } : null;
    }
    private async authorize(
        headers: IncomingHttpHeaders,
        instance: string,
        deny: (status: number) => void,
    ): Promise<Authorization | null> {
        const generation = this.generation;
        const user = await this.getUser(headers);
        if (!user) {
            deny(401);
            return null;
        }
        if (!(await this.isAdministrator(user))) {
            deny(403);
            return null;
        }
        const target = await this.getTarget(instance);
        if (!target) {
            deny(404);
            return null;
        }
        if (this.stopped || this.generation !== generation) {
            deny(401);
            return null;
        }
        return { user, target };
    }
    private sameOrigin(req: IncomingMessage, upgrade = false): boolean {
        const host = req.headers.host;
        if (!host || /[\\\s/?#@]/.test(host) || host.length > 260 || req.headers['sec-fetch-site'] === 'cross-site') {
            return false;
        }
        const origin = req.headers.origin;
        if (!origin) {
            return !upgrade && ['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET');
        }
        const protocol = this.adapter.config.secure ? 'https:' : 'http:';
        try {
            const expected = new URL(`${protocol}//${host}`);
            const actual = new URL(origin);
            return actual.origin === expected.origin && origin === actual.origin;
        } catch {
            return false;
        }
    }
    private requestHeaders(req: IncomingMessage, prefix: string): OutgoingHttpHeaders {
        const headers: OutgoingHttpHeaders = {};
        const denied = connectionHeaders(req.headers);
        for (const [name, value] of Object.entries(req.headers)) {
            if (
                value !== undefined &&
                !name.startsWith(':') &&
                !denied.has(name) &&
                name !== 'forwarded' &&
                !name.startsWith('x-forwarded-')
            ) {
                headers[name] = value;
            }
        }
        const original = (req as IncomingMessage & { [HIDDEN_AUTHORIZATION]?: string })[HIDDEN_AUTHORIZATION];
        if (original) {
            headers.authorization = original;
        }
        const cookie = req.headers.cookie
            ?.split(';')
            .map(value => value.trim())
            .filter(value => !ADMIN_COOKIES.has(value.split('=', 1)[0] || ''))
            .join('; ');
        if (cookie) {
            headers.cookie = cookie;
        } else {
            delete headers.cookie;
        }
        headers.host = req.headers.host;
        headers['x-forwarded-for'] = req.socket.remoteAddress || '';
        headers['x-forwarded-proto'] = this.adapter.config.secure ? 'https' : 'http';
        headers['x-forwarded-host'] = req.headers.host;
        headers['x-forwarded-prefix'] = prefix;
        return headers;
    }
    private rewriteCookie(cookie: string, prefix: string): string | null {
        if (cookie.length > 8192 || /[\r\n\0]/.test(cookie)) {
            return null;
        }
        const parts = cookie.split(';');
        const first = parts.shift()?.trim();
        if (!first || !first.includes('=')) {
            return null;
        }
        const name = first.split('=', 1)[0] || '';
        if (ADMIN_COOKIES.has(name) || name.startsWith('__Host-')) {
            return null;
        }
        const attributes = parts.map(part => part.trim()).filter(part => !/^(?:domain|path)\s*=/i.test(part));
        let path = '/';
        const supplied = parts.find(part => /^\s*path\s*=/i.test(part));
        if (supplied) {
            const candidate = supplied.slice(supplied.indexOf('=') + 1).trim();
            if (candidate.startsWith('/') && !candidate.includes('..') && !/[\\\r\n\0]/.test(candidate)) {
                path = candidate;
            }
        }
        if (path !== prefix && !path.startsWith(`${prefix}/`)) {
            path = `${prefix}${path}`;
        }
        if (this.adapter.config.secure && !attributes.some(part => /^secure$/i.test(part))) {
            attributes.push('Secure');
        }
        if (!attributes.some(part => /^samesite=/i.test(part))) {
            attributes.push('SameSite=Lax');
        }
        return [first, ...attributes, `Path=${path}`].join('; ');
    }
    private responseHeaders(
        input: IncomingHttpHeaders,
        prefix: string,
        target: Target,
        host: string,
    ): OutgoingHttpHeaders {
        const headers: OutgoingHttpHeaders = {};
        const denied = connectionHeaders(input);
        for (const [name, value] of Object.entries(input)) {
            if (
                value === undefined ||
                denied.has(name) ||
                name === 'service-worker-allowed' ||
                name === 'clear-site-data'
            ) {
                continue;
            }
            if (name === 'set-cookie') {
                const cookies = (Array.isArray(value) ? value : [value])
                    .slice(0, 64)
                    .map(cookie => this.rewriteCookie(cookie, prefix))
                    .filter((cookie): cookie is string => cookie !== null);
                if (cookies.length) {
                    headers[name] = cookies;
                }
            } else if (name === 'location' && typeof value === 'string') {
                if (value.startsWith('/') && !value.startsWith('//')) {
                    headers[name] = value === prefix || value.startsWith(`${prefix}/`) ? value : `${prefix}${value}`;
                } else {
                    try {
                        const url = new URL(value);
                        headers[name] =
                            (url.hostname === target.host &&
                                Number(url.port || (url.protocol === 'https:' ? 443 : 80)) === target.port) ||
                            url.host === host
                                ? `${prefix}${url.pathname}${url.search}${url.hash}`
                                : value;
                    } catch {
                        headers[name] = value;
                    }
                }
            } else {
                headers[name] = value;
            }
        }
        return headers;
    }
    hideAuthorization = (req: Request, _res: Response, next: NextFunction): void => {
        if (req.headers.authorization && this.matches(req.url)) {
            (req as Request & { [HIDDEN_AUTHORIZATION]?: string })[HIDDEN_AUTHORIZATION] = req.headers.authorization;
            delete req.headers.authorization;
        }
        next();
    };

    handleRequest = (req: Request, res: Response, next: NextFunction): void => {
        if (!this.matches(req.url)) {
            next();
            return;
        }
        const parsed = this.parse(req.url);
        if (!parsed) {
            res.status(400).send('Invalid proxy path');
            return;
        }
        if (!this.sameOrigin(req)) {
            res.status(403).send('Forbidden');
            return;
        }
        if (this.stopped || this.active.size >= MAX_ACTIVE) {
            res.status(503).send('Proxy capacity unavailable');
            return;
        }
        const prefix = this.prefix(parsed.instance);
        let cancelled = false;
        let proxyReq: ClientRequest | undefined;
        let proxyRes: IncomingMessage | undefined;
        let body: Transform | undefined;
        let output: Transform | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let recheck: ReturnType<typeof setInterval> | undefined;
        const active = this.active;
        const record: Active = {
            close: () => {
                cleanup();
                res.destroy();
            },
        };
        function cleanup(): void {
            cancelled = true;
            clearTimeout(timer);
            clearInterval(recheck);
            active.delete(record);
            req.unpipe();
            body?.destroy();
            output?.destroy();
            proxyReq?.destroy();
            proxyRes?.destroy();
        }
        const deny = (status: number): void => {
            if (!cancelled && !res.headersSent) {
                res.status(status).send(status === 401 ? 'Unauthorized' : 'Proxy request refused');
            } else if (!cancelled) {
                res.destroy();
            }
            cleanup();
        };
        this.active.add(record);
        timer = setTimeout(() => deny(504), HTTP_MS);
        res.once('close', cleanup);
        req.once('aborted', () => deny(400));
        void this.authorize(req.headers, parsed.instance, deny)
            .then(auth => {
                if (!auth || cancelled) {
                    return;
                }
                if (!parsed.path) {
                    res.redirect(301, `${prefix}/${parsed.query}`);
                    cleanup();
                    return;
                }
                const target = auth.target;
                proxyReq = (target.protocol === 'https:' ? https : http).request({
                    protocol: target.protocol,
                    host: target.host,
                    port: target.port,
                    method: req.method,
                    path: `${parsed.path}${parsed.query}`,
                    headers: this.requestHeaders(req, prefix),
                    rejectUnauthorized: true,
                    minVersion: 'TLSv1.2',
                    agent: false,
                });
                proxyReq.on('error', () => deny(502));
                proxyReq.on('response', incoming => {
                    if (cancelled) {
                        incoming.destroy();
                        return;
                    }
                    proxyRes = incoming;
                    if (
                        incoming.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() === 'text/event-stream'
                    ) {
                        clearTimeout(timer);
                        timer = setTimeout(() => record.close(), STREAM_MS);
                        incoming.setTimeout(STREAM_IDLE_MS, () => record.close());
                        let checking = false;
                        recheck = setInterval(() => {
                            if (checking || cancelled) {
                                return;
                            }
                            checking = true;
                            void this.authorize(req.headers, parsed.instance, () => record.close())
                                .then(current => {
                                    if (
                                        !current ||
                                        current.user !== auth.user ||
                                        JSON.stringify(current.target) !== JSON.stringify(target)
                                    ) {
                                        record.close();
                                    }
                                })
                                .catch(() => record.close())
                                .finally(() => {
                                    checking = false;
                                });
                        }, AUTH_RECHECK_MS);
                        recheck.unref();
                    }
                    res.writeHead(
                        incoming.statusCode || 502,
                        this.responseHeaders(incoming.headers, prefix, target, req.headers.host || ''),
                    );
                    output = limitedStream(RESPONSE_BYTES);
                    output.on('error', () => record.close());
                    incoming.on('error', () => record.close());
                    incoming.pipe(output).pipe(res);
                });
                body = limitedStream(REQUEST_BYTES);
                body.on('error', () => deny(413));
                req.pipe(body).pipe(proxyReq);
            })
            .catch(() => deny(503));
    };

    private handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, parsed: Parsed): void {
        if (
            !parsed.path ||
            !this.sameOrigin(req, true) ||
            req.headers.upgrade?.toLowerCase() !== 'websocket' ||
            head.length > 65536
        ) {
            rejectUpgrade(socket, 403);
            return;
        }
        if (this.stopped || this.active.size >= MAX_ACTIVE) {
            rejectUpgrade(socket, 503);
            return;
        }
        let cancelled = false;
        let proxyReq: ClientRequest | undefined;
        let upstream: Duplex | undefined;
        let recheck: ReturnType<typeof setInterval> | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const active = this.active;
        const record: Active = { close };
        function shutdown(preserveClient: boolean): void {
            cancelled = true;
            clearTimeout(timer);
            clearInterval(recheck);
            active.delete(record);
            proxyReq?.destroy();
            upstream?.destroy();
            if (!preserveClient) {
                socket.destroy();
            }
        }
        function close(): void {
            shutdown(false);
        }
        const reject = (status: number): void => {
            shutdown(true);
            rejectUpgrade(socket, status);
        };
        this.active.add(record);
        socket.on('error', close);
        socket.once('close', close);
        timer = setTimeout(close, HTTP_MS);
        void this.authorize(req.headers, parsed.instance, reject)
            .then(auth => {
                if (!auth || cancelled) {
                    if (!cancelled) {
                        close();
                    }
                    return;
                }
                const target = auth.target;
                const headers = this.requestHeaders(req, this.prefix(parsed.instance));
                headers.connection = 'Upgrade';
                headers.upgrade = 'websocket';
                proxyReq = (target.protocol === 'https:' ? https : http).request({
                    protocol: target.protocol,
                    host: target.host,
                    port: target.port,
                    method: 'GET',
                    path: `${parsed.path}${parsed.query}`,
                    headers,
                    rejectUnauthorized: true,
                    minVersion: 'TLSv1.2',
                    agent: false,
                });
                proxyReq.on('error', () => {
                    if (!cancelled) {
                        reject(502);
                    }
                });
                proxyReq.on('response', response => {
                    response.destroy();
                    reject(response.statusCode || 502);
                });
                proxyReq.on('upgrade', (response, remote, first) => {
                    if (cancelled) {
                        remote.destroy();
                        return;
                    }
                    upstream = remote;
                    clearTimeout(timer);
                    timer = setTimeout(close, STREAM_MS);
                    if (remote instanceof Socket) {
                        remote.setTimeout(STREAM_IDLE_MS, close);
                    }
                    let checking = false;
                    recheck = setInterval(() => {
                        if (checking || cancelled) {
                            return;
                        }
                        checking = true;
                        void this.authorize(req.headers, parsed.instance, close)
                            .then(current => {
                                if (
                                    !current ||
                                    current.user !== auth.user ||
                                    JSON.stringify(current.target) !== JSON.stringify(target)
                                ) {
                                    close();
                                }
                            })
                            .catch(close)
                            .finally(() => {
                                checking = false;
                            });
                    }, AUTH_RECHECK_MS);
                    recheck.unref();
                    const outgoing = this.responseHeaders(
                        response.headers,
                        this.prefix(parsed.instance),
                        target,
                        req.headers.host || '',
                    );
                    outgoing.connection = 'Upgrade';
                    outgoing.upgrade = 'websocket';
                    const lines = ['HTTP/1.1 101 Switching Protocols'];
                    for (const [name, values] of Object.entries(outgoing)) {
                        for (const value of Array.isArray(values) ? values : [values]) {
                            if (value !== undefined) {
                                lines.push(`${name}: ${value}`);
                            }
                        }
                    }
                    socket.write(`${lines.join('\r\n')}\r\n\r\n`);
                    if (first.length) {
                        socket.write(first);
                    }
                    if (head.length) {
                        remote.write(head);
                    }
                    const toTarget = limitedStream(RESPONSE_BYTES),
                        toBrowser = limitedStream(RESPONSE_BYTES);
                    toTarget.on('error', close);
                    toBrowser.on('error', close);
                    remote.on('error', close);
                    remote.once('close', close);
                    socket.pipe(toTarget).pipe(remote).pipe(toBrowser).pipe(socket);
                });
                proxyReq.end();
            })
            .catch(() => {
                if (!cancelled) {
                    reject(503);
                }
            });
    }

    /** Intercept proxy upgrades before Admin's pathless websocket server. */
    attach(server: Server): void {
        if (this.detach) {
            return;
        }
        const original = server.emit;
        const proxy = this;
        function emit(this: Server, event: string | symbol, ...args: unknown[]): boolean {
            if (event === 'upgrade') {
                const request = args[0],
                    socket = args[1],
                    head = args[2];
                if (request instanceof http.IncomingMessage && proxy.matches(request.url)) {
                    if (socket instanceof Duplex && Buffer.isBuffer(head)) {
                        const parsed = proxy.parse(request.url);
                        if (parsed) {
                            proxy.handleUpgrade(request, socket, head, parsed);
                        } else {
                            rejectUpgrade(socket, 400);
                        }
                    }
                    return true;
                }
            }
            return Boolean(Reflect.apply(original, this, [event, ...args]));
        }
        const fallback = (_req: IncomingMessage, socket: Duplex): void => {
            if (server.listenerCount('upgrade') === 1) {
                socket.destroy();
            }
        };
        server.emit = emit;
        server.on('upgrade', fallback);
        this.detach = () => {
            if (server.emit === emit) {
                server.emit = original;
            }
            server.off('upgrade', fallback);
        };
    }
    /** Called on security-object changes; no cached identity survives a change. */
    invalidate(): void {
        this.generation++;
        for (const item of [...this.active]) {
            item.close();
        }
    }
    close(): void {
        this.stopped = true;
        this.invalidate();
        this.detach?.();
        this.detach = undefined;
    }
}
