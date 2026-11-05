'use strict';

// Development-only, explicit EOS additions to the unchanged pinned official schema.
// No wildcard metadata relaxation is permitted. See PACKAGE_TEST_PROFILE.md.
const semver = require('semver');
const JSON_CONFIG_SCHEMA_ID = 'eos-pinned-json-config';
const LOCAL_LICENSE_LINK = '/adapter/eos-admin/LICENSE-NEXOWATT.md';

function createEosIoPackageSchema(officialSchema, version) {
    if (typeof version !== 'string' || version.length > 128 || semver.valid(version) !== version
        || !version.split(/[.+-]/).slice(0, 3).every(part => Number.isSafeInteger(Number(part)))) {
        throw new Error('EOS package version must be finite canonical semver');
    }
    const schema = structuredClone(officialSchema);
    if (schema.additionalProperties !== false || schema.properties?.common?.additionalProperties !== false) {
        throw new Error('Unexpected official schema boundary; review the EOS profile');
    }
    const commonSchema = schema.properties.common;
    const common = commonSchema.properties;
    schema.required = [...new Set([...(schema.required || []), 'version', 'schemas'])];
    commonSchema.required = [...new Set([...(commonSchema.required || []), 'name', 'version', 'dontDelete',
        'allowAdapterUpdate', 'allowAdapterDelete', 'meta', 'npmPackage', 'packetName', 'publisher', 'licenseInformation'])];
    common.name = { const: 'eos-admin' };
    common.version = { const: version };
    schema.properties.version = { const: version };
    schema.properties.schemas = {
        type: 'object', additionalProperties: false, required: ['systemConfig'],
        properties: {
            systemConfig: {
                type: 'object', additionalProperties: false, required: ['label', 'path', 'json'],
                properties: {
                    label: { type: 'string', minLength: 1, maxLength: 512 },
                    path: { const: 'common' },
                    json: { $ref: JSON_CONFIG_SCHEMA_ID },
                },
            },
        },
    };
    common.dontDelete = { const: false };
    common.allowAdapterUpdate = { const: true };
    common.allowAdapterDelete = { const: false };
    common.meta = { const: `https://unpkg.com/iobroker.eos-admin@${version}/io-package.json` };
    common.npmPackage = { const: 'iobroker.eos-admin' };
    common.packetName = { const: 'iobroker.eos-admin' };
    common.publisher = { const: 'NexoWatt' };
    common.licenseInformation.required = ['license', 'type', 'link'];
    common.licenseInformation.properties.type = { const: 'paid' };
    common.licenseInformation.properties.license = { const: 'UNLICENSED' };
    common.licenseInformation.properties.link = {
        type: 'string', maxLength: 2048,
        anyOf: [{ pattern: '^https://.+$' }, { const: LOCAL_LICENSE_LINK }],
    };
    return schema;
}

module.exports = { createEosIoPackageSchema, JSON_CONFIG_SCHEMA_ID, LOCAL_LICENSE_LINK };
