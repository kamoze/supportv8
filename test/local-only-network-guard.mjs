// Preloaded into Vitest and inherited Node children. Never print headers/bodies.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
import childProcess from 'node:child_process';
import {fileURLToPath} from 'node:url';
const loopback=host=>['127.0.0.1','::1','[::1]','localhost'].includes(host);
const denied=()=>{throw new Error('test_network_non_loopback_denied');};
function checkUrl(value){const u=new URL(typeof value==='string'||value instanceof URL?value:value.url);if(!['http:','https:'].includes(u.protocol)||!loopback(u.hostname)||u.username||u.password)denied();}
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{checkUrl(input);return originalFetch(input,init);};
for(const mod of [http,https])for(const key of ['request','get']){const original=mod[key];mod[key]=function(...args){const v=args[0];if(typeof v==='string'||v instanceof URL)checkUrl(v);else if(!loopback(v?.hostname??v?.host??'localhost'))denied();return original.apply(this,args);};}
const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){let options=args[0];if(Array.isArray(options))options=options[0];const host=typeof options==='object'?options.host??'localhost':typeof args[1]==='string'?args[1]:'localhost';if((typeof options==='string')||options?.path||!loopback(host))denied();return originalConnect.apply(this,args);};
syncBuiltinESMExports();
// Do not permit a child to remove preload protection or escape through curl/shell.
// The only non-Node executables needed by this repository's tests are local PG
// fixture tools and the locked esbuild transform binary; none issue HTTP.

const preload=`--import=${JSON.stringify(fileURLToPath(import.meta.url))}`;
function protectedOptions(options={}){if(options.shell)throw Error('test_child_process_not_allowed');return {...options,env:{...(options.env??process.env),NODE_OPTIONS:preload}};}
function permitted(command){return command===process.execPath||command==='node'||['initdb','pg_ctl'].includes(command)||/[/\\]node_modules[/\\]@esbuild[/\\][^/\\]+[/\\]bin[/\\]esbuild$/.test(command);}
for(const key of ['spawn','spawnSync','execFile','execFileSync']){const original=childProcess[key];childProcess[key]=function(...args){if(!permitted(String(args[0])))throw Error('test_child_process_not_allowed');const index=Array.isArray(args[1])?2:1;if(typeof args[index]==='function')args.splice(index,0,protectedOptions());else args[index]=protectedOptions(args[index]);return original.apply(this,args);};}
const originalFork=childProcess.fork;
childProcess.fork=function(...args){const index=Array.isArray(args[1])?2:1;const options=args[index]??{};if(options.execPath&&options.execPath!==process.execPath)throw Error('test_child_process_not_allowed');args[index]=protectedOptions(options);return originalFork.apply(this,args);};
childProcess.exec=childProcess.execSync=()=>{throw Error('test_child_process_not_allowed');};
syncBuiltinESMExports();
