import {describe,expect,it,vi} from 'vitest';
import {generateKeyPair,SignJWT} from 'jose';
import {createRuntimeOrderAuthenticator,handleRuntimeOrderHandoff} from '@/lib/runtime/order-handoff';

const actor={clientId:'servicev8-runtime',accountId:'account-acme',tenantId:'tenant_acme'};
const body={tenantDomain:'acme',caseRef:'case-1',objectiveId:'objective-1',installationId:'sophia-install-1',hireId:'sophia-hire-1',responseDueAt:'2026-09-14T17:00:00.000Z',orderReceiptRef:'orderv8:case:case-1'};
const request=(input:object=body)=>new Request('https://support.test/api/v1/runtime/order-case-triage',{method:'POST',body:JSON.stringify(input)});
function fixture(){return {authenticate:vi.fn(async()=>actor),store:{tenant:vi.fn(async()=>({id:actor.tenantId,domain:'acme',servicev8AccountId:actor.accountId})),get:vi.fn(async()=>null as null|{objectiveId:string;installationId:string;hireId:string;ticketReference:string;receiptRef:string;owner:'Sophia';nextStep:string;knowledgeTitle:string}),knowledge:vi.fn(async()=>[{title:'Delayed order guidance',summary:'Confirm case ownership and review the delivery status.',url:null}]),create:vi.fn(async()=>({ticketReference:'SV8-ORDER-123',receiptRef:'supportv8:order-handoff:case-1',owner:'Sophia' as const,nextStep:'Confirm case ownership and review the delivery status.',knowledgeTitle:'Delayed order guidance'}))}};}

describe('SupportV8 Runtime order handoff',()=>{
  it('uses approved knowledge and creates one case-linked Sophia ticket without customer data',async()=>{
    const f=fixture();const result=await handleRuntimeOrderHandoff(request(),f);
    expect(result.status).toBe(201);
    expect(await result.json()).toMatchObject({ticket:{reference:'SV8-ORDER-123'},receiptRef:'supportv8:order-handoff:case-1',owner:'Sophia'});
    expect(f.store.create).toHaveBeenCalledWith({tenantId:actor.tenantId,caseRef:'case-1',objectiveId:'objective-1',installationId:'sophia-install-1',hireId:'sophia-hire-1',responseDueAt:body.responseDueAt,nextStep:'Confirm case ownership and review the delivery status.',knowledgeTitle:'Delayed order guidance'});
    expect(JSON.stringify(f.store.create.mock.calls)).not.toMatch(/customerName|phone|email/i);
  });
  it('fails closed on wrong tenant, missing guidance, or a forged Order receipt',async()=>{
    const wrong=fixture();wrong.store.tenant.mockResolvedValue({id:actor.tenantId,domain:'acme',servicev8AccountId:'other-account'});
    expect((await handleRuntimeOrderHandoff(request(),wrong)).status).toBe(403);expect(wrong.store.create).not.toHaveBeenCalled();
    const noKnowledge=fixture();noKnowledge.store.knowledge.mockResolvedValue([]);
    expect((await handleRuntimeOrderHandoff(request(),noKnowledge)).status).toBe(409);expect(noKnowledge.store.create).not.toHaveBeenCalled();
    const forged=fixture();expect((await handleRuntimeOrderHandoff(request({...body,orderReceiptRef:'model-said-so'}),forged)).status).toBe(400);expect(forged.store.create).not.toHaveBeenCalled();
  });
  it('returns the existing receipt on retry even when guidance is no longer available',async()=>{
    const f=fixture();f.store.get.mockResolvedValue({objectiveId:'objective-1',installationId:'sophia-install-1',hireId:'sophia-hire-1',ticketReference:'SV8-ORDER-123',receiptRef:'supportv8:order-handoff:case-1',owner:'Sophia',nextStep:'Review guidance',knowledgeTitle:'Delayed order guidance'});
    f.store.knowledge.mockResolvedValue([]);
    expect((await handleRuntimeOrderHandoff(request(),f)).status).toBe(200);
    expect(f.store.knowledge).not.toHaveBeenCalled();expect(f.store.create).not.toHaveBeenCalled();
  });
  it('admits only the short-lived Runtime workload with the exact scope',async()=>{
    const keys=await generateKeyPair('RS256');const issuer='https://identity.test/realms/servicev8';
    const authenticate=createRuntimeOrderAuthenticator({issuer,allowedClientIds:['servicev8-runtime'],key:async()=>keys.publicKey});
    const signed=async(patch={})=>new SignJWT({azp:'servicev8-runtime',scope:'supportv8:runtime:order-triage',account_id:actor.accountId,tenant_id:actor.tenantId,...patch}).setProtectedHeader({alg:'RS256'}).setIssuer(issuer).setAudience('supportv8').setSubject('runtime-service').setIssuedAt().setExpirationTime('2m').sign(keys.privateKey);
    const req=async(token:string)=>new Request('https://support.test/api/v1/runtime/order-case-triage',{headers:{authorization:`Bearer ${token}`,'x-servicev8-account-id':actor.accountId,'x-servicev8-tenant-id':actor.tenantId}});
    expect(await authenticate(await req(await signed()))).toEqual(actor);
    expect(await authenticate(await req(await signed({scope:'supportv8:voice:read'})))).toBeNull();
    expect(await authenticate(await req(await signed({account_id:'other'})))).toBeNull();
    expect(await authenticate(await req(await signed({azp:'other'})))).toBeNull();
  });
});
