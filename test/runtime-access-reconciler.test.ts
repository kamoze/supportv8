import { usesWorkspaceAccessProjection } from '@/lib/service-app/runtime-access-rollout';
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
 const targets=vi.fn(async()=>scopes);const reconcile=vi.fn(async(s)=>{if(s.installationId==='one')throw Error('authority_unavailable');return {processed:1,failed:0,nextCursor:null};});
 expect(await reconcileSupportAccessBatch({after:'last'},{env:{SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED:'true',SUPPORTV8_ACCESS_SYNC_TARGETS_JSON:'[{"accountId":"account","tenantId":"tenant"}]'},store:{targets} as never,reconcile})).toEqual({after:'two',processed:1,failed:1});
 expect(targets).toHaveBeenCalledWith('last',4);expect(reconcile).toHaveBeenCalledTimes(2);
});

it('rollout refuses missing scope and skips another tenant without applying access',async()=>{const targets=vi.fn(async()=>[{accountId:'account',tenantId:'other',installationId:'outside',workspaceId:'native',subject:'worker',verticalId:'runtime'}]);const reconcile=vi.fn();await expect(reconcileSupportAccessBatch({}, {env:{SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED:'true'},store:{targets} as never,reconcile})).rejects.toThrow('access_sync_targets_invalid');expect(targets).not.toHaveBeenCalled();expect(await reconcileSupportAccessBatch({}, {env:{SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED:'true',SUPPORTV8_ACCESS_SYNC_TARGETS_JSON:'[{"accountId":"account","tenantId":"tenant"}]'},store:{targets} as never,reconcile})).toEqual({after:'outside',processed:0,failed:0});expect(reconcile).not.toHaveBeenCalled();});

it('API projection enforcement and worker use the same exact tenant/account rollout scope',()=>{const env={SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED:'true',SUPPORTV8_ACCESS_SYNC_TARGETS_JSON:'[{"accountId":"account","tenantId":"tenant"}]'};expect(usesWorkspaceAccessProjection({accountId:'account',tenantId:'tenant'},env)).toBe(true);expect(usesWorkspaceAccessProjection({accountId:'foreign',tenantId:'tenant'},env)).toBe(false);expect(usesWorkspaceAccessProjection({accountId:'account',tenantId:'foreign'},env)).toBe(false);expect(()=>usesWorkspaceAccessProjection({accountId:'account',tenantId:'tenant'},{SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED:'true'})).toThrow('access_sync_targets_invalid');expect(usesWorkspaceAccessProjection({accountId:'account',tenantId:'tenant'},{})).toBe(false);});
