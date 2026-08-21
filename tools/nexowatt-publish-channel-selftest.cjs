#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { validatePublishChannel } = require('./nexowatt-publish-channel-guard.cjs');

const prerelease = {
    version: '7.9.87-rc.3',
    publishConfig: { tag: 'rc' },
};
const stable = {
    version: '7.9.87',
    publishConfig: { tag: 'latest' },
};

assert.equal(validatePublishChannel(prerelease, {}).ok, true, 'plain npm publish must use publishConfig.tag=rc');
assert.equal(validatePublishChannel(prerelease, { npm_config_tag: 'rc' }).ok, true, '--tag rc must be accepted');
assert.equal(validatePublishChannel(prerelease, { npm_config_tag: 'latest' }).ok, false, '--tag latest must be blocked');
assert.equal(validatePublishChannel(prerelease, { npm_config_tag: 'next' }).ok, false, 'unexpected prerelease tag must be blocked');
assert.equal(validatePublishChannel(stable, {}).ok, true, 'stable publish must use latest');
assert.equal(validatePublishChannel(stable, { npm_config_tag: 'rc' }).ok, false, 'stable release must not use rc');
assert.equal(
    validatePublishChannel({ version: '7.9.87-rc.3', publishConfig: { tag: 'latest' } }, {}).ok,
    false,
    'prerelease package metadata must never point to latest',
);

console.log('[NexoWatt EOS publish channel selftest] OK');
