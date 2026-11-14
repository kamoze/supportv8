import { describe, expect, it } from 'vitest';
import { mapWorkspaceAccess, reconcileSupportAccessPage, type AccessMembership } from '@/lib/service-app/runtime-access-projection';
const scope={accountId:'acct-1',tenantId:'registry-1',installationId:'install-1',workspaceId:'tenant_fixture',verticalId:'runtime' as const,subject:'user-2'};
const member:AccessMembership={accountId:scope.accountId,tenantId:scope.tenantId,identitySubject:scope.subject,role:'admin',status:'active',revision:2,groupIds:['b1d580ef-e57d-40ec-a004-f0b2fa233424'],mappingStatus:'mapped'};
describe('Support standard group projection',()=>{
 it.each([['admin','support:manage'],['member','support:read'],['viewer','support:read']])('maps %s with least privilege', (role,capability)=>expect(mapWorkspaceAccess({...member,role},scope)).toEqual({status:'synced',capability}));
 it('revokes inactive before mapping and blocks mismatched or missing canonical groups',()=>{
  expect(mapWorkspaceAccess({...member,status:'suspended'},scope)).toEqual({status:'revoked',capability:null});
  expect(mapWorkspaceAccess({...member,groupIds:[]},scope).status).toBe('blocked');
  expect(mapWorkspaceAccess({...member,tenantId:'other'},scope).status).toBe('blocked');
  expect(mapWorkspaceAccess({...member,role:'owner',mappingStatus:'mapped'},scope).status).toBe('blocked');
 });
 it('applies current authority rather than stale delivered role, receipts only durable apply and advances after receipt',async()=>{
  const calls:string[]=[]; const desired={...member,role:'viewer',revision:3};
  const result=await reconcileSupportAccessPage(scope,{
   cursor:async()=>'', list:async()=>({memberships:[member],nextCursor:'user-2'}), current:async()=>desired,
   eligible:async()=>true, apply:async(_s,m,mapping)=>{calls.push('apply');expect(m.revision).toBe(3);expect(mapping.capability).toBe('support:read');return {revision:3,receiptId:'receipt-3',status:'synced'};},
   receipt:async value=>{calls.push('receipt');expect(value.appliedRevision).toBe(3);expect(value.desiredRevision).toBe(3);}, advance:async()=>{calls.push('advance');}
  });
  expect(result).toEqual({processed:1,nextCursor:'user-2'});expect(calls).toEqual(['apply','receipt','advance']);
 });
 it('does not advance on outage or cross-tenant records',async()=>{
  let applied=false,advanced=false;
  const deps={cursor:async()=>'',list:async()=>({memberships:[member],nextCursor:null}),current:async()=>null,eligible:async()=>true,apply:async()=>{applied=true;throw Error('unexpected');},receipt:async()=>{},advance:async()=>{advanced=true;}};
  await expect(reconcileSupportAccessPage(scope,deps)).rejects.toThrow('authority_unavailable');expect(applied).toBe(false);expect(advanced).toBe(false);
  await expect(reconcileSupportAccessPage(scope,{...deps,current:async()=>({...member,tenantId:'other'})})).rejects.toThrow('authority_scope_mismatch');
 });
 it('does not publish a falsely synced receipt after a newer revision wins the database race',async()=>{
  let published=false,advanced=false;
  await expect(reconcileSupportAccessPage(scope,{cursor:async()=>'',list:async()=>({memberships:[member],nextCursor:null}),current:async()=>member,eligible:async()=>true,apply:async()=>({revision:3,receiptId:'newer',status:'revoked'}),receipt:async()=>{published=true;},advance:async()=>{advanced=true;}})).rejects.toThrow('projection_revision_changed');
  expect(published).toBe(false);expect(advanced).toBe(false);
 });
});
