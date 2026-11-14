import type { SupportCapability, SupportRuntimeScope } from './runtime-access';

export const SUPPORT_ACCESS_MAPPING = 'support.standard-groups.v1';
export const SUPPORT_PRODUCT = 'servicev8.service-app.supportv8';
export type AccessMembership = {accountId:string;tenantId:string;identitySubject:string;role:string;status:string;revision:number;groupIds:string[];mappingStatus:string};
export type AccessMapping = {status:'synced'|'blocked'|'revoked';capability:SupportCapability|null};
export type ReceiptStatus = AccessMapping['status']|'unavailable';
export type FailureStatus = 'blocked'|'unavailable';
export type FailureReason = 'authority_unavailable'|'authority_scope_mismatch'|'invalid_access_revision'|'projection_unavailable';
export type AppliedAccess = {
 revision:number; appliedRevision:number|null; receiverSequence:number;
 receiptId:string; status:ReceiptStatus; reason:string|null;
};
export type AccessReceipt = {
 accountId:string; subject:string; installationId:string; productId:string;
 desiredRevision:number; appliedRevision:number|null; receiverSequence:number;
 mappingVersion:string; status:ReceiptStatus; receiptId:string; reason:string|null;
};
export type ReconciliationDependencies = {
 cursor:()=>Promise<string>; list:(after:string,limit:number)=>Promise<{memberships:AccessMembership[];nextCursor:string|null}>;
 current:(subject:string)=>Promise<AccessMembership|null>; eligible:()=>Promise<boolean>;
 attempt:(scope:SupportRuntimeScope,revision:number)=>Promise<boolean>;
 apply:(scope:SupportRuntimeScope,member:AccessMembership,mapping:AccessMapping)=>Promise<AppliedAccess>;
 failure:(scope:SupportRuntimeScope,member:AccessMembership,status:FailureStatus,reason:FailureReason)=>Promise<AppliedAccess>;
 pending?:(scope:SupportRuntimeScope,revision:number)=>Promise<AppliedAccess|null>;
 receipt:(value:AccessReceipt)=>Promise<void>;
 deliveryFailed?:(scope:SupportRuntimeScope,receipt:AppliedAccess)=>Promise<void>;
 delivered?:(scope:SupportRuntimeScope,receipt:AppliedAccess)=>Promise<void>;
 advance:(expected:string,next:string)=>Promise<void>;
};
export const validAccessRevision = (revision:number) => Number.isSafeInteger(revision)&&revision>0;
export function exactMembership(scope:SupportRuntimeScope,member:AccessMembership) {
 return member.accountId===scope.accountId&&member.tenantId===scope.tenantId&&member.identitySubject===scope.subject;
}

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
function accessReceipt(scope:SupportRuntimeScope,value:AppliedAccess):AccessReceipt {
 return {
  accountId:scope.accountId,subject:scope.subject,installationId:scope.installationId,productId:SUPPORT_PRODUCT,
  desiredRevision:value.revision,appliedRevision:value.appliedRevision,receiverSequence:value.receiverSequence,
  mappingVersion:SUPPORT_ACCESS_MAPPING,status:value.status,receiptId:value.receiptId,reason:value.reason
 };
}

async function reconcileMember(scope:SupportRuntimeScope,listed:AccessMembership,deps:ReconciliationDependencies):Promise<boolean> {
 const current=await deps.current(scope.subject).catch(()=>null);
 let canonical=listed;
 let reason:FailureReason='authority_unavailable';
 let failureStatus:FailureStatus='unavailable';
 let trustedCurrent=false;
 if(current){
  if(!exactMembership(scope,current)){
   reason='authority_scope_mismatch';
   failureStatus='blocked';
  }else if(!validAccessRevision(current.revision)||current.revision<listed.revision){
   reason='invalid_access_revision';
   failureStatus='blocked';
  }else{
   canonical=current;
   trustedCurrent=true;
  }
 }
 if(!await deps.attempt(scope,canonical.revision))return false;
 const pending=await deps.pending?.(scope,canonical.revision);
 if(pending&&!trustedCurrent&&pending.appliedRevision!==null)return false;
 let result:AppliedAccess;
 if(pending&&!(canonical.status==='revoked'&&pending.appliedRevision===null)){
  result=pending;
 }else if(trustedCurrent){
  try{
   result=await deps.apply(scope,canonical,mapWorkspaceAccess(canonical,scope));
  }catch{
   trustedCurrent=false;
   result=await deps.failure(scope,canonical,'unavailable','projection_unavailable');
  }
 }else{
  result=await deps.failure(scope,canonical,failureStatus,reason);
 }
 if(result.revision!==canonical.revision)return false;
 // Registry accepts only an applied revocation for a deletion tombstone.
 if(canonical.status==='revoked'&&result.appliedRevision===null)return false;
 try{
  await deps.receipt(accessReceipt(scope,result));
 }catch{
  await deps.deliveryFailed?.(scope,result);
  return false;
 }
 await deps.delivered?.(scope,result);
 return trustedCurrent&&result.appliedRevision!==null;
}

/** Validate the whole bounded page before applying any member. */
export async function reconcileSupportAccessPage(scope:SupportRuntimeScope,deps:ReconciliationDependencies,limit=50):Promise<{processed:number;failed:number;nextCursor:string|null}>{
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('invalid_reconciliation_limit');
 if(!await deps.eligible())throw Error('installation_unavailable');
 const after=await deps.cursor();
 const page=await deps.list(after,limit);
 if(!Array.isArray(page.memberships)||page.memberships.length>limit||!(page.nextCursor===null||typeof page.nextCursor==='string'&&page.nextCursor.length<=192&&page.nextCursor!==after))throw Error('invalid_reconciliation_page');
 const seen=new Set<string>();
 for(const listed of page.memberships){
  if(!listed||typeof listed.identitySubject!=='string'||!listed.identitySubject||listed.identitySubject.length>192||seen.has(listed.identitySubject)||!exactMembership({...scope,subject:listed.identitySubject},listed))throw Error('authority_scope_mismatch');
  if(!validAccessRevision(listed.revision))throw Error('invalid_access_revision');
  seen.add(listed.identitySubject);
 }
 let failed=0;
 for(const listed of page.memberships){
  const applied=await reconcileMember({...scope,subject:listed.identitySubject},listed,deps).catch(()=>false);
  if(!applied)failed++;
 }
 await deps.advance(after,page.nextCursor??'');
 return {processed:page.memberships.length,failed,nextCursor:page.nextCursor};
}
