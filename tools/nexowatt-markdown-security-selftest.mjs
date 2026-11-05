import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'src-admin/package.json'));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = readFileSync(resolve(root, 'src-admin/src/components/SafeMarkdownView.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
});
const code = compiled.outputText.replace(
    /from (['"])([^'".][^'"]*)\1/g,
    (_, quote, name) => `from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`,
);
const { default: SafeMarkdown, safeDocumentationUrl } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const render = markdown =>
    renderToStaticMarkup(
        React.createElement(SafeMarkdown, {
            markdown,
            baseUrl: 'https://raw.githubusercontent.com/test/repo/main/README.md',
            headingId: text => text.toLowerCase().replaceAll(' ', '-'),
            onAnchor() {},
            headingPrefix: '#tab-help',
        }),
    );
for (const url of [
    'javascript:alert(1)',
    'data:text/html,test',
    'vbscript:evil',
    '//evil.example/path',
    '\\evil',
    'https://user:pass@example.com/',
    'java\nscript:evil',
]) {
    assert.equal(safeDocumentationUrl(url, 'https://example.com/docs/'), undefined, url);
}
assert.equal(safeDocumentationUrl('mailto:user@example.com', 'https://example.com/'), 'mailto:user@example.com');
assert.equal(safeDocumentationUrl('mailto:user@example.com', 'https://example.com/', true), undefined);
assert.equal(
    safeDocumentationUrl('../img/test.png', 'https://example.com/docs/README.md', true),
    'https://example.com/img/test.png',
);
const attack = render(
    '<img src=x onerror="alert(1)">\n<script>alert(1)</script>\n\n[evil](javascript:alert%281%29)\n\n![bad](data:image/svg+xml,test)',
);
assert.doesNotMatch(attack, /<script|onerror|javascript:|data:image|<img/i);
const links = render(
    '[Read more](docs/guide.md) ![Logo](admin/icon.png) [Web](https://example.com) [Chapter](#chapter)',
);
assert.match(links, /href="https:\/\/github.com\/test\/repo\/blob\/main\/docs\/guide.md"/);
assert.match(links, /src="https:\/\/raw.githubusercontent.com\/test\/repo\/main\/admin\/icon.png"/);
assert.match(links, /rel="noopener noreferrer"/);
assert.match(links, /href="#chapter"/);
const headings = render('## Hello **world**\n\n| A | B |\n| --- | --- |\n| x | y |\n\n~~old~~\n\n- [x] done');
assert.match(headings, /<h2 id="hello-world">/);
assert.match(headings, /href="#tab-help\?hello-world"/);
assert.match(headings, /<table>/);
assert.match(headings, /<del>old<\/del>/);
assert.match(headings, /type="checkbox"/);
const quoted = render('## Text " onclick="evil\n\n[quoted "](https://example.com "title")');
assert.doesNotMatch(quoted, /["']\s+onclick\s*=/i);
assert.doesNotMatch(source, /dangerouslySetInnerHTML|rehypeRaw|react-showdown/);
console.log('PASS Markdown security renderer (URL policy, real React SSR, XSS payloads, links/images/headings/GFM)');

// Actual Markdown component lifecycle: a newer load/unmount cancels authority to publish old results.
const vm = await import('node:vm');
const { DocumentationFetchError } = await import('../src-admin/src/helpers/documentationFetch.ts');
const requests = [];
const markdownSource = readFileSync(resolve(root, 'src-admin/src/components/Markdown.tsx'), 'utf8');
const lifecycleCode = ts.transpileModule(markdownSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const lifecycleExports = {};
new vm.Script(lifecycleCode).runInNewContext({
    exports: lifecycleExports, window: { location: { href: 'https://admin.example/', hash: '#help' } },
    console, setTimeout, clearTimeout, AbortController,
    require: name => name === 'react' ? React
        : name === '@iobroker/gui-components' ? { I18n: { t: text => text } }
        : name === '@/helpers/documentationFetch' ? {
            DocumentationFetchError,
            fetchDocumentation: (url, base, signal) => new Promise((resolve, reject) => requests.push({ url, base, signal, resolve, reject })),
        } : {},
});
const Markdown = lifecycleExports.default;
const component = Object.create(Markdown.prototype);
component.mounted = true;
component.state = {};
component.setState = (state, callback) => { Object.assign(component.state, state); callback?.(); };
const rendered = [];
component.parseText = text => rendered.push(text);
const oldLoad = component.loadDocument('/old');
const newLoad = component.loadDocument('/new');
assert.equal(requests[0].signal.aborted, true);
requests[0].resolve('old'); await oldLoad;
assert.deepEqual(rendered, []);
requests[1].resolve('new'); await newLoad;
assert.deepEqual(rendered, ['new']);
const failedLoad = component.loadDocument('/timeout');
requests[2].reject(new DocumentationFetchError('TIMEOUT')); await failedLoad;
assert.equal(component.state.documentError, 'Documentation request timed out');
assert.equal(component.state.loadTimeout, false);
const unmountedLoad = component.loadDocument('/unmount');
component.componentWillUnmount();
assert.equal(requests[3].signal.aborted, true);
requests[3].resolve('late'); await unmountedLoad;
assert.deepEqual(rendered, ['new']);
assert.equal(component.documentLoadingTimer, undefined);
console.log('PASS Markdown request lifecycle (new request cancels old, stale results ignored, timeout shown, unmount cancels)');
