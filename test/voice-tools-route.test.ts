import {beforeEach,describe,expect,it,vi} from 'vitest';

const state=vi.hoisted(()=>({queries:[] as string[],effect:undefined as string|undefined,creates:0,escalations:0}));
vi.mock('@/lib/db/pg-client',()=>({pgClient:{withTenantSession:vi.fn(async (_tenantId:string,callback:(db:{query:(sql:string,params?:unknown[])=>Promise<unknown[]>})=>Promise<unknown>)=>callback({
  query:async(sql:string,params:unknown[]=[]):Promise<unknown[]>=>{
    state.queries.push(sql);
    if(sql.includes('pg_advisory_xact_lock'))return [];
    if(sql.includes('SELECT result_reference'))return state.effect?[{result_reference:state.effect}]:[];
    if(sql.includes('INSERT INTO supportv8.issues')){state.creates+=1;return [];}
    if(sql.includes('UPDATE supportv8.issues')){state.escalations+=1;return [{tenant_id:'tenant_acme',external_id:'SV8-42'}];}
    if(sql.includes('INSERT INTO supportv8.voice_tool_effects')){state.effect=String(params.at(-1));return [];}
    return [];
  },
}))}}));

import {supportVoiceStore} from '@/lib/voice/support-voice-store';

const common={tenantId:'tenant_acme',hireId:'hire-a',installationId:'inst-a',sessionId:'session-a',toolCallId:'tool-a'};

describe('SupportV8 voice tool effect idempotency',()=>{
  beforeEach(()=>{state.queries=[];state.effect=undefined;state.creates=0;state.escalations=0;});

  it('serializes duplicate ticket creation and returns the first result',async()=>{
    const input={...common,customerName:'Sam',summary:'Cannot sign in',priority:'high'};
    const first=await supportVoiceStore.createTicket(input);const second=await supportVoiceStore.createTicket(input);
    expect(second).toEqual(first);expect(state.creates).toBe(1);
    expect(state.queries.filter(sql=>sql.includes('pg_advisory_xact_lock'))).toHaveLength(2);
  });

  it('does not append a second escalation timeline entry on a retried tool call',async()=>{
    const input={...common,ticketReference:'SV8-42',reason:'Customer requested a person',urgency:'urgent'};
    await supportVoiceStore.escalate(input);await supportVoiceStore.escalate(input);
    expect(state.escalations).toBe(1);
    expect(state.queries.filter(sql=>sql.includes('pg_advisory_xact_lock'))).toHaveLength(2);
  });
});
