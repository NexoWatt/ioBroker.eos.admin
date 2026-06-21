#!/usr/bin/env node
const pkg = require('../package.json');
const io = require('../io-package.json');
const version = io.common.version || pkg.version;
const base = process.argv[2] || 'https://iobroker.live/repo/eos-admin';
const entry = {
  'eos-admin': {
    name: 'eos-admin',
    version,
    title: 'NexoWatt EOS Admin',
    titleLang: io.common.titleLang,
    desc: io.common.desc,
    meta: `${base}/io-package.json`,
    icon: /unpkg\.com\/iobroker\.eos-admin@/i.test(base) ? `${base}/admin/admin.png` : `${base}/admin.png`
  }
};
console.log(JSON.stringify(entry, null, 2));
