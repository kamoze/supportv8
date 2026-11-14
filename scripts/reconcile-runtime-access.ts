import { parseSupportRuntimeScope } from '../src/lib/service-app/runtime-access';
import { reconcileSupportInstallation } from '../src/lib/service-app/runtime-access-reconciler';
import { SupportAccessProjectionStore } from '../src/lib/service-app/runtime-access-projection-store';
import { RegistrySupportAccessClient } from '../src/lib/service-app/runtime-access-projection-client';
import { pgClient } from '../src/lib/db/pg-client';
// Operator/worker invocation with existing binding IDs only. No HTTP trust bypass.
async function main(){
 if(process.env.SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED!=='true')throw Error('access_reconciliation_disabled');
 const [accountId,tenantId,installationId,workspaceId,retry]=process.argv.slice(2);
 const scope=parseSupportRuntimeScope({accountId,tenantId,installationId,workspaceId,verticalId:'runtime',subject:'access-reconciler'});
 if(!scope||!([6,7].includes(process.argv.length))||(process.argv.length===7&&retry!=="--retry"))throw Error('usage: reconcile-runtime-access accountId tenantId installationId nativeWorkspaceId');
 const store=new SupportAccessProjectionStore(),registry=new RegistrySupportAccessClient();
 if(retry==='--retry')await store.retry(scope);
 const result=await reconcileSupportInstallation(scope,store,registry);
 console.log(JSON.stringify({installationId,processed:result.processed,hasMore:result.nextCursor!==null}));
}
main().catch(()=>{console.error('support_access_reconciliation_unavailable');process.exitCode=1;}).finally(()=>pgClient.close());
