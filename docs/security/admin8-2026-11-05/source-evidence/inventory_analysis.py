from pathlib import Path
import json, hashlib, datetime, base64, uuid
from urllib.parse import quote

root = Path(__file__).resolve().parent
source = root / 'upstream-v3.0.8'
raw = json.loads((root / 'observed-bundle-modules.json').read_text())
lock = json.loads((source / 'package-lock.json').read_text())['packages']
audit = json.loads((root / 'upstream-source-lock-audit.json').read_text())
packages, generated, own, unknown, chunks = {}, [], [], [], []
for chunk in raw['chunks']:
    normalized = []
    for module in chunk['modules']:
        identifier = module['id'].replace('[upstream]', str(source))
        normalized.append({**module, 'id': identifier.replace(str(source), '[upstream]')})
        path_text = identifier.lstrip('\x00').split('?', 1)[0]
        if identifier.startswith('\x00') or not path_text.startswith(str(source) + '/'):
            generated.append(identifier.replace(str(source), '[upstream]'))
            continue
        module_path = Path(path_text)
        if '/node_modules/' not in path_text:
            own.append(str(module_path.relative_to(source)))
            continue
        owner = module_path if module_path.is_dir() else module_path.parent
        # ESM distribution directories can have package.json containing only type=module.
        # Ascend to the actual package root recorded in the immutable upstream lock.
        while owner != source:
            relative = owner.relative_to(source).as_posix()
            if relative in lock and (owner / 'package.json').is_file():
                break
            owner = owner.parent
        if owner == source:
            unknown.append(identifier.replace(str(source), '[upstream]'))
            continue
        relative = owner.relative_to(source).as_posix()
        manifest_bytes = (owner / 'package.json').read_bytes()
        metadata = json.loads(manifest_bytes)
        assert metadata['version'] == lock[relative]['version'], relative
        record = packages.setdefault(relative, {
            'name': metadata['name'], 'version': metadata['version'],
            'packageLocation': relative, 'resolved': lock[relative].get('resolved'),
            'integrity': lock[relative].get('integrity'), 'license': metadata.get('license'),
            'packageManifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
            'modules': [], 'chunks': set(), 'renderedLength': 0,
        })
        record['modules'].append(str(module_path.relative_to(owner)))
        record['chunks'].add(chunk['fileName'])
        record['renderedLength'] += module.get('renderedLength') or 0
    chunks.append({**chunk, 'modules': normalized})
for record in packages.values():
    record['chunks'] = sorted(record['chunks'])
    record['modules'] = sorted(set(record['modules']))
items = sorted(packages.values(), key=lambda p: (p['name'], p['version'], p['packageLocation']))
actual_names = {p['name'] for p in items}
triage = []
for name, finding in sorted(audit.get('vulnerabilities', {}).items()):
    included = name in actual_names
    triage.append({
        'name': name, 'severity': finding['severity'],
        'auditedInstalledLocations': finding.get('nodes', []),
        'presentInObservedBundleModules': included,
        'assessment': 'Included: assess affected code' if included else 'No module contribution in the byte-identical reconstructed shipped browser artifact. Original upstream build dependency finding; not an identified EasyAccess runtime dependency finding.',
        'advisories': [{k: value.get(k) for k in ['title', 'url', 'range', 'severity']} for value in finding.get('via', []) if isinstance(value, dict)],
        'viaPackages': [value for value in finding.get('via', []) if isinstance(value, str)],
    })
proof = {
    'schemaVersion': 1, 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'subject': {'name': '@iobroker/admin-component-easy-access', 'version': '3.0.8', 'sourceCommit': 'ae303bdabc73c2588b1194d2f0c4951ac0d8b00e'},
    'basis': 'Exact official source and lock; observer does not mutate chunks. All 26 delivery files rebuilt byte-identically; observed generated output still matches the registry package and EOS delivery. Includes every emitted chunk, conservatively including zero-length module contributions.',
    'packageCount': len(items), 'moduleAssignments': sum(len(c['modules']) for c in chunks),
    'unattributedPhysicalModules': unknown, 'ownModules': sorted(set(own)),
    'generatedModules': sorted(set(generated)), 'packages': items, 'chunks': chunks,
    'auditTriage': triage,
    'limits': [
        'This review is not a guarantee of absence of undisclosed vulnerabilities.',
        'Build-generated federation wrappers and Vite preload helpers are bound by exact output hashes; their source tooling is recorded separately from library module contribution.',
        'Build dependency findings are assessed for this shipped browser artifact, not certified safe for arbitrary development-server or untrusted-build use.',
        'The upstream workflow uses npm i and mutable action tags; byte reproduction proves the observed artifact, not a generally immutable release process.',
        'Host-selected federation singleton versions and a real controller environment remain an integration boundary.',
    ],
}
assert not unknown, unknown
assert not any(row['presentInObservedBundleModules'] for row in triage)
(root / 'easy-access-bundle-inventory.json').write_text(json.dumps(proof, indent=2) + '\n')
(root / 'observed-bundle-modules.json').write_text(json.dumps({**raw, 'chunks': chunks}, indent=2) + '\n')
components = []
for item in items:
    purl = 'pkg:npm/' + quote(item['name'], safe='/') + '@' + item['version']
    component = {'type': 'library', 'name': item['name'], 'version': item['version'], 'bom-ref': purl, 'purl': purl,
        'properties': [{'name': 'eos:package-location', 'value': item['packageLocation']},
                       {'name': 'eos:package-manifest-sha256', 'value': item['packageManifestSha256']},
                       {'name': 'eos:observed-module-count', 'value': str(len(item['modules']))}],
        'externalReferences': [{'type': 'distribution', 'url': item['resolved']}]}
    if item.get('integrity', '').startswith('sha512-'):
        component['hashes'] = [{'alg': 'SHA-512', 'content': base64.b64decode(item['integrity'][7:]).hex()}]
    if isinstance(item.get('license'), str):
        component['licenses'] = [{'expression': item['license']}]
    components.append(component)
subject_purl = 'pkg:npm/%40iobroker/admin-component-easy-access@3.0.8'
bom = {'bomFormat': 'CycloneDX', 'specVersion': '1.6', 'version': 1,
       'serialNumber': 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, subject_purl + ':ae303bdabc73c2588b1194d2f0c4951ac0d8b00e')),
       'metadata': {'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'component': {'type': 'library', 'name': '@iobroker/admin-component-easy-access', 'version': '3.0.8', 'bom-ref': subject_purl, 'purl': subject_purl},
                    'properties': [{'name': 'eos:scope', 'value': 'Observed prebuilt browser artifact composition, all emitted chunks. Flat component inventory; no complete transitive dependency relationship graph is claimed.'}, {'name': 'eos:source-commit', 'value': 'ae303bdabc73c2588b1194d2f0c4951ac0d8b00e'}]},
       'components': components}
(root / 'easy-access-bom.cdx.json').write_text(json.dumps(bom, indent=2) + '\n')
print(json.dumps({'packageCount': len(items), 'moduleAssignments': proof['moduleAssignments'], 'generatedModules': len(proof['generatedModules']), 'unattributedPhysicalModules': len(unknown), 'auditFindings': len(triage), 'auditPackagesInBundle': [], 'packages': [p['name'] + '@' + p['version'] for p in items]}, indent=2))
