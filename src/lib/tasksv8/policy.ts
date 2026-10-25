import { boundedJson } from './http';
import { exact, parseTaskWorkBinding, taskWorkUuid, type TaskWorkBinding } from './contract';
import { taskWorkCanonical, taskWorkEventMatches } from './authority';
export type TaskWorkSourceFact={binding:TaskWorkBinding;event:unknown;requester:string;target:{accountId:string;tenantId:string;installationId:string;workspaceId:string;verticalId:'runtime'}};
export type TaskWorkPolicyDependencies={authenticate:(request:Request)=>Promise<boolean>;load:(ref:string)=>Promise<TaskWorkSourceFact|null>;current:(fact:TaskWorkSourceFact)=>Promise<boolean>;now?:()=>number};
export function createTaskWorkPolicyHandler(deps:TaskWorkPolicyDependencies) {
  return async(request:Request):Promise<Response>=>{
    const response=(status:number,error:string)=>Response.json({error},{status,headers:{'cache-control':'no-store'}});
    if(request.method!=='POST')return response(405,'method_not_allowed');
    try{
      if(!await deps.authenticate(request))return response(401,'unauthorized');
      let selector:unknown;try{selector=await boundedJson(request,2048);}catch{return response(400,'invalid_request');}
      if(!exact(selector,['schemaVersion','operation','provenanceRef'])||selector.schemaVersion!==1||selector.operation!=='support_intake'||!taskWorkUuid(selector.provenanceRef))return response(400,'invalid_request');
      const first=await deps.load(selector.provenanceRef);
      if(!first || !parseTaskWorkBinding(first.binding) || first.binding.operation!==selector.operation || first.binding.provenanceRef!==selector.provenanceRef || !taskWorkEventMatches(first.binding,first.event) || !await deps.current(first))return response(403,'task_work_issuance_denied');
      const current=await deps.load(selector.provenanceRef);
      if(!current || taskWorkCanonical(current)!==taskWorkCanonical(first) || !await deps.current(current))return response(403,'task_work_issuance_denied');
      const now=(deps.now??Date.now)();
      return Response.json({...current.binding,evaluatedAt:new Date(now).toISOString(),expiresAt:new Date(now+30000).toISOString()},{headers:{'cache-control':'no-store'}});
    }catch{return response(503,'task_work_issuance_unavailable');}
  };
}
