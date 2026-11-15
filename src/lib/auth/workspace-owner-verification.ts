import decision from '../../../ops/workspace-recovery/owner-verification-required.json';
import {WorkspaceLookupError} from '../tenant-resolver';

/** Reviewed legacy migration holds only deny access. They never establish an
 * account, owner, identity link or hostname registration. Release requires a
 * reviewed verification record and a new policy revision. */
export function requiresWorkspaceOwnerVerification(input:{slug?:string;nativeTenantId?:string}):boolean {
  // These legacy owner APIs also accepted product-qualified domain aliases.
  // Normalization here only widens a denial; it never grants a registration.
  const deniedSlug=input.slug?.trim().toLowerCase().replace(/\.support(?:\.servicev8\.(?:com|internal))?$/, '');
  return decision.workspaces.some(row=>row.slug===deniedSlug||row.nativeTenantId===input.nativeTenantId);
}
export function requireVerifiedWorkspaceOwner(input:{slug?:string;nativeTenantId?:string}):void {
  if(requiresWorkspaceOwnerVerification(input))throw new WorkspaceLookupError(
    'Owner verification is required before this workspace can be linked. Contact your workspace administrator or Support.',
    'workspace_owner_verification_required',409);
}
