import assert from 'node:assert/strict';
import { versionPublicAssetUrls } from '../src-admin/build-tools/eos-public-assets.mjs';
const html = '<script src="./js/eos-role-bootstrap.js?v=7109&amp;security=20260930"></script>' +
    '<script src="static/js/nexowatt-stable-login.js?v=7109"></script>' +
    '<link href="css/eos-auto-update.css?v=7103">' +
    '<script src="./assets/bootstrap-ABC12345.js"></script>' +
    '<script src="https://example.invalid/external.js"></script>' +
    '<script>script.src = \'./lib/js/socket.io.js\';</script>';
const previous = versionPublicAssetUrls(html, '7.10.12');
const current = versionPublicAssetUrls(html, '8.0.0');
assert.notEqual(previous, current, 'An old year-long response must not satisfy an Admin8 public asset URL');
for (const asset of ['eos-role-bootstrap.js', 'nexowatt-stable-login.js', 'eos-auto-update.css']) {
    assert.match(current, new RegExp(`${asset.replaceAll('.', '\\.')}\\?[^"']*eos-release=8\\.0\\.0`));
}
assert.match(current, /v=7109&amp;security=20260930&amp;eos-release=8\.0\.0/);
assert.match(current, /socket\.io\.js\?eos-release=8\.0\.0/);
assert.ok(current.includes('src="./assets/bootstrap-ABC12345.js"'), 'Content-hashed build chunks retain their actual URLs');
assert.ok(current.includes('src="https://example.invalid/external.js"'), 'External URLs are not rewritten');
assert.equal(versionPublicAssetUrls(previous, '8.0.0'), current, 'Upgrade rewrites an already versioned public and socket URL');
assert.equal(versionPublicAssetUrls(current, '8.0.0'), current, 'Public attribute versioning is idempotent');
assert.throws(() => versionPublicAssetUrls(html, '8.0.0" onload="x'), /Invalid/);
console.log('PASS version-bound Admin7→Admin8 public JS/CSS/socket cache invalidation');
