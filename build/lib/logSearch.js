"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LOG_FILES = exports.MAX_LOG_RESPONSE_BYTES = exports.MAX_LOG_FILE_BYTES = exports.MAX_ROWS_LIMIT = exports.LOG_LEVELS = void 0;
exports.getLogDirCandidates = getLogDirCandidates;
exports.getConfigFileCandidates = getConfigFileCandidates;
exports.getLogFileRegExp = getLogFileRegExp;
exports.resolveTransportLocation = resolveTransportLocation;
exports.detectLogLocation = detectLogLocation;
exports.selectLogFiles = selectLogFiles;
exports.createLocalLogFiles = createLocalLogFiles;
exports.createRemoteLogFiles = createRemoteLogFiles;
exports.validateLogSearchResult = validateLogSearchResult;
exports.searchLogFiles = searchLogFiles;
/**
 * Search in the log files of a host.
 *
 * The Log tab shows the newest entries the host hands out and everything that is logged afterwards. To
 * reach further back, the tab asks this module: it reads the rotated log files - the gzipped ones too -
 * and returns the entries that match the filters of the tab. The files of the host this admin instance
 * runs on are read from the disk, the ones of other hosts are requested from their js-controller.
 *
 * Derived from ioBroker.logsearch by Disaster123 (MIT License).
 */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_stream_1 = require("node:stream");
const node_path_1 = require("node:path");
const node_readline_1 = require("node:readline");
const node_util_1 = require("node:util");
const node_zlib_1 = require("node:zlib");
const gunzipAsync = (0, node_util_1.promisify)(node_zlib_1.gunzip);
/** Log levels from the least to the most severe, as the severity filter of the Log tab orders them */
exports.LOG_LEVELS = ['silly', 'debug', 'info', 'warn', 'error'];
/** More entries are never returned, whatever the client asks for */
exports.MAX_ROWS_LIMIT = 5000;
exports.MAX_LOG_FILE_BYTES = 8 * 1024 * 1024;
exports.MAX_LOG_RESPONSE_BYTES = 4 * 1024 * 1024;
exports.MAX_LOG_FILES = 64;
const MAX_LOG_LINE_CHARS = 16 * 1024;
const LOG_READ_TIMEOUT_MS = 5000;
const LOG_SEARCH_TIMEOUT_MS = 30000;
/** Default log file prefix of js-controller (`log/${appName}`) */
const DEFAULT_PREFIX = 'iobroker';
/** Extension js-controller appends if the configured file name has none */
const DEFAULT_EXTENSION = '.log';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Date of a rotated log file, whatever the prefix and the extension: `<prefix>.<YYYY-MM-DD>[.<n>][<ext>][.gz]`.
 *
 * Groups: 1 year, 2 month, 3 day, 4 counter
 */
const LOG_FILE_DATE = /\.(\d{4})-(\d{2})-(\d{2})(?:\.(\d+))?(?:\.[^.\d][^.]*)?(?:\.gz)?$/;
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');
/**
 * One line that starts a log entry, without color codes:
 * `2026-09-16 10:11:12.123  - info: admin.0 (1234) text`.
 *
 * Groups: 1 date, 2 time, 3 level, 4 everything after the level (source, PID and text), 5 source
 */
