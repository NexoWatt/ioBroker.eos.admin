'use strict';
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const root = path.join(__dirname, '..');
const vendor = path.join(root, 'tools', 'vendor');
const provenance = JSON.parse(fs.readFileSync(path.join(vendor, 'package-profile-provenance.json'), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function verifyValidatorProvenance() {
    const upstreamBuild = path.dirname(require.resolve('@iobroker/testing'));
    const upstreamPackage = JSON.parse(fs.readFileSync(path.join(upstreamBuild, '..', 'package.json'), 'utf8'));
    assert.equal(upstreamPackage.version, provenance.version, 'Review the validator profile before upgrading the testing package');
    assert.equal(hash(path.join(upstreamBuild, 'tests', 'packageFiles', 'index.js')), provenance.originalSha256);
    assert.equal(hash(path.join(vendor, provenance.reviewedFile)), provenance.reviewedSha256);
    assert.equal(hash(path.join(root, provenance.profileFile)), provenance.profileSha256);
}

// Verify before executing the locally adapted validator, not only after loading it.
verifyValidatorProvenance();
const { validatePackageFiles } = require('../tools/vendor/iobroker-testing-package-files.cjs');
const { createEosIoPackageSchema, JSON_CONFIG_SCHEMA_ID, LOCAL_LICENSE_LINK } = require('../tools/nexowatt-package-schema-profile.cjs');
const { Ajv } = require('ajv');

describe('Reviewed EOS package-validation profile', () => {
    it('uses the reviewed upstream validator version and exact source', verifyValidatorProvenance);
    it('pins both official schemas by immutable commit and SHA-256', () => {
        const schemas = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'sources.json'), 'utf8')).schemas;
        assert.equal(schemas.length, 2);
        const officialPaths = {
            'https://raw.githubusercontent.com/ioBroker/ioBroker.js-controller/master/schemas/io-package.json': ['ioBroker/ioBroker.js-controller', 'schemas/io-package.json'],
            'https://raw.githubusercontent.com/ioBroker/json-config/main/schemas/jsonConfig.json': ['ioBroker/json-config', 'schemas/jsonConfig.json'],
        };
        assert.equal(new Set(schemas.map(schema => schema.requestUrl)).size, 2);
        for (const schema of schemas) {
            assert.match(schema.commit, /^[a-f0-9]{40}$/);
            assert.match(schema.sha256, /^[a-f0-9]{64}$/);
            const official = officialPaths[schema.requestUrl];
            assert.ok(official, 'Schema must come from the exact official repository and path');
            assert.equal(schema.sourceUrl, `https://raw.githubusercontent.com/${official[0]}/${schema.commit}/${official[1]}`);
            assert.equal(hash(path.join(__dirname, 'schemas', schema.file)), schema.sha256);
        }
        const licenses = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'license-sources.json'), 'utf8')).licenses;
        assert.equal(licenses.length, 2);
        for (const license of licenses) {
            const schema = schemas.find(entry => entry.commit === license.commit);
            assert.ok(schema, 'Schema license must come from the same pinned commit');
            assert.equal(license.repository, officialPaths[schema.requestUrl][0]);
            assert.equal(license.sourceUrl, `https://raw.githubusercontent.com/${license.repository}/${license.commit}/LICENSE`);
            assert.equal(hash(path.join(__dirname, 'schemas', license.file)), license.sha256);
        }
    });
    it('keeps the official schema immutable and validates the actual complete EOS metadata', () => {
        const official = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'io-package.json'), 'utf8'));
        const original = JSON.stringify(official);
        const product = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));
        const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
        const schema = createEosIoPackageSchema(official, version);
        assert.equal(JSON.stringify(official), original);
        assert.equal(schema.additionalProperties, false);
        assert.equal(schema.properties.common.additionalProperties, false);
        const ajv = new Ajv({ allErrors: true, strict: false });
        ajv.addSchema(JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'jsonConfig.json'), 'utf8')), JSON_CONFIG_SCHEMA_ID);
        const validate = ajv.compile(schema);
        assert.equal(validate(product), true, JSON.stringify(validate.errors));
        const invalid = [
            ['unknown root field', copy => { copy.unreviewedField = true; }],
            ['unknown common field', copy => { copy.common.unreviewedField = true; }],
            ['adapter identity', copy => { copy.common.name = 'admin'; }],
            ['adapter version', copy => { copy.common.version = '7.0.0'; }],
            ['root version', copy => { copy.version = '7.0.0'; }],
            ['nonfinite version', copy => { copy.version = '999999999999999999999.0.0'; }],
            ['package identity', copy => { copy.common.npmPackage = 'iobroker.admin'; }],
            ['packet identity', copy => { copy.common.packetName = 'iobroker.admin'; }],
            ['publisher', copy => { copy.common.publisher = 'Other'; }],
            ['metadata URL', copy => { copy.common.meta = 'https://example.test/io-package.json'; }],
            ['deletion policy', copy => { copy.common.allowAdapterDelete = true; }],
            ['update policy', copy => { copy.common.allowAdapterUpdate = false; }],
            ['retention policy', copy => { copy.common.dontDelete = true; }],
            ['missing vendor identity', copy => { delete copy.common.packetName; }],
            ['missing version', copy => { delete copy.version; }],
            ['license identity', copy => { copy.common.licenseInformation.license = 'MIT'; }],
            ['license class', copy => { copy.common.licenseInformation.type = 'free'; }],
            ['foreign local license', copy => { copy.common.licenseInformation.link = '/adapter/admin/LICENSE'; }],
            ['script license URL', copy => { copy.common.licenseInformation.link = 'javascript:alert(1)'; }],
            ['license metadata extension', copy => { copy.common.licenseInformation.secret = true; }],
            ['unknown embedded schema', copy => { copy.schemas.custom = {}; }],
            ['embedded schema path', copy => { copy.schemas.systemConfig.path = 'native'; }],
            ['embedded schema extra field', copy => { copy.schemas.systemConfig.extra = true; }],
            ['embedded config typo', copy => { copy.schemas.systemConfig.json.items.country['max-length'] = 2; }],
            ['embedded language shape', copy => { copy.schemas.systemConfig.json.items.language.system = 'false'; }],
        ];
        for (const [reason, mutate] of invalid) {
            const copy = structuredClone(product);
            mutate(copy);
            assert.equal(validate(copy), false, `Profile must reject ${reason}`);
        }
        for (const invalidVersion of ['', '8', 'v8.0.0', '8.0.0\n', 'Infinity.0.0', '999999999999999999999.0.0', null]) {
            assert.throws(() => createEosIoPackageSchema(official, invalidVersion), /finite canonical semver/);
        }
        assert.throws(() => createEosIoPackageSchema({ ...official, additionalProperties: true }, version), /schema boundary/);
    });
    it('ships the concrete proprietary license link as actual nonempty files', () => {
        const product = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));
        assert.equal(product.common.licenseInformation.link, LOCAL_LICENSE_LINK);
        for (const file of ['NEXOWATT_PROPRIETARY_LICENSE.md', 'admin/LICENSE-NEXOWATT.md', 'adminWww/LICENSE-NEXOWATT.md']) {
            const absolute = path.join(root, file);
            assert.ok(fs.statSync(absolute).isFile());
            assert.match(fs.readFileSync(absolute, 'utf8'), /NexoWatt/);
            assert.ok(fs.statSync(absolute).size > 100);
        }
    });
});

// All package, identity, licensing, config and schema checks execute on the actual
// product files. See docs/security/admin8-2026-11-04/PACKAGE_TEST_PROFILE.md.
validatePackageFiles(root);
