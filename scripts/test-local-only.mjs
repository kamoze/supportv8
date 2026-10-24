import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// No inherited application URLs, credentials, proxy settings or activation flags.
const env={PATH:process.env.PATH,NODE_ENV:'test',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:`--import=${fileURLToPath(new URL('../test/local-only-network-guard.mjs',import.meta.url))}`};
if(process.env.CI==='true')env.CI='true';
for(const key of ['SUPPORT_OPERATIONAL_TEST_ADMIN_URL','SUPPORTV8_REAL_POSTGRES','SUPPORTV8_WORKSPACE_TEST_DATABASE_URL','SUPPORTV8_NEXT_STANDALONE_PROOF','SUPPORTV8_RUN_REDIS_INTEGRATION','REDIS_URL','MANAGED_SUPPORT_TEST_DATABASE_URL','MANAGED_SUPPORT_SOURCE_TEST_DATABASE_URL','SUPPORT_MANAGED_LIFECYCLE_TEST_DATABASE_URL','SUPPORT_MANAGED_PERMANENT_TEST_DATABASE_URL','SUPPORTV8_TEST_DATABASE_URL']){
 const value=process.env[key];if(value===undefined)continue;if(key.endsWith('URL')){const u=new URL(value);if(!['127.0.0.1','::1','[::1]'].includes(u.hostname))throw Error('test_fixture_must_be_loopback');}env[key]=value;
}
const child=spawn(process.execPath,['--import',fileURLToPath(new URL('../test/local-only-network-guard.mjs',import.meta.url)),fileURLToPath(new URL('../node_modules/vitest/vitest.mjs',import.meta.url)),'run',...process.argv.slice(2)],{stdio:'inherit',env});
child.on('exit',(code,signal)=>{if(signal)process.kill(process.pid,signal);else process.exitCode=code??1;});
