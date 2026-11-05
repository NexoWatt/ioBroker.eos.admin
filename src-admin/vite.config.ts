import { defineConfig, type Plugin } from 'vite';
import eosObjectBrowserTransform from './build-tools/eos-object-browser-transform.mjs';
import eosFrontendManifest from './build-tools/eos-frontend-manifest.mjs';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
// NOTE: @module-federation/vite is pinned to an exact version in package.json.
// 1.21.3 hangs forever on `vite build`: a single JS thread spins at 100% CPU after the
// "moduleParseIdleTimeout ... forcing resolve" warning and the build never emits anything.
// 1.21.1 and 1.21.2 both complete in ~1 min. Verify a build before lifting the pin.
import { federation } from '@module-federation/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moduleFederationShared } from '@iobroker/gui-components/modulefederation.admin.config';

/**
 * Shared modules that admin does not bundle eagerly.
 *
 * A shared module is bundled completely, as a remote may import any of its exports: all MUI icons
 * (4.5 MB) and all of date-fns with its locales (0.6 MB) were loaded with every start of admin, which
 * itself uses a few dozen icons. Admin imports them directly now, so only what it uses is bundled,
 * and offers the complete packages to the remotes of the adapters lazily - see `registerLazyShared`.
 * None of them holds state, so it does not matter which copy a remote gets.
 */
const LAZY_SHARED = ['@mui/icons-material', 'date-fns', 'date-fns/locale'];

const productVersion: string = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(productVersion)) {
    throw new Error('Invalid EOS frontend release version');
}

// Make all shared modules eager for the host application,
// so they are available in the shared scope for remote modules
const shared = moduleFederationShared();
for (const key of Object.keys(shared)) {
    shared[key].eager = true;
}
for (const key of LAZY_SHARED) {
    delete shared[key];
}

/** Installed version of a package, offered with it in the share scope */
function installedVersion(name: string): string {
    const pkg = name
        .split('/')
        .slice(0, name.startsWith('@') ? 2 : 1)
        .join('/');
    return JSON.parse(readFileSync(resolve(import.meta.dirname, 'node_modules', pkg, 'package.json'), 'utf8')).version;
}

/**
 * Imports every MUI icon from its own file instead of from the index of the package.
 *
 * The complete package is offered to the remotes by a dynamic import of that index. The bundler puts a
 * module into the chunk from which it is reachable through static imports, so as long as admin, the
 * gui-components or json-config import `{ Add } from '@mui/icons-material'`, the index - and with it
 * all of its 2000 icons - lands in the chunk loaded at the start. With `import Add from
 * '@mui/icons-material/Add'` only the dynamic import reaches the index.
 *
 * The line count is kept, so the source maps stay right.
 */
function iconsFromOwnFiles(): Plugin {
    const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*(['"])@mui\/icons-material\2;?/g;
    return {
        name: 'iobroker-icons-from-own-files',
        // after TypeScript is removed, so no type imports are left
        enforce: 'post',
        transform(code: string, id: string) {
            if (!code.includes('@mui/icons-material') || id.includes('/node_modules/@mui/icons-material/')) {
                return null;
            }
            let changed = false;
            const result = code.replace(NAMED_IMPORT, (statement: string, specifiers: string) => {
                changed = true;
                const imports = specifiers
                    .split(',')
                    .map(specifier => specifier.trim())
                    .filter(Boolean)
                    .map(specifier => {
                        const [name, local] = specifier.split(/\s+as\s+/);
                        return `import ${local || name} from '@mui/icons-material/${name}';`;
                    });
                const lineBreaks = statement.split('\n').length - 1;
                return imports.join(' ') + '\n'.repeat(lineBreaks);
            });
            return changed ? { code: result, map: null } : null;
        },
    };
}

export default defineConfig({
    plugins: [
        eosObjectBrowserTransform(),
        eosFrontendManifest(),
        federation({
            name: 'iobroker_admin',
            shared,
            exposes: {},
            remotes: {},
            filename: `remoteEntry-eos-${productVersion}.js`,
            manifest: true,
        }),
        react(),
        commonjs(),
        iconsFromOwnFiles(),
    ],
    server: {
        host: '127.0.0.1',
        port: 3000,
        proxy: {
            '/files': 'http://127.0.0.1:8081',
            '/adapter': 'http://127.0.0.1:8081',
            '/session': 'http://127.0.0.1:8081',
            '/log': 'http://127.0.0.1:8081',
            '/lib/js/crypto-js': 'http://127.0.0.1:8081',
            '/sso': 'http://127.0.0.1:8081',
        },
    },
    base: './',
    optimizeDeps: { exclude: ['@iobroker/gui-components'] },
    resolve: {
        tsconfigPaths: true,
        alias: [
            { find: '@', replacement: resolve(import.meta.dirname, 'src') },
            {
                // leaflet 1.9 declares neither `module` nor `exports`, so bundlers treat it as CommonJS.
                // Module federation wraps every shared module in `export * from "<pkg>"`, and that cannot
                // enumerate the named exports of a CommonJS module. react-leaflet is pure ESM and does
                // `import { Circle } from 'leaflet'`, which then fails with "does not provide an export
                // named 'Circle'" - fatal in dev, and the source of the "Unable to interop" build warning.
                // Leaflet ships an ESM build that exports them properly, so resolve the bare specifier to it.
                find: /^leaflet$/,
                replacement: resolve(import.meta.dirname, 'node_modules/leaflet/dist/leaflet-src.esm.js'),
            },
        ],
    },
    build: {
        target: 'chrome89',
        outDir: './build',
        manifest: true,
    },
    define: {
        __LAZY_SHARED_VERSIONS__: JSON.stringify(
            Object.fromEntries(LAZY_SHARED.map(name => [name, installedVersion(name)])),
        ),
    },
});
