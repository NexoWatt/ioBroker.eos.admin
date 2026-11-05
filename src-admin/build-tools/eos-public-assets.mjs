/**
 * Old EOS installations served public assets with a long cache lifetime. A new
 * response header cannot invalidate a response that the browser does not request.
 * Keep compatibility query values but bind public asset URLs to this release.
 */
export function versionPublicAssetUrls(html, release) {
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release)) {
        throw new Error('Invalid EOS frontend release version');
    }
    const result = html.replace(/\b(src|href)="([^"]+)"/g, (attribute, name, value) => {
        const decoded = value.replaceAll('&amp;', '&');
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(decoded)) return attribute;
        const hashIndex = decoded.indexOf('#');
        const fragment = hashIndex < 0 ? '' : decoded.slice(hashIndex);
        const address = hashIndex < 0 ? decoded : decoded.slice(0, hashIndex);
        const queryIndex = address.indexOf('?');
        const pathname = queryIndex < 0 ? address : address.slice(0, queryIndex);
        if (!/\.(?:js|css)$/i.test(pathname) || /^(?:\.\/|\/)?assets\//.test(pathname)) return attribute;
        const query = new URLSearchParams(queryIndex < 0 ? '' : address.slice(queryIndex + 1));
        query.set('eos-release', release);
        return `${name}="${pathname}?${query.toString().replaceAll('&', '&amp;')}${fragment}"`;
    });
    // The socket client is created dynamically before React starts, so it is not
    // represented by a script[src] attribute in the HTML input.
    return result.replace(
        /(['"])\.\/lib\/js\/socket\.io\.js(?:\?[^'"]*)?\1/g,
        JSON.stringify(`./lib/js/socket.io.js?eos-release=${encodeURIComponent(release)}`),
    );
}
