import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import less from 'less';

const root = dirname(fileURLToPath(import.meta.url));
const frontend = join(root, 'src-admin');
const output = join(frontend, 'build');
const destination = join(root, 'adminWww');

/** Build-time tools operate offline on the exact packages installed by npm ci. */
function runNode(script: string, args: string[] = [], cwd = root): void {
    execFileSync(process.execPath, [script, ...args], {
        cwd,
        stdio: 'inherit',
        timeout: 15 * 60_000,
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=7000' },
    });
}

function requireDependencies(): void {
    for (const path of [
        'src-admin/node_modules/vite/bin/vite.js',
        'src-admin/node_modules/typescript/bin/tsc',
        'node_modules/@iobroker/ws/build/esm/socket.io.min.js',
        'node_modules/@iobroker/admin-component-easy-access/admin',
    ]) {
        if (!existsSync(join(root, path))) {
            throw new Error(`Missing locked build dependency ${path}. Run npm ci in the root and src-admin first.`);
        }
    }
}

function copy(source: string, target: string): void {
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, dereference: false });
}

function prepareRuntimeAssets(): void {
    requireDependencies();
    for (const suffix of ['', '.map']) {
        copy(
            join(root, `node_modules/@iobroker/ws/build/esm/socket.io.min.js${suffix}`),
            join(frontend, `public/lib/js/socket.io.js${suffix}`),
        );
    }
    for (const file of ['worker-json.js', 'ext-searchbox.js']) {
        copy(
            join(frontend, 'node_modules/ace-builds/src-min-noconflict', file),
            join(frontend, 'public/lib/js/ace', file),
        );
    }
}

async function renderLess(file: string): Promise<string> {
    const filename = join(frontend, 'less', file);
    return (
        await less.render(readFileSync(filename, 'utf8'), {
            filename,
            compress: true,
            paths: [join(frontend, 'less')],
        })
    ).css;
}

async function configCSS(): Promise<void> {
    const css = await Promise.all(['selectID.less', 'adapter.less', 'materializeCorrect.less'].map(renderLess));
    writeFileSync(join(frontend, 'public/css/adapter.css'), css.join(''));
}

async function iobCSS(): Promise<void> {
    writeFileSync(join(frontend, 'public/lib/css/iob/selectID.css'), await renderLess('selectID.less'));
}

async function treeTableCSS(): Promise<void> {
    writeFileSync(
        join(frontend, 'public/lib/css/jquery.treetable.theme.css'),
        await renderLess('jquery.treetable.theme.less'),
    );
}

function build(): void {
    prepareRuntimeAssets();
    runNode(join(frontend, 'node_modules/typescript/bin/tsc'), ['--project', 'tsconfig.json', '--noEmit'], frontend);
    // Only the staging output is cleared here. Keep the shipped runtime until
    // the new build is complete; obsolete hashed chunks must not be recopied.
    rmSync(output, { recursive: true, force: true });
    runNode(join(frontend, 'node_modules/vite/bin/vite.js'), ['build'], frontend);
    if (!existsSync(join(output, 'NEXOWATT_EOS_FRONTEND_MANIFEST.json'))) {
        throw new Error('Frontend build did not produce its source-bound EOS artifact manifest');
    }
}

/** Replace runtime output only after a complete build. Never delete or synchronize backend sources. */
function copyAllFiles(): void {
    if (!existsSync(join(output, 'NEXOWATT_EOS_FRONTEND_MANIFEST.json'))) {
        throw new Error('No complete EOS frontend build available to copy');
    }
    const preserved = new Map<string, Buffer>();
    for (const name of ['404.html', 'oauthError.html', 'oauthSuccess.html']) {
        if (existsSync(join(destination, name))) preserved.set(name, readFileSync(join(destination, name)));
    }
    rmSync(destination, { recursive: true, force: true });
    copy(output, destination);
    for (const [name, bytes] of preserved) {
        if (!existsSync(join(destination, name))) writeFileSync(join(destination, name), bytes);
    }
    // The custom bundle is owned by this locked package; merging leaves obsolete executable chunks behind.
    rmSync(join(root, 'admin/custom'), { recursive: true, force: true });
    copy(join(root, 'node_modules/@iobroker/admin-component-easy-access/admin'), join(root, 'admin'));
    copy(join(frontend, 'node_modules/crypto-js'), join(destination, 'lib/js/crypto-js'));
    for (const file of [
        'worker-json.js',
        'worker-html.js',
        'worker-xml.js',
        'worker-yaml.js',
        'worker-javascript.js',
        'worker-css.js',
        'snippets/html.js',
        'snippets/css.js',
        'snippets/javascript.js',
    ]) {
        copy(
            join(frontend, 'node_modules/ace-builds/src-min-noconflict', file),
            join(destination, 'static/js', file.split('/').at(-1)!),
        );
    }
}

function validateBuiltFrontend(): void {
    runNode(join(root, 'tools/nexowatt-patch-built-frontend.cjs'));
}

async function main(): Promise<void> {
    const mode = process.argv.slice(2).map(arg => arg.replace(/^-+/, ''));
    if (mode.includes('backend-i18n')) {
        copy(join(root, 'src/i18n'), join(root, 'build/i18n'));
        // Preserve upstream vendor bytes instead of delivering TypeScript's rewritten JS/maps.
        rmSync(join(root, 'build/lib/vendor/webserver'), { recursive: true, force: true });
        copy(join(root, 'src/lib/vendor/webserver'), join(root, 'build/lib/vendor/webserver')); 
    } else if (mode.includes('react-0-configCSS')) {
        await configCSS();
    } else if (mode.includes('react-0-iobCSS')) {
        await iobCSS();
    } else if (mode.includes('react-0-treeTableCSS')) {
        await treeTableCSS();
    } else if (mode.includes('react-1-clean')) {
        rmSync(output, { recursive: true, force: true });
    } else if (mode.includes('react-2-npm')) {
        requireDependencies();
    } else if (mode.includes('react-3-build')) {
        build();
    } else if (mode.includes('react-5-copy')) {
        copyAllFiles();
    } else if (mode.includes('react-6-patch')) {
        validateBuiltFrontend();
    } else {
        await Promise.all([configCSS(), iobCSS(), treeTableCSS()]);
        build();
        copyAllFiles();
        validateBuiltFrontend();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
