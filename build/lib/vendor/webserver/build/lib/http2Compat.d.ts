import http2 from 'node:http2';
/**
 * Make an HTTP/2 compat request and response usable for apps written against HTTP/1.
 *
 * Express replaces the prototype of every request and response with its own, which inherits from
 * `http.IncomingMessage` / `http.ServerResponse`. An `Http2ServerRequest` loses `url`, `headers`,
 * `method`, `_read` and the rest of its class that way, and the first read of the body throws
 * outside any handler - which takes the whole process down. Pinned to the instance, those members
 * come before whatever prototype is installed afterwards. HTTP/1 connection headers an app sets on
 * the response are dropped on the way.
 *
 * On top of that, it fills in two headers HTTP/1 code relies on:
 * - `host`: an HTTP/2 client sends the `:authority` pseudo-header instead, so `req.hostname` and
 *   every URL built from `req.get('host')` would come out empty;
 * - `transfer-encoding`: a body without `content-length` is valid in HTTP/2, but `type-is` - and so
 *   body-parser - only detects a body by one of these two headers and would skip it silently.
 *
 * @param req the HTTP/2 compat request
 * @param res the HTTP/2 compat response
 */
export declare function adaptHttp2Request(req: http2.Http2ServerRequest, res: http2.Http2ServerResponse): void;
