'use strict';

// ioBroker's file API returns complete buffers. Metadata admission and the
// post-read limit below do not make its underlying allocation a bounded stream.
// Directory exports are deliberately disabled until a bounded streaming API is used.
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 1000;
const MAX_CONCURRENT = 2;
const DEADLINE_MS = 5000;
let active = 0;
const userPattern = /^system\.user\.[a-z0-9_.@-]{1,128}$/i;
const namespacePattern = /^[a-z0-9][a-z0-9_.-]{0,127}$/i;

function failure(code, status) { return Object.assign(new Error(code), { code, status }); }

function parseDbFileRequest(input) {
    if (typeof input !== 'string' || input.length > 4096 || !input.startsWith('/')) throw failure('FILE_PATH_INVALID', 400);
    const rawPath = input.split('?')[0];
    // Reject separators hidden from the router, fragments, double encoding and
    // platform-specific path delimiters. Queries are never part of a filename.
    if (/%(?:2f|5c|3f|23|25|00)/i.test(rawPath) || /[\\#\u0000-\u001f\u007f]/.test(rawPath)) throw failure('FILE_PATH_INVALID', 400);
    let pathname;
    try { pathname = decodeURIComponent(rawPath); } catch { throw failure('FILE_PATH_INVALID', 400); }
    if (/[\\?#%:\u0000-\u001f\u007f]/.test(pathname)) throw failure('FILE_PATH_INVALID', 400);
    const parts = pathname.slice(1).split('/');
    const namespace = parts.shift();
    if (!namespacePattern.test(namespace || '') || namespace.includes('..')) throw failure('FILE_PATH_INVALID', 400);
    if (parts.length > 16 || parts.some(part => part === '.' || part === '..' || part.length > 255)) throw failure('FILE_PATH_INVALID', 400);
    if (parts.length && parts.at(-1) === '') parts.pop();
    if (parts.some(part => !part)) throw failure('FILE_PATH_INVALID', 400);
    return { namespace, filePath: parts.join('/') || 'index.html' };
}

function responseAvailable(req, res) { return !req.aborted && !res.destroyed && !res.writableEnded; }
function sendError(req, res, code, status) {
    if (responseAvailable(req, res) && !res.headersSent) res.status(status).json({ error: code });
}

function responseType(filePath) {
    const extension = filePath.split('.').at(-1).toLowerCase();
    const raster = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp' };
    if (Object.hasOwn(raster, extension)) return { type: raster[extension], attachment: false };
    if (['txt', 'log', 'csv', 'json'].includes(extension)) return { type: 'text/plain; charset=utf-8', attachment: false };
    // Never render untrusted HTML, SVG, JavaScript, XML or PDF on the Admin origin.
    return { type: 'application/octet-stream', attachment: true };
}

async function serveDbFile({ adapter, req, res, namespace, filePath, user }) {
    for (const [header, value] of Object.entries({ 'Cache-Control': 'no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "sandbox; default-src 'none'; base-uri 'none'; frame-ancestors 'none'" })) res.setHeader(header, value);
    if (typeof user !== 'string' || !userPattern.test(user)) { sendError(req, res, 'FILE_AUTH_REQUIRED', 403); return; }
    // Validate even when the caller accidentally bypasses the URL parser.
    try {
        const checked = parseDbFileRequest(`/${namespace}/${filePath}`);
        if (checked.namespace !== namespace || checked.filePath !== filePath) throw failure('FILE_PATH_INVALID', 400);
    } catch { sendError(req, res, 'FILE_PATH_INVALID', 400); return; }
    if (!responseAvailable(req, res)) return;
    if (active >= MAX_CONCURRENT) { sendError(req, res, 'FILE_CAPACITY_UNAVAILABLE', 503); return; }
    active++;
    let stopped = false;
    let timer;
    let resolveRequest;
    const returned = new Promise(resolve => { resolveRequest = resolve; });
    const cleanup = () => {
        clearTimeout(timer);
        req.removeListener?.('aborted', abort);
        res.removeListener?.('close', close);
    };
    const stop = (code, status) => {
        if (stopped) return;
        stopped = true;
        cleanup();
        if (res.headersSent && !res.writableFinished) res.destroy?.();
        else if (code) sendError(req, res, code, status);
        resolveRequest();
    };
    const abort = () => stop(null, 0);
    const close = () => { if (!res.writableFinished) abort(); };
    req.once?.('aborted', abort);
    res.once?.('close', close);
    timer = setTimeout(() => stop('FILE_DEADLINE_EXCEEDED', 504), DEADLINE_MS);
    const assertLive = () => { if (stopped || !responseAvailable(req, res)) throw failure('FILE_ABORTED', 499); };
    // There is no pending queue. A timed-out, non-cancellable DB call keeps its
    // reservation until it settles, so repeated timeouts cannot spawn more work.
    void (async () => {
        try {
            const split = filePath.lastIndexOf('/');
            const parent = split < 0 ? '' : filePath.slice(0, split);
            const leaf = filePath.slice(split + 1);
            const options = { user };
            const entries = await adapter.readDirAsync(namespace, parent, options);
            assertLive();
            if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) throw failure('FILE_DIRECTORY_LIMIT', 413);
            const matches = entries.filter(entry => entry && entry.file === leaf);
            if (matches.length !== 1) throw failure('FILE_NOT_FOUND', 404);
            const metadata = matches[0];
            if (metadata.isDir) throw failure('DIRECTORY_EXPORT_DISABLED', 403);
            const size = metadata.stats?.size;
            if (!Number.isSafeInteger(size) || size < 0) throw failure('FILE_METADATA_UNAVAILABLE', 503);
            if (size > MAX_BYTES) throw failure('FILE_SIZE_LIMIT', 413);
            const result = await adapter.readFileAsync(namespace, filePath, options);
            assertLive();
            const file = result?.file;
            const length = Buffer.isBuffer(file) ? file.length : typeof file === 'string' ? Buffer.byteLength(file, 'utf8') : -1;
            if (length < 0) throw failure('FILE_READ_UNAVAILABLE', 503);
            if (length > MAX_BYTES) throw failure('FILE_SIZE_LIMIT', 413);
            const output = responseType(filePath);
            res.setHeader('Content-Type', output.type);
            if (output.attachment) {
                const encoded = encodeURIComponent(leaf).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
                res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encoded}`);
            }
            // No automatic unlink: a GET must not delete a controller file.
            await new Promise((resolve, reject) => {
                const removeOutputListeners = () => {
                    res.removeListener?.('finish', finished);
                    res.removeListener?.('close', finished);
                };
                const finished = () => {
                    removeOutputListeners();
                    resolve();
                };
                res.once?.('finish', finished);
                res.once?.('close', finished);
                try {
                    res.status(200).send(file);
                    if (res.writableFinished || res.destroyed || typeof res.once !== 'function') finished();
                } catch (error) {
                    removeOutputListeners();
                    reject(error);
                }
            });
        } catch (error) {
            if (!stopped && error?.code !== 'FILE_ABORTED') {
                const safe = ['FILE_DIRECTORY_LIMIT', 'FILE_NOT_FOUND', 'DIRECTORY_EXPORT_DISABLED', 'FILE_METADATA_UNAVAILABLE', 'FILE_SIZE_LIMIT', 'FILE_READ_UNAVAILABLE'].includes(error?.code);
                sendError(req, res, safe ? error.code : 'FILE_READ_UNAVAILABLE', safe ? error.status : 403);
            }
        } finally {
            active--;
            stopped = true;
            cleanup();
            resolveRequest();
        }
    })();
    return returned;
}

module.exports = { parseDbFileRequest, serveDbFile };
