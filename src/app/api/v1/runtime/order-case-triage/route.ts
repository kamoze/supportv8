import {handleRuntimeOrderHandoff,runtimeOrderAuthenticatorFromEnv} from '@/lib/runtime/order-handoff';
import {orderHandoffStore} from '@/lib/runtime/order-handoff-store';

export async function POST(request:Request){
  return handleRuntimeOrderHandoff(request,{authenticate:runtimeOrderAuthenticatorFromEnv(),store:orderHandoffStore});
}
