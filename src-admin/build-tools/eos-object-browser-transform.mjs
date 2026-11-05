/**
 * Reviewed EOS overlay for the unminified GUI 10.3.14 ObjectBrowser modules.
 * Does not modify node_modules or emitted assets. Exact source hashes and one-match
 * replacements deliberately stop the build when the pinned upstream changes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = dirname(fileURLToPath(import.meta.url));
export const manifest = JSON.parse(readFileSync(resolve(directory, 'eos-object-browser-patches.json'), 'utf8'));
const helper = resolve(directory, '../src/components/Object/eosObjectBrowserWrite.ts').replaceAll('\\', '/');
const imports = {
    'renderLeaf.js': 'eosCanEditValue, eosWriteBehavior, eosOpenValue, eosValueCellProps, eosSwitchChecked',
    'ObjectBrowserClass.js': 'eosUpdateValue',
    'dialogs.js': 'eosCanEditValue, eosEditorStates',
    'contextMenu.js': 'eosCanEditValue, eosOpenValue',
};
export function transformObjectBrowser(code, name) {
    const patch = manifest.patches.find(entry => entry.file === name);
    if (!patch) throw new Error(`Unreviewed EOS ObjectBrowser module: ${name}`);
    const hash = createHash('sha256').update(code).digest('hex');
    if (hash !== patch.sha256) throw new Error(`EOS ObjectBrowser upstream drift: ${name} (${hash})`);
    for (const { before, after } of patch.replacements) {
        if (code.split(before).length !== 2) throw new Error(`Ambiguous EOS source guard in ${name}`);
        code = code.replace(before, after);
    }
    return `import { ${imports[name]} } from ${JSON.stringify(helper)};\n${code.replace(/\/\/# sourceMappingURL=.*$/m, '')}`;
}
export default function eosObjectBrowserTransform() {
    const seen = new Set();
    return {
        name: 'nexowatt-eos-object-browser-source-guards',
        enforce: 'pre',
        buildStart() {
            seen.clear();
            const installed = JSON.parse(
                readFileSync(resolve(directory, '../node_modules/@iobroker/gui-components/package.json'), 'utf8'),
            );
            if (installed.version !== manifest.version)
                throw new Error('EOS ObjectBrowser requires a reviewed GUI package version');
            // Verify all inputs even if a module is temporarily not imported by the application.
            for (const patch of manifest.patches) {
                transformObjectBrowser(
                    readFileSync(
                        resolve(
                            directory,
                            '../node_modules/@iobroker/gui-components/build/Components/ObjectBrowser',
                            patch.file,
                        ),
                        'utf8',
                    ),
                    patch.file,
                );
            }
        },
        transform(code, id) {
            const normalized = id.replaceAll('\\', '/').split('?')[0];
            const prefix = '/node_modules/@iobroker/gui-components/build/Components/ObjectBrowser/';
            const index = normalized.lastIndexOf(prefix);
            if (index === -1) return null;
            const name = normalized.slice(index + prefix.length);
            if (!manifest.patches.some(entry => entry.file === name)) return null;
            seen.add(name);
            return { code: transformObjectBrowser(code, name), map: null };
        },
        generateBundle() {
            for (const patch of manifest.patches) {
                if (!seen.has(patch.file)) throw new Error(`EOS ObjectBrowser guard was not bundled: ${patch.file}`);
            }
            this.emitFile({
                type: 'asset',
                fileName: 'eos-object-browser-guards.json',
                source: JSON.stringify(
                    {
                        version: manifest.version,
                        files: [...seen].sort(),
                        marker: 'nexowatt-eos-admin8-manual-write-v1',
                    },
                    null,
                    2,
                ),
            });
        },
    };
}
