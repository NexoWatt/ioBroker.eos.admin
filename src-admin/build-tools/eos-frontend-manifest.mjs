import { createHash } from 'node:crypto';
import { versionPublicAssetUrls } from './eos-public-assets.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, posix } from 'node:path';

/** Bind each reviewed build to its sources and defer all entry code until EOS role discovery succeeds. */
export default function eosFrontendManifest() {
    let root;
    return {
        name: 'nexowatt-eos-role-gated-frontend',
        apply: 'build',
        enforce: 'post',
        configResolved(config) {
            root = config.root;
        },
        buildStart() {
            const release = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
            // Compatibility endpoint for consumers that ask for the conventional name.
            // The actual Admin8 host and federation manifest use the versioned entry.
            this.emitFile({
                type: 'asset',
                fileName: 'remoteEntry.js',
                source: `export * from "./remoteEntry-eos-${release}.js";\n`,
            });
        },
        transformIndexHtml: {
            order: 'pre',
            handler(html) {
                return html.replace('</body>', '<script type="module" src="/src/index.tsx"></script></body>');
            },
        },
        generateBundle: {
            order: 'post',
            handler(_options, bundle) {
                const html = bundle['index.html'];
                if (!html || html.type !== 'asset' || typeof html.source !== 'string') {
                    this.error('EOS frontend build did not emit index.html');
                }
                const entries = [];
                html.source = html.source.replace(
                    /<script\b[^>]*\btype=["']module["'][^>]*>[\s\S]*?<\/script>/gi,
                    tag => {
                        const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
                        if (!src) this.error('Unexpected inline module startup: role-gated entry must be explicit');
                        entries.push(src);
                        return '';
                    },
                );
                if (entries.length !== 1) this.error(`Expected one compiled EOS entry, found ${entries.length}`);
                html.source = html.source.replace(/\bdata-eos-entry="[^"]*"/, `data-eos-entry="${entries[0]}"`);
                html.source = html.source.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/g, '');
                if (!html.source.includes(`data-eos-entry="${entries[0]}"`))
                    this.error('EOS role bootstrap entry is missing');
                const productVersion = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
                html.source = versionPublicAssetUrls(html.source, productVersion);
                const sources = {};
                function visit(dir) {
                    for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
                        a.name.localeCompare(b.name),
                    )) {
                        const path = resolve(dir, item.name);
                        if (item.isDirectory()) visit(path);
                        else if (item.isFile())
                            sources[relative(root, path).replaceAll('\\', '/')] = createHash('sha256')
                                .update(readFileSync(path))
                                .digest('hex');
                    }
                }
                for (const dir of ['src', 'public', 'build-tools']) visit(resolve(root, dir));
                for (const file of [
                    'package.json',
                    'package-lock.json',
                    'vite.config.ts',
                    'tsconfig.json',
                    'index.html',
                ]) {
                    sources[file] = createHash('sha256')
                        .update(readFileSync(resolve(root, file)))
                        .digest('hex');
                }
                const chunks = Object.fromEntries(
                    Object.values(bundle)
                        .filter(item => item.type === 'chunk')
                        .map(item => [
                            item.fileName,
                            {
                                imports: item.imports,
                                dynamicImports: item.dynamicImports,
                                modules: Object.keys(item.modules).map(id =>
                                    id.startsWith(root)
                                        ? relative(root, id).replaceAll('\\', '/')
                                        : id.replaceAll(resolve(root, '..'), '<project>').replaceAll('\\', '/'),
                                ),
                            },
                        ]),
                );
                const assets = {};
                for (const item of Object.values(bundle)) {
                    if (item.type !== 'asset' || !/\.[cm]?js$/.test(item.fileName)) continue;
                    const code =
                        typeof item.source === 'string' ? item.source : Buffer.from(item.source).toString('utf8');
                    const imports = [];
                    const references = [
                        ...code.matchAll(/(?:__mfImport|\bimport)\s*\(\s*(["'])([^"']+)\1\s*\)/g),
                        ...code.matchAll(/\b(?:import|export)\s+(?:[^'";\n]*?\s+from\s+)?(["'])([^"']+)\1/g),
                    ];
                    for (const match of references) {
                        const specifier = match[2];
                        if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
                            this.error(`Unexpected federation asset import ${specifier} in ${item.fileName}`);
                        }
                        const dependency = posix.normalize(posix.join(posix.dirname(item.fileName), specifier));
                        if (dependency.startsWith('../') || posix.isAbsolute(dependency) || dependency.includes('\\')) {
                            this.error(`Federation asset import escapes output: ${specifier}`);
                        }
                        if (!bundle[dependency]) this.error(`Missing federation asset dependency ${dependency}`);
                        imports.push(dependency);
                    }
                    assets[item.fileName] = {
                        sha256: createHash('sha256').update(code).digest('hex'),
                        imports: [...new Set(imports)],
                    };
                }
                this.emitFile({
                    type: 'asset',
                    fileName: 'NEXOWATT_EOS_FRONTEND_MANIFEST.json',
                    source:
                        JSON.stringify(
                            {
                                schemaVersion: 1,
                                productVersion,
                                upstream: { version: '8.3.5', commit: '6f77eedf525813a7a61d79188d1ff05dffd05086' },
                                entry: entries[0].replace(/^\.\//, ''),
                                roleBootstrap: 'js/eos-role-bootstrap.js',
                                sourceHash: createHash('sha256').update(JSON.stringify(sources)).digest('hex'),
                                sources,
                                chunks,
                                assets,
                            },
                            null,
                            2,
                        ) + '\n',
                });
            },
        },
    };
}
