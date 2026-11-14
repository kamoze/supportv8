import type { SupportCapability, SupportRuntimeScope } from './runtime-access';

export const SUPPORT_ACCESS_MAPPING = 'support.standard-groups.v1';
export const SUPPORT_PRODUCT = 'servicev8.service-app.supportv8';
export type AccessMembership = {accountId:string;tenantId:string;identitySubject:string;role:string;status:string;revision:number;groupIds:string[];mappingStatus:string};
export type AccessMapping = {status:'synced'|'blocked'|'revoked';capability:SupportCapability|null};
export type AppliedAccess = {revision:number;receiptId:string;status:AccessMapping['status']};
export type AccessReceipt = {accountId:string;subject:string;installationId:string;productId:string;desiredRevision:number;appliedRevision:number;mappingVersion:string;status:AccessMapping['status'];receiptId:string;reason:string|null};
export type ReconciliationDependencies = {
 cursor:()=>Promise<string>; list:(after:string,limit:number)=>Promise<{memberships:AccessMembership[];nextCursor:string|null}>;
 current:(subject:string)=>Promise<AccessMembership|null>;eligible:()=>Promise<boolean>;
 apply:(scope:SupportRuntimeScope,member:AccessMembership,mapping:AccessMapping)=>Promise<AppliedAccess>;
 receipt:(value:AccessReceipt)=>Promise<void>; advance:(expected:string,next:string)=>Promise<void>;
};
export function mapWorkspaceAccess(member:AccessMembership,scope:SupportRuntimeScope):AccessMapping {
 const blocked:AccessMapping={status:'blocked',capability:null};
 if(member.accountId!==scope.accountId||member.tenantId!==scope.tenantId||member.identitySubject!==scope.subject||!Number.isSafeInteger(member.revision)||member.revision<1)return blocked;
 if(member.status!=='active')return {status:'revoked',capability:null};
 if(member.role==='owner'&&member.mappingStatus==='owner'&&Array.isArray(member.groupIds)&&member.groupIds.length===0)return {status:'synced',capability:'support:manage'};
 if(member.mappingStatus!=='mapped'||!Array.isArray(member.groupIds)||member.groupIds.length!==1||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(member.groupIds[0]!))return blocked;
 if(member.role==='admin')return {status:'synced',capability:'support:manage'};
 if(member.role==='member'||member.role==='viewer')return {status:'synced',capability:'support:read'};
 return blocked;
}
/** One bounded page, current reads per subject, receipt-before-cursor retry semantics. */
export async function reconcileSupportAccessPage(scope:SupportRuntimeScope,deps:ReconciliationDependencies,limit=50):Promise<{processed:number;nextCursor:string|null}>{
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('invalid_reconciliation_limit');
 if(!await deps.eligible())throw Error('installation_unavailable');
 const after=await deps.cursor();const page=await deps.list(after,limit);
 if(!Array.isArray(page.memberships)||page.memberships.length>limit||!(page.nextCursor===null||typeof page.nextCursor==='string'&&page.nextCursor.length<=192&&page.nextCursor!==after))throw Error('invalid_reconciliation_page');
 const seen=new Set<string>();
 for(const listed of page.memberships){
  if(typeof listed.identitySubject!=='string'||!listed.identitySubject||seen.has(listed.identitySubject)||listed.accountId!==scope.accountId||listed.tenantId!==scope.tenantId)throw Error('authority_scope_mismatch');
  seen.add(listed.identitySubject);
  const current=await deps.current(listed.identitySubject);if(!current)throw Error('authority_unavailable');
  const target={...scope,subject:listed.identitySubject};
  if(current.accountId!==scope.accountId||current.tenantId!==scope.tenantId||current.identitySubject!==target.subject)throw Error('authority_scope_mismatch');
  if(!Number.isSafeInteger(current.revision)||current.revision<1)throw Error('invalid_access_revision');
  const mapped=mapWorkspaceAccess(current,target);const applied=await deps.apply(target,current,mapped);
  if(applied.revision!==current.revision)throw Error('projection_revision_changed');
  await deps.receipt({accountId:scope.accountId,subject:target.subject,installationId:scope.installationId,productId:SUPPORT_PRODUCT,desiredRevision:current.revision,appliedRevision:applied.revision,mappingVersion:SUPPORT_ACCESS_MAPPING,status:applied.status,receiptId:applied.receiptId,reason:applied.status==='synced'?null:applied.status==='revoked'?'membership_inactive':'mapping_or_local_policy_blocked'});
 }
 await deps.advance(after,page.nextCursor??'');
 return {processed:page.memberships.length,nextCursor:page.nextCursor};
}
