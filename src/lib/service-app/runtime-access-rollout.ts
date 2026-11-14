/** Explicit rollout scope; missing or malformed configuration never means every tenant. */
export function accessSyncTargets(raw:string|undefined):{accountId:string;tenantId:string}[]{
 try{const rows:unknown=JSON.parse(raw??'null');if(!Array.isArray(rows)||!rows.length||rows.length>50)throw Error();
  if(rows.some(v=>!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='accountId,tenantId'||![v.accountId,v.tenantId].every(id=>typeof id==='string'&&/^[A-Za-z0-9_:@.-]{1,192}$/.test(id))))throw Error();
  return rows;
 }catch{throw Error('access_sync_targets_invalid');}
}

export function usesWorkspaceAccessProjection(scope:{accountId:string;tenantId:string},env:Readonly<Record<string,string|undefined>>=process.env):boolean {
 if(env.SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED!=='true')return false;
 return accessSyncTargets(env.SUPPORTV8_ACCESS_SYNC_TARGETS_JSON).some(a=>a.accountId===scope.accountId&&a.tenantId===scope.tenantId);
}
