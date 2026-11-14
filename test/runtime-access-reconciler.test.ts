import { expect,it,vi } from 'vitest';
import { reconcileSupportAccessBatch } from '@/lib/service-app/runtime-access-reconciler';
it('disabled worker never touches database or authority before migration',async()=>{
 const targets=vi.fn(()=>{throw Error('must not touch DB');});const reconcile=vi.fn();
 expect(await reconcileSupportAccessBatch({}, {env:{},store:{targets} as never,reconcile})).toEqual({after:'',processed:0,failed:0});
 expect(await reconcileSupportAccessBatch({}, {env:{SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED:'true',SUPPORTV8_WORKSPACE_ACCESS_SYNC_WORKER_DISABLED:'true'},store:{targets} as never,reconcile})).toEqual({after:'',processed:0,failed:0});
 expect(targets).not.toHaveBeenCalled();expect(reconcile).not.toHaveBeenCalled();
});
it('worker scans bounded exact installation scopes and continues after isolated failure',async()=>{
 const scopes=['one','two'].map(installationId=>({accountId:'account',tenantId:'tenant',installationId,workspaceId:'tenant_native',subject:'access-reconciler',verticalId:'runtime' as const}));
 const targets=vi.fn(async()=>scopes);const reconcile=vi.fn(async(s)=>{if(s.installationId==='one')throw Error('authority_unavailable');return {processed:1,nextCursor:null};});
 expect(await reconcileSupportAccessBatch({after:'last'},{env:{SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED:'true'},store:{targets} as never,reconcile})).toEqual({after:'two',processed:1,failed:1});
 expect(targets).toHaveBeenCalledWith('last',4);expect(reconcile).toHaveBeenCalledTimes(2);
});