const LOG_LINE = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s+-\s+(silly|debug|info|warn|error):\s+((\S+).*)$/i;
function toPosix(path) {
    return path.replace(/\\/g, '/');
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * js-controller resolves a relative log file name against the installation root of an npm installation
 * and against its own directory if it runs from its repository (`isNpm` in `logger.ts`).
 *
 * @param controllerDir root directory of js-controller
 */
function isNpmInstallation(controllerDir) {
    return !toPosix(controllerDir).toLowerCase().includes('iobroker.js-controller/packages/');
}
/**
 * Directories a relative log path may point to, in the order in which the `getLogFiles` host command
 * of js-controller tries them: walking up from the controller directory.
 *
 * @param relativeDir directory part of the configured `filename`, e.g. `log`
 * @param controllerDir root directory of js-controller
 */
function getLogDirCandidates(relativeDir, controllerDir) {
    const candidates = [];
    const parts = ['..', '..', '..', '..'];
    do {
        parts.pop();
        candidates.push((0, node_path_1.normalize)(`${controllerDir}/${parts.join('/')}/${relativeDir}`));
    } while (parts.length);
    return candidates;
}
/**
 * Possible places of `iobroker.json`, like `tools.getConfigFileName()` of js-controller.
 *
 * @param controllerDir root directory of js-controller
 * @param env environment to read `IOBROKER_DATA_DIR` from
 */
function getConfigFileCandidates(controllerDir, env) {
    const candidates = [];
    const envDataDir = env.IOBROKER_DATA_DIR;
    if (envDataDir) {
        const dataDir = /^\w:[/\\]|^[/\\]/.test(envDataDir) ? envDataDir : (0, node_path_1.join)(controllerDir, envDataDir);
        candidates.push((0, node_path_1.join)(dataDir, 'iobroker.json'));
    }
    if (controllerDir) {
        // npm installation: <root>/iobroker-data/iobroker.json
        candidates.push((0, node_path_1.normalize)((0, node_path_1.join)(controllerDir, '..', '..', 'iobroker-data', 'iobroker.json')));
        // development checkout
        candidates.push((0, node_path_1.join)(controllerDir, 'conf', 'iobroker.json'));
        candidates.push((0, node_path_1.join)(controllerDir, 'data', 'iobroker.json'));
    }
    return candidates;
}
/**
 * The rotated log files of a location: `<prefix>.<YYYY-MM-DD>[.<n>]<extension>[.gz]`.
 *
 * js-controller always rotates daily. A counter only appears if a `maxSize` is configured; the file of
 * the day has none, the next ones count up from 1.
 *
 * Groups: 1 year, 2 month, 3 day, 4 counter
 *
 * @param location naming of the files
 */
function getLogFileRegExp(location) {
    return new RegExp(`^${escapeRegExp(location.prefix)}\\.(\\d{4})-(\\d{2})-(\\d{2})(?:\\.(\\d+))?${escapeRegExp(location.extension)}(?:\\.gz)?$`);
}
/**
 * Take directory and naming of the log files from the `log.transport` section of `iobroker.json`.
 *
 * The naming follows the preparation of the file transport in `logger.ts`. A relative `filename` is
 * looked up like the `getLogFiles` host command does it; only if none of the candidates exists yet,
 * the path the controller is going to create is returned.
 *
 * @param config content of `iobroker.json`
 * @param controllerDir root directory of js-controller
 * @param probe tells whether a directory holds log files (`files`), exists (`exists`) or not (`no`)
 */
function resolveTransportLocation(config, controllerDir, probe) {
    const transports = config?.log?.transport;
    if (!transports || typeof transports !== 'object') {
        return null;
    }
    for (const transport of Object.values(transports)) {
        if (!transport || typeof transport !== 'object' || transport.type !== 'file' || transport.enabled === false) {
            continue;
        }
        const filename = toPosix(typeof transport.filename === 'string' && transport.filename ? transport.filename : `log/${DEFAULT_PREFIX}`);
        const prefix = (0, node_path_1.basename)(filename);
        // js-controller only appends ".log" if the configured name does not end with it already
        let extension;
        if (typeof transport.fileext === 'string' && transport.fileext) {
            extension = transport.fileext;
        }
        else {
            extension = prefix.toLowerCase().endsWith('.log') ? '' : DEFAULT_EXTENSION;
        }
        const naming = { prefix, extension };
        if (/^\w:\/|^\//.test(filename)) {
            return { ...naming, directory: (0, node_path_1.dirname)((0, node_path_1.normalize)(filename)) };
        }
        const candidates = getLogDirCandidates((0, node_path_1.dirname)(filename), controllerDir);
        if (probe) {
            // several candidates may exist: the one that holds log files is the right one
            const withFiles = candidates.find(candidate => probe(candidate, naming) === 'files');
            if (withFiles) {
                return { ...naming, directory: withFiles };
            }
            const existing = candidates.find(candidate => probe(candidate, naming) !== 'no');
            if (existing) {
                return { ...naming, directory: existing };
            }
        }
        return {
            ...naming,
            directory: (0, node_path_1.dirname)((0, node_path_1.normalize)(`${controllerDir}${isNpmInstallation(controllerDir) ? '/../../' : '/'}${filename}`)),
        };
    }
    return null;
}
/**
 * Find out where the log files of this host are and how they are named.
 *
 * @param options where js-controller is, and injectable file system access for tests
 */
function detectLogLocation(options) {
    const exists = options.exists || ((path) => (0, node_fs_1.existsSync)(path));
    const readFile = options.readFile || ((path) => (0, node_fs_1.readFileSync)(path, 'utf8'));
    const readDir = options.readDir || ((path) => (0, node_fs_1.readdirSync)(path));
    const env = options.env || process.env;
    const { controllerDir } = options;
    const probe = (directory, naming) => {
        if (!exists(directory)) {
            return 'no';
        }
        try {
            const regExp = getLogFileRegExp(naming);
            return readDir(directory).some(name => regExp.test(name)) ? 'files' : 'exists';
        }
        catch {
            return 'exists';
        }
    };
    for (const candidate of getConfigFileCandidates(controllerDir, env)) {
        if (!exists(candidate)) {
            continue;
        }
        try {
            const location = resolveTransportLocation(JSON.parse(readFile(candidate)), controllerDir, probe);
            if (location) {
                return { ...location, source: 'controller-config' };
            }
        }
        catch {
            // an unreadable configuration is treated like a missing one
        }
    }
    // no usable iobroker.json: look for the default `log/` next to the installation
    const naming = { prefix: DEFAULT_PREFIX, extension: DEFAULT_EXTENSION };
    const candidates = [
        options.dataDir ? (0, node_path_1.normalize)((0, node_path_1.join)(options.dataDir, '..', 'log')) : '',
        ...(controllerDir ? getLogDirCandidates('log', controllerDir) : []),
    ].filter(candidate => !!candidate);
    const withFiles = candidates.find(candidate => probe(candidate, naming) === 'files');
    if (withFiles) {
        return { ...naming, directory: withFiles, source: 'probe' };
    }
    const existing = candidates.find(candidate => probe(candidate, naming) !== 'no');
    if (existing) {
        return { ...naming, directory: existing, source: 'probe' };
    }
    return { ...naming, directory: candidates[0] || '', source: 'fallback' };
}
/**
 * The log files that may hold entries of the given time range, newest first.
 *
 * @param names names of the rotated log files
 * @param minTs start of the time range
 * @param maxTs end of the time range
 */
function selectLogFiles(names, minTs, maxTs) {
    const files = [];
    for (const name of names) {
        const match = name.match(LOG_FILE_DATE);
        if (!match) {
            continue;
        }
        const [, year, month, day, counter] = match;
        const dayStart = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
        // a file is written during its day, so a file of an earlier day cannot hold newer entries
        if (dayStart + ONE_DAY_MS <= minTs || dayStart > maxTs) {
            continue;
        }
        files.push({ name, day: `${year}-${month}-${day}`, counter: counter ? Number(counter) : 0 });
    }
    return files
        .sort((a, b) => (a.day === b.day ? b.counter - a.counter : a.day < b.day ? 1 : -1))
        .map(file => file.name);
}
/**
 * The log files in a directory of this host.
 *
 * `.current.log` is not listed: it is only a link to the file of today, which is read anyway.
 *
 * @param location where the files are and how they are named
 */
function createLocalLogFiles(location) {
    return {
        async list() {
            let names;
            try {
                names = await (0, promises_1.readdir)(location.directory);
            }
            catch (error) {
                throw new Error(`Cannot read the log directory ${location.directory}: ${error.message}`);
            }
            const regExp = getLogFileRegExp(location);
            if (names.length > 10000) {
                throw new Error('Log directory limit exceeded');
            }
            return names.filter(name => regExp.test(name));
        },
        async readLines(name, onLine) {
            if ((0, node_path_1.basename)(name) !== name || !getLogFileRegExp(location).test(name)) {
                throw new Error('Invalid log file path');
            }
            const path = (0, node_path_1.join)(location.directory, name);
            // The descriptor is opened without following a link; validation and reading share it.
            const handle = await (0, promises_1.open)(path, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
            try {
                const info = await handle.stat();
                if (!info.isFile() || info.size > exports.MAX_LOG_FILE_BYTES) {
                    throw new Error('Log file exceeds resource limits');
                }
                if (!info.size) {
                    return true;
                }
                const input = handle.createReadStream({ start: 0, end: info.size - 1, autoClose: false });
                const source = name.endsWith('.gz') ? input.pipe((0, node_zlib_1.createGunzip)()) : input;
                let bytes = 0;
                const limiter = new node_stream_1.Transform({
                    transform(chunk, _encoding, callback) {
                        bytes += chunk.length;
                        callback(bytes > exports.MAX_LOG_FILE_BYTES ? new Error('Expanded log limit exceeded') : null, chunk);
                    },
                });
                const reader = (0, node_readline_1.createInterface)({ input: source.pipe(limiter), crlfDelay: Infinity });
                const stop = (error) => {
                    limiter.destroy(error);
                };
                input.on('error', stop);
                if (source !== input) {
                    source.on('error', stop);
                }
                const timer = setTimeout(() => stop(new Error('Log file read timed out')), LOG_READ_TIMEOUT_MS);
                try {
                    for await (const line of reader) {
                        if (line.length > MAX_LOG_LINE_CHARS) {
                            throw new Error('Log line exceeds resource limits');
                        }
                        onLine(line);
                    }
                    return true;
                }
                finally {
                    clearTimeout(timer);
                    reader.close();
                    input.destroy();
                    source.destroy();
                    limiter.destroy();
                }
            }
            finally {
                await handle.close();
            }
        },
    };
}
/**
 * Content of a file, as the host sends it: normally a buffer, but a message may also hold its JSON form.
 *
 * @param data the `data` of the `getLogFile` answer
 */
function toBuffer(data) {
    if (Buffer.isBuffer(data)) {
        return data.length <= exports.MAX_LOG_FILE_BYTES ? data : null;
    }
    if (data instanceof Uint8Array) {
        return data.length <= exports.MAX_LOG_FILE_BYTES ? Buffer.from(data) : null;
    }
    if (typeof data === 'string') {
        return Buffer.byteLength(data, 'utf8') <= exports.MAX_LOG_FILE_BYTES ? Buffer.from(data, 'utf8') : null;
    }
    if (data && typeof data === 'object' && Array.isArray(data.data)) {
        const values = data.data;
        if (values.length > exports.MAX_LOG_FILE_BYTES ||
            !values.every(value => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255)) {
            return null;
        }
        return Buffer.from(values);
    }
    return null;
}
/**
 * The log files of another host, requested from its js-controller with the host commands `getLogFiles` and
 * `getLogFile`. Every read file is transferred completely.
 *
 * @param request sends a command to the host and resolves with its answer; it rejects if the host does not answer
 */
function createRemoteLogFiles(request) {
    /** The transport - the log configuration of the host - each file belongs to */
    const transports = new Map();
    return {
        async list() {
            const answer = (await request('getLogFiles', null));
            if (!answer || !Array.isArray(answer.list) || answer.list.length > 10000) {
                throw new Error('The host did not send its log files');
            }
            transports.clear();
            for (const file of answer.list) {
                if (!file ||
                    typeof file.fileName !== 'string' ||
                    file.fileName.length > 1024 ||
                    !Number.isSafeInteger(file.size) ||
                    file.size < 0 ||
                    file.size > exports.MAX_LOG_FILE_BYTES) {
                    continue;
                }
                const [, , transport, ...parts] = file.fileName.split('/');
                const name = parts.join('/');
                // several transports may write into the same directory: every file is read once
                if (transport &&
                    /^[A-Za-z0-9_-]{1,128}$/.test(transport) &&
                    name &&
                    (0, node_path_1.basename)(name) === name &&
                    LOG_FILE_DATE.test(name) &&
                    !transports.has(name)) {
                    transports.set(name, transport);
                }
            }
            return [...transports.keys()];
        },
        async readLines(name, onLine) {
            if (!transports.has(name)) {
                throw new Error('Unlisted log file');
            }
            const answer = (await request('getLogFile', {
                filename: name,
                transport: transports.get(name),
            }));
            if (answer?.error) {
                // the file was rotated away since it was listed
                if (answer.error.startsWith('Cannot read file')) {
                    return false;
                }
                throw new Error(answer.error);
            }
            let data = toBuffer(answer?.data);
            if (!data) {
                throw new Error(`The host did not send the log file ${name}`);
            }
            if (name.endsWith('.gz')) {
                data = await gunzipAsync(data, { maxOutputLength: exports.MAX_LOG_FILE_BYTES });
            }
            const lines = data.toString('utf8').split(/\r?\n/);
            // the last part is empty after a complete line - or a line that was being written
            lines.pop();
            lines.forEach(line => {
                if (line.length > MAX_LOG_LINE_CHARS) {
                    throw new Error('Log line exceeds resource limits');
                }
                onLine(line);
            });
            return true;
        },
    };
}
/** Validate controller search replies before returning them to the browser. */
function validateLogSearchResult(value) {
    if (!value ||
        typeof value !== 'object' ||
        !('lines' in value) ||
        !Array.isArray(value.lines) ||
        value.lines.length > exports.MAX_ROWS_LIMIT ||
        !('truncated' in value) ||
        typeof value.truncated !== 'boolean' ||
        !('files' in value) ||
        typeof value.files !== 'number' ||
        !Number.isSafeInteger(value.files) ||
        value.files < 0 ||
        value.files > exports.MAX_LOG_FILES ||
        !('until' in value) ||
        typeof value.until !== 'number' ||
        !Number.isFinite(value.until)) {
        return undefined;
    }
    const lines = [];
    let bytes = 0;
    for (const line of value.lines) {
        if (typeof line !== 'string' || line.length > MAX_LOG_LINE_CHARS) {
            return undefined;
        }
        bytes += Buffer.byteLength(line, 'utf8');
        if (bytes > exports.MAX_LOG_RESPONSE_BYTES) {
            return undefined;
        }
        lines.push(line);
    }
    return { lines, truncated: value.truncated, files: value.files, until: value.until };
}
/**
 * Search the log files.
 *
 * The files are read from the newest to the oldest, and the reading stops as soon as enough entries
 * were found. Lines that do not start with a time stamp belong to the entry above them.
 *
 * @param options where to search and what to look for
 */
async function searchLogFiles(options) {
    // Both limits are taken once: an entry logged while the files are read is not returned, the client
    // gets it from the live log. See `until`.
    const until = options.now ?? Date.now();
    const minTs = until - Math.min(24 * 366, Math.max(1, Number(options.hours) || 1)) * 60 * 60 * 1000;
    const maxRows = Math.min(Math.max(1, Math.floor(Number(options.maxRows) || 500)), exports.MAX_ROWS_LIMIT);
    const minLevel = options.level && exports.LOG_LEVELS.includes(options.level) ? exports.LOG_LEVELS.indexOf(options.level) : 0;
    const source = (options.source || '').slice(0, 256);
    const needle = (options.text || '').slice(0, 1024).toLowerCase();
    const allNames = selectLogFiles(await options.files.list(), minTs, until);
    const names = allNames.slice(0, exports.MAX_LOG_FILES);
    const deadline = performance.now() + LOG_SEARCH_TIMEOUT_MS;
    /** The newest matches, oldest first */
    let result = [];
    let truncated = allNames.length > exports.MAX_LOG_FILES;
    let files = 0;
    for (let f = 0; f < names.length; f++) {
        if (performance.now() > deadline) {
            throw new Error('Log search timed out');
        }
        // Keep one match more than needed: it tells that the result is truncated
        const needed = maxRows - result.length;
        let matches = [];
        let entry = null;
        const finish = () => {
            if (entry &&
                entry.ts >= minTs &&
                entry.ts <= until &&
                exports.LOG_LEVELS.indexOf(entry.level) >= minLevel &&
                (!source || entry.source === source) &&
                (!needle || entry.message.toLowerCase().includes(needle))) {
                matches.push(entry.raw.join('\n'));
                // the older matches of this file are not needed any more; cut them in blocks
                if (matches.length > needed * 2 + 1) {
                    matches = matches.slice(matches.length - needed - 1);
                }
            }
            entry = null;
        };
        const read = await options.files.readLines(names[f], line => {
            if (performance.now() > deadline) {
                throw new Error('Log search timed out');
            }
            if (line.length > MAX_LOG_LINE_CHARS) {
                throw new Error('Log line limit exceeded');
            }
            const plain = line.replace(ANSI_ESCAPE, '');
            const match = plain.match(LOG_LINE);
            if (match) {
                finish();
                entry = {
                    ts: new Date(`${match[1]}T${match[2]}`).getTime(),
                    level: match[3].toLowerCase(),
                    source: match[5],
                    message: match[4],
                    raw: [line],
                };
            }
            else if (entry && line) {
                // continuation of a multi-line entry, e.g. a stack trace
                if (entry.message.length + plain.length > MAX_LOG_LINE_CHARS) {
                    truncated = true;
                    return;
                }
                entry.message += `\n${plain}`;
                entry.raw.push(line);
            }
        });
        if (!read) {
            // rotated or compressed in the meantime
            continue;
        }
        finish();
        files++;
        if (matches.length > needed) {
            truncated = true;
            matches = matches.slice(matches.length - needed);
        }
        result = matches.concat(result);
        let responseBytes = 0;
        for (let i = result.length - 1; i >= 0; i--) {
            responseBytes += Buffer.byteLength(result[i], 'utf8');
            if (responseBytes > exports.MAX_LOG_RESPONSE_BYTES) {
                result = result.slice(i + 1);
                truncated = true;
                return { lines: result, truncated, files, until };
            }
        }
        if (result.length >= maxRows) {
            // older files are not read, so there may be more entries
            truncated ||= f < names.length - 1;
            break;
        }
    }
    return { lines: result, truncated, files, until };
}
//# sourceMappingURL=logSearch.js.map