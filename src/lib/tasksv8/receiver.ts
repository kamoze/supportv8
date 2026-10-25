import {decodeJwt} from 'jose';
import { boundedJson } from './http';
import { parseTaskWorkReceipt } from './authority';
import type { createTaskWorkVerifier } from './authority';
import { taskWorkFact, type SupportTaskWorkStore } from './store';
import type { TaskWorkSourceFact } from './policy';
import { validTaskWorkOutcome } from './outcome';
export function createSupportTaskOutcomeHandler(input:{verify:ReturnType<typeof createTaskWorkVerifier>;store:Pick<SupportTaskWorkStore,'link'|'record'>;current:(fact:TaskWorkSourceFact)=>Promise<boolean>}) {
 return async(request:Request):Promise<Response>=>{
  const fail=(status:number,error:string)=>Response.json({error},{status,headers:{'cache-control':'no-store'}});
  if(request.method!=='POST')return fail(405,'method_not_allowed');
  try{
   const h=request.headers.get('authorization')??'';if(!/^Bearer [\x21-\x7e]{1,16384}$/.test(h))return fail(401,'unauthorized');
   let event:unknown;try{event=await boundedJson(request,65536);}catch{return fail(400,'invalid_outcome');}
   if(!validTaskWorkOutcome(event))return fail(400,'invalid_outcome');
   const binding=await input.verify(h.slice(7),'support_outcome',event);if(!binding)return fail(403,'task_work_denied');
   const row=await input.store.link(binding);if(!row||!await input.current(taskWorkFact(row)))return fail(403,'task_work_denied');
   // Reverify expiry after the current Registry read. SQL holds local lifecycle locks.
   if(!await input.verify(h.slice(7),'support_outcome',event))return fail(403,'task_work_denied');
   const exp=decodeJwt(h.slice(7)).exp;if(!Number.isSafeInteger(exp))return fail(403,'task_work_denied');
   const receipt=await input.store.record(row,binding,event,exp!*1000);
   if(!parseTaskWorkReceipt(receipt,binding))throw Error('task_work_receipt_invalid');
   return Response.json(receipt,{status:receipt.state==='recorded'?201:200,headers:{'cache-control':'no-store'}});
  }catch(error){const code=(error as {code?:string}).code;if(code==='42501')return fail(403,'task_work_denied');if(code==='23505')return fail(409,'task_work_conflict');return fail(503,'task_work_unavailable');}
 };
}
