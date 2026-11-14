import { describe, expect, it } from 'vitest';
import { mapWorkspaceAccess, reconcileSupportAccessPage, type AccessMembership, type ReconciliationDependencies } from '@/lib/service-app/runtime-access-projection';
const scope={accountId:'acct-1',tenantId:'registry-1',installationId:'install-1',workspaceId:'tenant_fixture',verticalId:'runtime' as const,subject:'user-2'};
const member:AccessMembership={accountId:scope.accountId,tenantId:scope.tenantId,identitySubject:scope.subject,role:'admin',status:'active',revision:2,groupIds:['b1d580ef-e57d-40ec-a004-f0b2fa233424'],mappingStatus:'mapped'};
const defaults=():ReconciliationDependencies=>({cursor:async()=>'',list:async()=>({memberships:[member],nextCursor:null}),current:async()=>member,eligible:async()=>true,attempt:async()=>true,apply:async(_s,m)=>({revision:m.revision,appliedRevision:m.revision,receiverSequence:1,receiptId:'receipt',status:'synced',reason:null}),failure:async(_s,m,status,reason)=>({revision:m.revision,appliedRevision:null,receiverSequence:2,receiptId:'failure',status,reason}),receipt:async()=>{},advance:async()=>{}});
describe('Support standard group projection',()=>{
 it.each([['admin','support:manage'],['member','support:read'],['viewer','support:read']])('maps %s with least privilege',(role,capability)=>expect(mapWorkspaceAccess({...member,role},scope)).toEqual({status:'synced',capability}));
 it('accepts revoked deletion tombstones without an email or current groups',()=>expect(mapWorkspaceAccess({...member,status:'revoked',groupIds:[],email:''} as AccessMembership,scope)).toEqual({status:'revoked',capability:null}));
 it('blocks mismatched or missing canonical groups',()=>{
  expect(mapWorkspaceAccess({...member,groupIds:[]},scope).status).toBe('blocked');
  expect(mapWorkspaceAccess({...member,tenantId:'other'},scope).status).toBe('blocked');
  expect(mapWorkspaceAccess({...member,role:'owner',mappingStatus:'mapped'},scope).status).toBe('blocked');
 });
 it('applies fresh authority and publishes the persisted receiver sequence',async()=>{
  const calls:string[]=[];const desired={...member,role:'viewer',revision:3};
  const result=await reconcileSupportAccessPage(scope,{...defaults(),list:async()=>({memberships:[member],nextCursor:'user-2'}),current:async()=>desired,
   apply:async(_s,m,mapping)=>{calls.push('apply');expect(m.revision).toBe(3);expect(mapping.capability).toBe('support:read');return {revision:3,appliedRevision:3,receiverSequence:8,receiptId:'receipt-3',status:'synced',reason:null};},
   receipt:async value=>{calls.push('receipt');expect(value).toMatchObject({appliedRevision:3,desiredRevision:3,receiverSequence:8});},advance:async()=>{calls.push('advance');}
  });
  expect(result).toEqual({processed:1,failed:0,nextCursor:'user-2'});expect(calls).toEqual(['apply','receipt','advance']);
 });
 it('isolates a poisoned first member and advances after the later member receipt',async()=>{
  const second={...member,identitySubject:'user-3'};const applied:string[]=[],receipts:any[]=[];let advanced=false;
  const result=await reconcileSupportAccessPage(scope,{...defaults(),list:async()=>({memberships:[member,second],nextCursor:'user-3'}),current:async subject=>subject==='user-2'?member:second,
   apply:async(s,m)=>{applied.push(s.subject);if(s.subject==='user-2')throw Error('poisoned');return {revision:m.revision,appliedRevision:m.revision,receiverSequence:1,receiptId:'good',status:'synced',reason:null};},
   receipt:async value=>{receipts.push(value);},advance:async()=>{advanced=true;}
  });
  expect(result).toEqual({processed:2,failed:1,nextCursor:'user-3'});expect(applied).toEqual(['user-2','user-3']);expect(receipts.map(r=>r.status)).toEqual(['unavailable','synced']);expect(advanced).toBe(true);
 });
 it('records current-read outage without copying a listed grant and continues safely',async()=>{
  let applied=false;const receipts:any[]=[];
  await reconcileSupportAccessPage(scope,{...defaults(),current:async()=>null,apply:async()=>{applied=true;throw Error('unexpected');},receipt:async r=>{receipts.push(r);}});
  expect(applied).toBe(false);expect(receipts[0]).toMatchObject({status:'unavailable',appliedRevision:null,desiredRevision:2,receiverSequence:2});
 });
 it('never acknowledges stale or cross-tenant authority as synced',async()=>{
  const receipts:any[]=[];
  await reconcileSupportAccessPage(scope,{...defaults(),current:async()=>({...member,tenantId:'other'}),receipt:async r=>{receipts.push(r);}});
  expect(receipts[0].status).toBe('blocked');
  receipts.length=0;
  await reconcileSupportAccessPage(scope,{...defaults(),apply:async()=>({revision:3,appliedRevision:3,receiverSequence:5,receiptId:'newer',status:'revoked',reason:'membership_inactive'}),failure:async()=>({revision:3,appliedRevision:3,receiverSequence:5,receiptId:'newer',status:'revoked',reason:'membership_inactive'}),receipt:async r=>{receipts.push(r);}});
  expect(receipts).toEqual([]);
 });
 it('continues when failure receipt delivery itself fails and skips a backed-off subject',async()=>{
  const second={...member,identitySubject:'user-3'};const applied:string[]=[];
  const result=await reconcileSupportAccessPage(scope,{...defaults(),list:async()=>({memberships:[member,second],nextCursor:null}),attempt:async s=>s.subject!=='user-2',current:async()=>second,apply:async(s,m)=>{applied.push(s.subject);return {revision:m.revision,appliedRevision:m.revision,receiverSequence:1,receiptId:'good',status:'synced',reason:null};},receipt:async()=>{throw Error('receipt_outage');}});
  expect(applied).toEqual(['user-3']);expect(result).toEqual({processed:2,failed:2,nextCursor:null});
 });
});
