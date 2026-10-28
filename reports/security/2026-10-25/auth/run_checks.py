import subprocess, pathlib, datetime, json, hashlib
root=pathlib.Path(__file__).resolve().parent.parent/'admin'
out=pathlib.Path(__file__).resolve().parent
commands=[['node','--test','--test-reporter=tap','test/eos-session-security.test.cjs'],['node','tools/nexowatt-security-boundaries-selftest.cjs'],['node',str(out/'targeted.cjs')]]
results=[]
for i,cmd in enumerate(commands):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 p=subprocess.run(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=45)
 log=f'{i+1:02d}-{pathlib.Path(cmd[-1]).name}.log';(out/log).write_bytes(p.stdout)
 results.append({'command':cmd,'cwd':str(root),'startedUtc':start,'finishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode,'log':log,'sha256':hashlib.sha256(p.stdout).hexdigest()})
 print(log,p.returncode,p.stdout.decode(errors='replace')[-600:])
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
