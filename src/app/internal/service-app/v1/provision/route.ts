import {supportProvisionAuthenticatorFromEnv} from '@/lib/service-app/provision-auth';
import {handleSupportProvisionRequest} from '@/lib/service-app/provision-route';
import {runtimeSupportWorkspaceStore} from '@/lib/service-app/workspace-reservation';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request){
  return handleSupportProvisionRequest(request,{authenticate:supportProvisionAuthenticatorFromEnv(),acquire:input=>runtimeSupportWorkspaceStore.acquire(input)});
}
export async function GET(request:Request){
  return handleSupportProvisionRequest(request,{authenticate:undefined,acquire:input=>runtimeSupportWorkspaceStore.acquire(input)});
}
