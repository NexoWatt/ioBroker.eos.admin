#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { validatePublishChannel } = require('./nexowatt-publish-channel-guard.cjs');

const acceptedPrerelease = {
    version: '7.9.87-rc.4',
    publishConfig: { tag: 'latest' },
    nexowattReleasePolicy: { distTag: 'latest', acceptedPrerelease: '7.9.87-rc.4' },
};
const stable = {
    version: '7.9.87',
    publishConfig: { tag: 'latest' },
    nexowattReleasePolicy: { distTag: 'latest' },
};

assert.equal(validatePublishChannel(acceptedPrerelease, {}).ok, true, 'explicitly accepted RC4 must publish to latest');
assert.equal(validatePublishChannel(acceptedPrerelease, { npm_config_tag: 'latest' }).ok, true, '--tag latest must be accepted');
assert.equal(validatePublishChannel(acceptedPrerelease, { npm_config_tag: 'rc' }).ok, false, 'RC4 must not be published to a second channel');
assert.equal(validatePublishChannel({ ...acceptedPrerelease, nexowattReleasePolicy: {} }, {}).ok, false, 'unapproved prerelease must not move latest');
assert.equal(validatePublishChannel({ ...acceptedPrerelease, nexowattReleasePolicy: { distTag: 'latest', acceptedPrerelease: '7.9.87-rc.3' } }, {}).ok, false, 'acceptance must match the exact version');
assert.equal(validatePublishChannel(stable, {}).ok, true, 'stable publish must use latest');
assert.equal(validatePublishChannel({ ...stable, nexowattReleasePolicy: { distTag: 'latest', acceptedPrerelease: '7.9.87-rc.4' } }, {}).ok, false, 'stable metadata must not retain prerelease acceptance');
assert.equal(validatePublishChannel(stable, { npm_config_tag: 'rc' }).ok, false, 'stable release must not use rc');

console.log('[NexoWatt EOS publish channel selftest] OK');
