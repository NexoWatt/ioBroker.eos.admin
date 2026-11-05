import base from './vite.config';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

// Observer only: writes outside the output folder and never mutates generated chunks.
const observer: Plugin = {
    name: 'eos-easy-access-read-only-bundle-observer',
    generateBundle: {
        order: 'post',
        handler(_options, bundle) {
            const chunks = Object.values(bundle).filter(item => item.type === 'chunk').map(item => ({
                fileName: item.fileName,
                sha256AtHook: createHash('sha256').update(item.code).digest('hex'),
                imports: item.imports,
                dynamicImports: item.dynamicImports,
                modules: Object.entries(item.modules).map(([id, details]) => ({
                    id,
                    renderedLength: details.renderedLength,
                    originalLength: details.originalLength,
                    renderedExports: details.renderedExports,
                    removedExports: details.removedExports,
                })),
            }));
            writeFileSync(resolve(import.meta.dirname, '../observed-bundle-modules.json'), JSON.stringify({
                mode: 'read-only-generateBundle-observer',
                package: '@iobroker/admin-component-easy-access',
                version: '3.0.8',
                sourceCommit: 'ae303bdabc73c2588b1194d2f0c4951ac0d8b00e',
                chunks,
            }, null, 2) + '\n');
        },
    },
};

export default { ...base, plugins: [...base.plugins, observer] };
