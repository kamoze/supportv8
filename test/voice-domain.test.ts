import {describe,expect,it,vi} from 'vitest';
import {generateKeyPair,SignJWT} from 'jose';
import {createVoiceDomainAuthenticator,handleVoiceDomainRequest,type VoiceDomainStore} from '@/lib/voice/voice-domain';

const binding={accountId:'account-acme',tenantId:'tenant_acme',tenantDomain:'acme',verticalId:'supportv8',acquisitionId:'acq-a',
  installationId:'inst-a',entitlementId:'ent-a',hireId:'hire-a',productId:'servicev8.ai-support-agent'};
const base={binding,sessionId:'session-a',toolCallId:'tool-a',action:'support_ticket_lookup',parameters:{ticketReference:'SV8-42'}};
const request=(patch={})=>new Request('https://support.test/api/v1/voice/tools',{method:'POST',body:JSON.stringify({...base,...patch})});
function fixture(){
  const store={tenant:vi.fn(async()=>({id:'tenant_acme',domain:'acme',servicev8AccountId:'account-acme'})),
    ticket:vi.fn(async()=>({tenantId:'tenant_acme',reference:'SV8-42',status:'open',priority:'high',summary:'Cannot sign in',sentiment:'frustrated'})),
    createTicket:vi.fn(async()=>({tenantId:'tenant_acme',reference:'SV8-43',status:'open'})),
    knowledge:vi.fn(async()=>[{title:'Reset access',summary:'Use the account recovery flow.',url:'https://acme.support.servicev8.com/kb/reset'}]),
    escalate:vi.fn(async()=>({tenantId:'tenant_acme',reference:'SV8-42',status:'escalated'}))} satisfies VoiceDomainStore;
  return {store,authenticate:vi.fn(async()=>({clientId:'voice-agents-reference',scopes:['supportv8:voice:read','supportv8:voice:escalate']}))};
}

describe('SupportV8 voice Domain API',()=>{
  it('returns only the bounded ticket view after exact tenant, account, and domain authorization',async()=>{
    const f=fixture();const response=await handleVoiceDomainRequest(request(),f);
    expect(await response.json()).toEqual({ok:true,ticket:{reference:'SV8-42',status:'open',priority:'high'}});
    expect(f.store.ticket).toHaveBeenCalledWith('tenant_acme','SV8-42');
  });
  it.each(['accountId','tenantId','tenantDomain','verticalId','productId'] as const)('denies a mismatched %s before ticket access',async field=>{
    const f=fixture();const response=await handleVoiceDomainRequest(request({binding:{...binding,[field]:'other'}}),f);
    expect(response.status).toBe(403);expect(f.store.ticket).not.toHaveBeenCalled();
  });
  it('creates, searches, and escalates through a closed operation set',async()=>{
    const f=fixture();
    expect(await (await handleVoiceDomainRequest(request({action:'support_ticket_create',parameters:{customerName:'Sam',summary:'Unable to log in',priority:'high'}}),f)).json())
      .toEqual({ok:true,ticket:{reference:'SV8-43',status:'open'}});
    expect(await (await handleVoiceDomainRequest(request({action:'support_knowledge_search',parameters:{query:'reset access'}}),f)).json())
      .toEqual({ok:true,results:[{title:'Reset access',summary:'Use the account recovery flow.',url:'https://acme.support.servicev8.com/kb/reset'}]});
    expect(await (await handleVoiceDomainRequest(request({action:'support_escalation_create',parameters:{ticketReference:'SV8-42',reason:'Negative sentiment',urgency:'urgent'}}),f)).json())
      .toEqual({ok:true,escalation:{reference:'SV8-42',status:'escalated'}});
  });
  it('requires the escalation scope and rejects tenant hints or arbitrary actions',async()=>{
    const f=fixture();f.authenticate.mockResolvedValue({clientId:'voice-agents-reference',scopes:['supportv8:voice:read']});
    expect((await handleVoiceDomainRequest(request({action:'support_escalation_create',parameters:{ticketReference:'SV8-42',reason:'Risk',urgency:'urgent'}}),f)).status).toBe(403);
    expect((await handleVoiceDomainRequest(request({parameters:{ticketReference:'SV8-42',tenantId:'other'}}),fixture())).status).toBe(400);
    expect((await handleVoiceDomainRequest(request({action:'ticket_delete'}),fixture())).status).toBe(400);
  });
});

it('verifies a short-lived audience, client, and scope-bound workload JWT',async()=>{
  const keys=await generateKeyPair('RS256');const issuer='https://identity.test/realms/servicev8';
  const authenticate=createVoiceDomainAuthenticator({issuer,allowedClientIds:['voice-agents-reference'],key:async()=>keys.publicKey});
  const now=Math.floor(Date.now()/1000);const claims={iss:issuer,aud:'supportv8',azp:'voice-agents-reference',sub:'service-account',iat:now,exp:now+120,scope:'supportv8:voice:read'};
  const signed=async(patch={})=>new Request(request(),{headers:{authorization:'Bearer '+await new SignJWT({...claims,...patch}).setProtectedHeader({alg:'RS256'}).sign(keys.privateKey)}});
  expect(await authenticate(await signed())).toEqual({clientId:'voice-agents-reference',scopes:['supportv8:voice:read']});
  for(const patch of [{aud:'other'},{azp:'other'},{scope:'tickets:write'},{exp:now+3600},{sub:''}])expect(await authenticate(await signed(patch))).toBeNull();
});
