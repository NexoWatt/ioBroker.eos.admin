#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = String(pkg.version || '');
const isPrerelease = version.includes('-');
const configuredTag = String(pkg.publishConfig?.tag || '');
const explicitAllow = process.env.NEXOWATT_EOS_ALLOW_PRERELEASE_PUBLISH === '1';

if (isPrerelease) {
    if (configuredTag !== 'rc') {
        console.error(`[NexoWatt EOS publish guard] Prerelease ${version} must use publishConfig.tag=rc, got ${configuredTag || '<unset>'}`);
        process.exit(1);
    }
    if (!explicitAllow) {
        console.error(`[NexoWatt EOS publish guard] ${version} is a test release. npm publishing is blocked so npm latest remains on the accepted stable version.`);
        console.error('[NexoWatt EOS publish guard] Use the generated source ZIP/TGZ for laboratory and field acceptance.');
        process.exit(1);
    }
    if (String(process.env.npm_config_tag || configuredTag) === 'latest') {
        console.error('[NexoWatt EOS publish guard] A prerelease must never be published with the latest tag.');
        process.exit(1);
    }
}

if (!isPrerelease && configuredTag && configuredTag !== 'latest') {
    console.error(`[NexoWatt EOS publish guard] Stable version ${version} must not retain prerelease tag ${configuredTag}.`);
    process.exit(1);
}

console.log(`[NexoWatt EOS publish guard] OK (${version}${isPrerelease ? ', prerelease publishing explicitly authorized' : ', stable channel'})`);
