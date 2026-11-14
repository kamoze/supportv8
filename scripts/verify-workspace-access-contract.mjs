import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root='/home/kamo/sv8-validation';
const support=resolve(root,'support-user-sync');
const registry=resolve(root,'registry-user-sync');
const load=(folder,file)=>import(pathToFileURL(resolve(folder,file)));
const {default:pg}=await load(support,'node_modules/pg/lib/index.js');
const {PostgresClient}=await load(support,'src/lib/db/pg-client.ts');
const {SupportAccessProjectionStore}=await load(support,'src/lib/service-app/runtime-access-projection-store.ts');
const {RegistrySupportAccessClient}=await load(support,'src/lib/service-app/runtime-access-projection-client.ts');
const {reconcileSupportInstallation}=await load(support,'src/lib/service-app/runtime-access-reconciler.ts');
const {PostgresWorkspaceAccess}=await load(registry,'src/registry/workspace-access.ts');
const {createWorkspaceAccessHandler}=await load(registry,'src/registry/workspace-access-http.ts');
const url='postgres://postgres@127.0.0.1:52996/support_contract_test';
const scope={workspaceId:'tenant_support_contract',accountId:'fixture-account',tenantId:'fixture-tenant',installationId:'fixture-installation',verticalId:'runtime',subject:'fixture-user'};
const productId='servicev8.service-app.supportv8';
const admin=new pg.Pool({connectionString:url});
const app=new pg.Pool({connectionString:'postgres://supportv8_app@127.0.0.1:52996/support_contract_test'});
const authority=new PostgresWorkspaceAccess(url);
try{
 await admin.query("CREATE SCHEMA supportv8; CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain varchar(128),servicev8_account_id varchar(128));");
 for(const file of ['005_runtime_support_workspaces.sql','014_runtime_access_projection.sql','015_runtime_access_receiver_receipts.sql']){
  await admin.query(await readFile(resolve(support,'migrations',file),'utf8'));
 }
 await admin.query('GRANT USAGE ON SCHEMA supportv8 TO supportv8_app; GRANT SELECT ON supportv8.runtime_support_workspaces TO supportv8_app');
 for(const file of ['0006_registry_memberships.sql','0043_workspace_access.sql']){
  await admin.query(await readFile(resolve(registry,'migrations',file),'utf8'));
 }
 await admin.query("INSERT INTO supportv8.tenants VALUES($1,'fixture-support','fixture-account')",[scope.workspaceId]);
 await admin.query(`INSERT INTO supportv8.runtime_support_workspaces
  (installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state)
  VALUES($1,'fixture-operation',$2,$3,'runtime','fixture-support','fixture-owner',$4,'fixture-support','workspace_created')`,
  [scope.installationId,scope.accountId,scope.tenantId,scope.workspaceId]);
 await admin.query("INSERT INTO registry_tenants(id,account_id,slug,display_name,status) VALUES($1,$2,'fixture-workspace','Fixture','active')",[scope.tenantId,scope.accountId]);
 await admin.query("INSERT INTO registry_memberships(tenant_id,account_id,identity_subject,email,role,status) VALUES($1,$2,$3,'fixture@example.test','admin','active')",[scope.tenantId,scope.accountId,scope.subject]);
 let loseAcknowledgement=false;
 let rejectedForeign;
 let lastPayload;
 const handler=createWorkspaceAccessHandler({
  store:authority,
  authenticate:async request=>{
   const token=request.headers.get('authorization');
   if(!['Bearer fixture-read','Bearer fixture-receipt'].includes(token))return null;
   return {clientId:'fixture-support-workload',productId,permission:token.endsWith('receipt')?'receipt':'read',expiresAt:Date.now()/1000+60};
  },
  installation:async key=>key.accountId===scope.accountId&&key.tenantId===scope.tenantId&&key.installationId===scope.installationId
   ? {productId,enabled:true,entitled:true}:undefined
 });
 const env={REGISTRY_URL:'https://fixture-registry.test/',SERVICEV8_OIDC_ISSUER:'https://fixture-issuer.test/',SUPPORTV8_ACCESS_REGISTRY_CLIENT_ID:'fixture-support-workload',SUPPORTV8_ACCESS_REGISTRY_CLIENT_SECRET:'fixture-only'};
 const transport=async(url,init)=>{
  if(String(url).endsWith('/token'))return Response.json({access_token:String(init.body).includes('access%3Areceipt')?'fixture-receipt':'fixture-read'});
  const request=new Request(url,init);
  const response=await handler(request);
  if(request.url.endsWith('/receipt')){
   lastPayload=JSON.parse(String(init.body));
   assert.ok(lastPayload.receiverSequence>0);
   assert.equal(response.status,200,await response.clone().text());
   if(loseAcknowledgement){loseAcknowledgement=false;throw Error('synthetic lost acknowledgement');}
  }else if(response.status===403){
   rejectedForeign=response.status;
  }
  return response;
 };
 const makeStore=()=>new SupportAccessProjectionStore(new PostgresClient(undefined,app));
 const registryClient=new RegistrySupportAccessClient(env,transport);
 const readReceipt=async()=> (await authority.receipts({...scope,after:'',limit:5})).receipts[0];
 const accept=async (revision,sequence,status)=>{
  const result=await reconcileSupportInstallation(scope,makeStore(),registryClient);
  assert.equal(result.failed,0);
  const receipt=await readReceipt();
  assert.deepEqual([receipt.desiredRevision,receipt.receiverSequence,receipt.status],[revision,sequence,status]);
  return receipt;
 };
 const initial=await accept(1,1,'synced');
 assert.equal((await makeStore().restriction(scope)).capability,'support:manage');
 assert.equal((await accept(1,1,'synced')).receiptId,initial.receiptId);
 const appClient=new PostgresClient(undefined,app);
 await appClient.withWorkspaceProvisioningSession(
  {tenantId:scope.workspaceId,registryTenantId:scope.tenantId,accountId:scope.accountId},
  db=>db.query("UPDATE supportv8.runtime_access_projections SET local_capability='support:read' WHERE installation_id=$1 AND identity_subject=$2",[scope.installationId,scope.subject])
 );
 loseAcknowledgement=true;
 assert.equal((await reconcileSupportInstallation(scope,makeStore(),registryClient)).failed,1);
 const originalPayload=lastPayload;
 assert.deepEqual([(await readReceipt()).status,originalPayload.receiverSequence],['blocked',2]);
 await makeStore().retry(scope);
 assert.deepEqual((await accept(1,2,'blocked')).receiptId,originalPayload.receiptId);
 assert.deepEqual(lastPayload,originalPayload);
 await admin.query("UPDATE registry_memberships SET role='viewer'");
 await accept(2,3,'synced');
 assert.equal((await makeStore().restriction(scope)).capability,'support:read');
 await admin.query('DELETE FROM registry_memberships');
 await accept(3,4,'revoked');
 assert.equal((await makeStore().restriction(scope)).denied,true);
 await assert.rejects(registryClient.current({...scope,accountId:'foreign'},scope.subject),/authority_unavailable/);
 assert.equal(rejectedForeign,403);
 console.log('Passed Registry HTTP + PostgreSQL / restricted Support PostgreSQL rehearsal: admin, exact replay, same-revision ceiling, lost acknowledgement, exact retry after new store, downgrade, deletion tombstone, foreign-account rejection.');
}finally{
 await authority.close();
 await app.end();
 await admin.end();
}
