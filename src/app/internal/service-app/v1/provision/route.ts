import {supportProvisionAuthenticatorFromEnv} from '@/lib/service-app/provision-auth';
import {handleSupportProvisionRequest} from '@/lib/service-app/provision-route';
import {runtimeSupportWorkspaceStore} from '@/lib/service-app/workspace-reservation';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request){
  return handleSupportProvisionRequest(request,{authenticate:supportProvisionAuthenticatorFromEnv(),acquire:input=>runtimeSupportWorkspaceStore.acquire(input)});
}
async function rejectUnsupportedMethod(request:Request){
  return handleSupportProvisionRequest(request,{authenticate:undefined,acquire:input=>runtimeSupportWorkspaceStore.acquire(input)});
}
export const GET=rejectUnsupportedMethod;
export const HEAD=rejectUnsupportedMethod;
export const OPTIONS=rejectUnsupportedMethod;
export const PUT=rejectUnsupportedMethod;
export const PATCH=rejectUnsupportedMethod;
export const DELETE=rejectUnsupportedMethod;
