const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(process.env.EOS_ADMIN_ROOT||path.join(__dirname,'../../../..'));const output=path.resolve(process.env.EOS_REVIEW_OUTPUT||path.join(__dirname,'rerun'));fs.mkdirSync(output,{recursive:true});
const base=path.join(root,'admin/custom');
const acorn=require(path.join(root,'tools/vendor/acorn/acorn.cjs'));
function all(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?all(path.join(d,e.name)):[path.join(d,e.name)]);}
function lit(n){if(n?.type==='Literal'&&typeof n.value==='string')return n.value;if(n?.type==='TemplateLiteral'&&n.expressions.length===0)return n.quasis[0].value.cooked;return null;}
function prop(n){return n?.type==='Identifier'?n.name:n?.type==='Literal'?String(n.value):null;}
function name(n){if(n?.type==='Identifier')return n.name;if(n?.type==='MemberExpression')return name(n.object)+'.'+prop(n.property);return n?.type;}
const files=[];let errors=[];
for(const f of all(base).filter(f=>f.endsWith('.js'))){const code=fs.readFileSync(f,'utf8');let ast;try{ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});}catch(e){errors.push({file:f,error:String(e)});continue;}
const rec={file:path.relative(base,f),bytes:Buffer.byteLength(code),sha256:crypto.createHash('sha256').update(code).digest('hex'),imports:[],sinks:[],versionMarkers:[]};
const stack=[ast];while(stack.length){const n=stack.pop();if(!n||typeof n!=='object')continue;
if(n.type==='ImportDeclaration'||n.type==='ExportNamedDeclaration'||n.type==='ExportAllDeclaration'){if(n.source)rec.imports.push({kind:n.type,value:lit(n.source),offset:n.start});}
if(n.type==='ImportExpression')rec.imports.push({kind:'dynamic',value:lit(n.source),expression:code.slice(n.source.start,n.source.end).slice(0,160),offset:n.start});
let sink=null;if(n.type==='CallExpression'||n.type==='NewExpression'){const nm=name(n.callee);if(/(^|\.)(eval|Function|AsyncFunction|fetch|XMLHttpRequest|WebSocket|postMessage|sendBeacon|insertAdjacentHTML|write|createElement|setItem|setObject|setState|sendToHost|sendTo|setForeignObject|setForeignState)$/.test(nm))sink=nm;}
if(n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&['innerHTML','outerHTML','src','href'].includes(prop(n.left.property)))sink='assignment:'+name(n.left);
if(n.type==='Property'&&prop(n.key)==='dangerouslySetInnerHTML')sink='dangerouslySetInnerHTML';
if(sink)rec.sinks.push({kind:sink,offset:n.start,snippet:code.slice(Math.max(0,n.start-100),Math.min(code.length,n.end+120)).slice(0,500)});
if(n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&prop(n.left.property)==='version'&&lit(n.right))rec.versionMarkers.push({offset:n.start,value:lit(n.right),snippet:code.slice(n.start,n.end)});
for(const [k,v]of Object.entries(n)){if(k==='start'||k==='end')continue;if(Array.isArray(v)){for(const c of v)if(c&&typeof c==='object')stack.push(c);}else if(v&&typeof v==='object')stack.push(v);}
}
files.push(rec);}
const indexed=new Map(files.map(f=>[f.file,f]));const reachable=new Set(),missing=[],external=[];const queue=['customComponents.js'];while(queue.length){const file=queue.shift();if(reachable.has(file))continue;reachable.add(file);const rec=indexed.get(file);if(!rec){missing.push(file);continue;}for(const i of rec.imports){if(i.value?.startsWith('.')){const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),i.value));if(!indexed.has(target))missing.push({source:file,target});else queue.push(target);}else if(i.value)external.push({source:file,value:i.value});}}
const out={scope:'Static syntax/import graph and sensitive API inventory, not full dataflow or exploitability proof',date:new Date().toISOString(),files,syntaxErrors:errors,reachable:[...reachable].sort(),unreachable:files.filter(f=>!reachable.has(f.file)).map(f=>f.file),missing,external};
fs.writeFileSync(path.join(output,'static-review.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify({jsFiles:files.length,reachable:reachable.size,syntaxErrors:errors.length,missing,external,unreachable:out.unreachable,sinkCounts:files.map(f=>({file:f.file,count:f.sinks.length,versions:f.versionMarkers}))},null,2));
