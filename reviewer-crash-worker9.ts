
import {appendFileSync,writeFileSync} from 'node:fs';
import {NextRequest} from 'next/server';
import {POST as chat} from './src/app/api/chat/route';
import {ragIngestion} from './src/lib/services/rag-ingestion-service';
import {signRuntimeSupportSession,setCustomRuntimeAccessResolverForTesting,RUNTIME_SUPPORT_COOKIE} from './src/lib/service-app/runtime-session';
const secret='review-only-fixture-not-production';const workspaceId='tenant_rt_'+'a'.repeat(48);
setCustomRuntimeAccessResolverForTesting(async scope=>({...scope,capability:'support:manage',email:'review@example.test',domain:'tenant-a'} as any));
ragIngestion.queryRag=async()=>{appendFileSync(process.env.FIXTURE_ACCEPTANCE_PATH!,JSON.stringify({pid:process.pid,accepted:true})+'\n');if(process.env.FIXTURE_KILL_AFTER_ACCEPT==='yes')process.kill(process.pid,'SIGKILL');return {answer:process.env.FIXTURE_OWNER_RESPONSE!,citations:[]} as any};
const token=signRuntimeSupportSession({accountId:'acct-a',tenantId:workspaceId,workspaceId,verticalId:'runtime',installationId:'fixture-install-a',sub:'review-owner-a',roleCap:'support:manage',tenantDomain:'tenant-a'},secret);
const request=new NextRequest('https://tenant-a.support.servicev8.com/api/chat',{method:'POST',headers:{host:'tenant-a.support.servicev8.com',cookie:`${RUNTIME_SUPPORT_COOKIE}=${token}`,'content-type':'application/json'},body:JSON.stringify({query:'Case '+process.env.FIXTURE_TURN_ID!,employeeId:'emp_rag_intelligence',clientTurnId:process.env.FIXTURE_TURN_ID!,threadId:'private-'+process.env.FIXTURE_TURN_ID!,isPrivate:true,participants:['review-owner-a']})});const response=await chat(request);writeFileSync(process.env.FIXTURE_RESULT_PATH!,JSON.stringify({status:response.status,body:await response.json()}));
