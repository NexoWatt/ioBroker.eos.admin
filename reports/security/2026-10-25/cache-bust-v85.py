from pathlib import Path
import hashlib,json,re,datetime
root=Path('/workspace/scratch/c16def314bc5/audit-20261025/admin')
web=root/'adminWww'
evidence=root.parent/'cache-bust-v85-provenance.json'
hash_text=lambda data:hashlib.sha256(data).hexdigest()
rename_files=sorted(web.rglob('*-v84.js'))
assert len(rename_files)==21, f'Expected reviewed 21 v84 modules, got {len(rename_files)}'
mapping={p.name:p.name.replace('-v84.js','-v85.js') for p in rename_files}
assert len(mapping)==21
for p in rename_files: assert not p.with_name(mapping[p.name]).exists(),str(p)
changes=[]
for p in sorted(web.rglob('*')):
    if not p.is_file() or p.suffix not in ('.js','.json','.html'): continue
    before=p.read_bytes()
    text=before.decode()
    after=text
    refs=0
    for old,new in mapping.items():
        refs += after.count(old)
        after=after.replace(old+'?v=84',new+'?v=85').replace(old,new)
    target=p.with_name(mapping[p.name]) if p in rename_files else p
    encoded=after.encode()
    if target!=p or encoded!=before:
        target.write_bytes(encoded)
        if target!=p: p.unlink()
        changes.append({'pathBefore':str(p.relative_to(root)),'pathAfter':str(target.relative_to(root)),
                        'sha256Before':hash_text(before),'sha256After':hash_text(encoded),'references':refs})
info_file=root/'NEXOWATT_EOS_BUILD_INFO.json'
before=info_file.read_bytes()
info=json.loads(before)
assert info['runtimeEntry']=='v84'
info['runtimeEntry']='v85'
info['baseFrontend']='inherited v84 runtime with scoped security patch and cache-busted v85 module graph; no complete frontend rebuild'
after=(json.dumps(info,indent=2,ensure_ascii=False)+'\n').encode()
info_file.write_bytes(after)
changes.append({'pathBefore':str(info_file.relative_to(root)),'pathAfter':str(info_file.relative_to(root)),
                'sha256Before':hash_text(before),'sha256After':hash_text(after),'fields':['runtimeEntry','baseFrontend']})
# Active retained regression suites read the canonical runtime, so later cache bumps preserve coverage.
for name in ['nexowatt-stable-v7103-selftest.cjs','nexowatt-role-security-selftest.cjs','nexowatt-ui-overview-runtime-selftest.cjs']:
    p=root/'tools'/name
    before=p.read_bytes()
    text=before.decode()
    runtime='runtimeEntry' if name=='nexowatt-role-security-selftest.cjs' else 'info.runtimeEntry'
    if name=='nexowatt-role-security-selftest.cjs':
        marker="const json = relative => JSON.parse(read(relative));"
        assert marker in text
        text=text.replace(marker,marker+"\nconst runtimeEntry = json('NEXOWATT_EOS_BUILD_INFO.json').runtimeEntry;")
    text=re.sub(r"'adminWww/assets/([^']+)-v84\.js'",lambda m:"\x60adminWww/assets/"+m[1]+"-${"+runtime+"}.js\x60",text)
    after=text.encode()
    assert after!=before
    p.write_bytes(after)
    changes.append({'pathBefore':str(p.relative_to(root)),'pathAfter':str(p.relative_to(root)),
                    'sha256Before':hash_text(before),'sha256After':hash_text(after),'reason':'active regression follows runtimeEntry'})
p=root/'tools/nexowatt-clean-legacy-runtime.cjs'
before=p.read_bytes()
text=before.decode().replace('while the compiled React runtime can intentionally remain on v84. Keep',
                            'while the compiled React runtime has its own cache version. Keep')
after=text.encode()
assert before!=after
p.write_bytes(after)
changes.append({'pathBefore':str(p.relative_to(root)),'pathAfter':str(p.relative_to(root)),
                'sha256Before':hash_text(before),'sha256After':hash_text(after),'reason':'remove stale runtime-specific comment'})
data={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'scoped frontend runtime cache bust',
      'runtimeBefore':'v84','runtimeAfter':'v85','renamedModules':len(rename_files),
      'baselineNote':'v84 source tree already includes the news evaluator patch; separate news-frontend-patch.json records that change',
      'constraints':['No full frontend build claimed','No web.ts edits','No package version edits','No manifest reseal'],
      'changes':changes}
evidence.write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({'renamedModules':len(rename_files),'changedFiles':len(changes),'evidence':str(evidence)}))

