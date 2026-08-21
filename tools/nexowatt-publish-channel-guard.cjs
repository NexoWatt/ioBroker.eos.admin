#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function validatePublishChannel(pkg, env = process.env) {
    const version = String(pkg?.version || '').trim();
    const configuredTag = String(pkg?.publishConfig?.tag || '').trim();
    const isPrerelease = version.includes('-');
    const requestedTag = String(env.npm_config_tag || env.NPM_CONFIG_TAG || configuredTag || 'latest').trim();

    if (!version) {
        return { ok: false, message: 'package.json version is missing' };
    }

    if (isPrerelease) {
        if (configuredTag !== 'rc') {
            return {
                ok: false,
                message: `Prerelease ${version} must use publishConfig.tag=rc, got ${configuredTag || '<unset>'}`,
            };
        }
        if (requestedTag === 'latest') {
            return {
                ok: false,
                message: `Prerelease ${version} must never be published with the latest tag. Use npm publish or npm publish --tag rc.`,
            };
        }
        if (requestedTag !== 'rc') {
            return {
                ok: false,
                message: `Prerelease ${version} may only be published with the rc tag, got ${requestedTag || '<unset>'}`,
            };
        }
        return { ok: true, version, tag: 'rc', prerelease: true };
    }

    if (configuredTag && configuredTag !== 'latest') {
        return {
            ok: false,
            message: `Stable version ${version} must not retain prerelease tag ${configuredTag}`,
        };
    }
    if (requestedTag !== 'latest') {
        return {
            ok: false,
            message: `Stable version ${version} must be published with the latest tag, got ${requestedTag || '<unset>'}`,
        };
    }

    return { ok: true, version, tag: 'latest', prerelease: false };
}

if (require.main === module) {
    const root = path.resolve(__dirname, '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const result = validatePublishChannel(pkg, process.env);

    if (!result.ok) {
        console.error(`[NexoWatt EOS publish guard] ${result.message}`);
        process.exit(1);
    }

    console.log(
        `[NexoWatt EOS publish guard] OK (${result.version}, npm dist-tag ${result.tag}${result.prerelease ? '; npm latest remains unchanged' : ''})`,
    );
}

module.exports = { validatePublishChannel };
