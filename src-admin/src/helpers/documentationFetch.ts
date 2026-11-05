/** Bounded documentation transport. Its single deadline covers headers and the complete streamed body. */
export const DOCUMENTATION_TIMEOUT_MS = 5_000;
export const DOCUMENTATION_MAX_BYTES = 2 * 1024 * 1024;
export type DocumentationFailure = 'ABORTED' | 'TIMEOUT' | 'TOO_LARGE' | 'HTTP_ERROR' | 'UNSAFE_URL' | 'NETWORK_ERROR';
export class DocumentationFetchError extends Error {
    readonly code: DocumentationFailure;
    constructor(code: DocumentationFailure) {
        super(code);
        this.name = 'DocumentationFetchError';
        this.code = code;
    }
}

export async function fetchDocumentation(url: string, baseUrl: string, signal: AbortSignal): Promise<string> {
    let target: URL;
    let base: URL;
    try {
        base = new URL(baseUrl);
        target = new URL(url, base);
    } catch {
        throw new DocumentationFetchError('UNSAFE_URL');
    }
    if (
        target.username ||
        target.password ||
        (target.protocol !== 'https:' && !(target.protocol === 'http:' && target.origin === base.origin))
    ) {
        throw new DocumentationFetchError('UNSAFE_URL');
    }
    if (signal.aborted) {
        throw new DocumentationFetchError('ABORTED');
    }
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = (): void => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, DOCUMENTATION_TIMEOUT_MS);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let complete = false;
    try {
        const response = await fetch(target.href, {
            signal: controller.signal,
            credentials: 'same-origin',
            redirect: 'error',
            headers: { Accept: 'text/markdown, text/plain, text/*;q=0.8' },
        });
        if (!response.ok) {
            throw new DocumentationFetchError('HTTP_ERROR');
        }
        const length = response.headers.get('Content-Length');
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > DOCUMENTATION_MAX_BYTES)) {
            throw new DocumentationFetchError('TOO_LARGE');
        }
        if (!response.body) {
            complete = true;
            return '';
        }
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parts: string[] = [];
        let received = 0;
        while (true) {
            controller.signal.throwIfAborted();
            const { done, value } = await reader.read();
            controller.signal.throwIfAborted();
            if (done) {
                break;
            }
            received += value.byteLength;
            if (received > DOCUMENTATION_MAX_BYTES) {
                throw new DocumentationFetchError('TOO_LARGE');
            }
            parts.push(decoder.decode(value, { stream: true }));
        }
        parts.push(decoder.decode());
        complete = true;
        return parts.join('');
    } catch (error) {
        if (signal.aborted) {
            throw new DocumentationFetchError('ABORTED');
        }
        if (timedOut) {
            throw new DocumentationFetchError('TIMEOUT');
        }
        if (error instanceof DocumentationFetchError) {
            throw error;
        }
        throw new DocumentationFetchError('NETWORK_ERROR');
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        if (!complete) {
            controller.abort();
            // Cancellation must not extend the request deadline. The stream error is already handled above.
            void reader?.cancel().catch(() => undefined);
        }
        reader?.releaseLock();
    }
}
