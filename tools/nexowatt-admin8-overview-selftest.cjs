'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function functionSource(file, start, end, name) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const begin = source.indexOf(start);
    const finish = source.indexOf(end, begin);
    assert.ok(begin >= 0 && finish > begin, `Reviewed ${name} function anchors must exist`);
    return source.slice(begin, finish) + `\n${name};`;
}
const heroSource = functionSource('src-admin/public/js/nexowatt-native-shell.js', '    const ensureModernOverview = () => {', '    const classifyTechnicalRows =', 'ensureModernOverview');
let native = false;
let removed = 0;
const nodes = [];
const paper = { firstChild: null, insertBefore(node) { nodes.push(node); } };
const document = {
    querySelector(selector) { return native && selector === '[data-eos-native-react-overview="true"]' ? {} : null; },
    querySelectorAll(selector) { return selector === '[data-eos-runtime-overview-hero="true"]' ? nodes.filter(node => node.dataset.eosRuntimeOverviewHero === 'true') : []; },
    getElementById(id) { return id === 'app-paper' ? paper : nodes.find(node => node.id === id) || null; },
    createElement() { return { dataset: {}, remove() { removed++; nodes.splice(nodes.indexOf(this), 1); } }; },
};
const ensureHero = vm.runInNewContext(heroSource, { document, window: { NEXOWATT_EOS_ACCESS_ROLE: 'admin' }, currentTab: () => 'tab-intro', isLogin: () => false });
ensureHero();
assert.equal(nodes.length, 1, 'Compatibility hero can render before the native chunk arrives');
assert.equal(nodes[0].dataset.eosRuntimeOverviewHero, 'true');
native = true;
ensureHero();
assert.equal(removed, 1, 'Native React mount removes the compatibility hero');
assert.equal(nodes.length, 0, 'No duplicated overview header remains');
ensureHero();
assert.equal(removed, 1, 'Handoff is idempotent and never removes the React-owned hero');
const loadSource = functionSource('src-admin/public/js/eos-ems-overview.js', '    const load = async () => {', '    const apply =', 'load');
let socketLookups = 0;
let legacyRemoved = 0;
const load = vm.runInNewContext(loadSource, {
    destroyed: false, inFlight: false, CONTRACT: 'nexowatt-ems-overview-v1', ROOT_ID: 'eos-ems-overview-runtime',
    currentTab: () => 'tab-intro',
    document: { visibilityState: 'visible', querySelector: () => ({}), getElementById: () => ({ remove() { legacyRemoved++; } }) },
    getSocket() { socketLookups++; throw new Error('Native React must own EMS reads'); },
});
load().then(() => {
    assert.equal(socketLookups, 0, 'Compatibility poller performs no reads when the native React card is present');
    assert.equal(legacyRemoved, 1);
    console.log('PASS Admin8 overview handoff: no duplicate hero, no duplicate EMS reads');
}).catch(error => { console.error(error); process.exitCode = 1; });
