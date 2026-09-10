import {randomUUID} from 'node:crypto';
import {pgClient} from '@/lib/db/pg-client';
import type {VoiceDomainStore} from '@/lib/voice/voice-domain';

export const supportVoiceStore:VoiceDomainStore={
  tenant:id=>pgClient.withTenantSession(id,async db=>(await db.query<{id:string;domain:string;servicev8_account_id:string|null}>(
    `SELECT id,domain,servicev8_account_id FROM supportv8.tenants WHERE id=$1`,[id]))[0]).then(row=>row?{id:row.id,domain:row.domain,servicev8AccountId:row.servicev8_account_id}:null),
  ticket:(tenantId,reference)=>pgClient.withTenantSession(tenantId,async db=>{
    const row=(await db.query<{tenant_id:string;external_id:string;source_status:string;priority:string}>(
      `SELECT tenant_id,external_id,source_status,priority FROM supportv8.issues WHERE external_id=$1 OR id=$1 LIMIT 1`,[reference]))[0];
    return row?{tenantId:row.tenant_id,reference:row.external_id,status:row.source_status,priority:row.priority}:null;}),
  knowledge:(tenantId,query)=>pgClient.withTenantSession(tenantId,async db=>(await db.query<{title:string;summary:string;url:string|null}>(
    `SELECT title,summary,url FROM supportv8.knowledge_articles WHERE status='active' AND (title ILIKE $1 OR summary ILIKE $1 OR content ILIKE $1) ORDER BY usage_count DESC,last_updated DESC LIMIT 5`,[`%${query}%`]))),
  createTicket:input=>pgClient.withTenantSession(input.tenantId,async db=>{
    await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2 || ':' || $3,0))`,[input.tenantId,input.sessionId,input.toolCallId]);
    const prior=(await db.query<{result_reference:string}>(`SELECT result_reference FROM supportv8.voice_tool_effects WHERE session_id=$1 AND tool_call_id=$2 AND operation='support_ticket_create'`,[input.sessionId,input.toolCallId]))[0];
    if(prior)return {tenantId:input.tenantId,reference:prior.result_reference,status:'open'};
    const suffix=randomUUID().replace(/-/g,'').slice(0,12).toUpperCase(),id=`iss_voice_${suffix.toLowerCase()}`,reference=`SV8-VOICE-${suffix}`;
    await db.query(`INSERT INTO supportv8.issues (id,tenant_id,source,external_id,source_url,customer_ref,customer_name,summary,category,product,version,sentiment,priority,business_impact,resolution_risk_score,source_status,tags,recommended_action)
      VALUES ($1,$2,'twilio_voice',$3,$4,$5,$6,$7,'voice_support','SupportV8 Voice','1.0','neutral',$8,'medium',0.3,'open',ARRAY['voice','sophia'],'Created by the authorized Sophia voice workflow.')`,
      [id,input.tenantId,reference,`https://support.servicev8.com/tickets/${reference}`,`voice_${input.sessionId}`.slice(0,128),input.customerName,input.summary,input.priority]);
    await db.query(`INSERT INTO supportv8.voice_tool_effects (tenant_id,session_id,tool_call_id,hire_id,installation_id,operation,result_reference) VALUES ($1,$2,$3,$4,$5,'support_ticket_create',$6)`,
      [input.tenantId,input.sessionId,input.toolCallId,input.hireId,input.installationId,reference]);return {tenantId:input.tenantId,reference,status:'open'};}),
  escalate:input=>pgClient.withTenantSession(input.tenantId,async db=>{
    await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2 || ':' || $3,0))`,[input.tenantId,input.sessionId,input.toolCallId]);
    const prior=(await db.query<{result_reference:string}>(`SELECT result_reference FROM supportv8.voice_tool_effects WHERE session_id=$1 AND tool_call_id=$2 AND operation='support_escalation_create'`,[input.sessionId,input.toolCallId]))[0];
    if(prior)return {tenantId:input.tenantId,reference:prior.result_reference,status:'escalated'};
    const rows=await db.query<{tenant_id:string;external_id:string}>(`UPDATE supportv8.issues SET source_status='escalated',priority=CASE WHEN $2='urgent' THEN 'urgent' ELSE priority END,
      timeline=timeline || jsonb_build_array(jsonb_build_object('timestamp',now(),'action','Escalated by Sophia','details',$3)),updated_at=now()
      WHERE external_id=$1 OR id=$1 RETURNING tenant_id,external_id`,[input.ticketReference,input.urgency,input.reason]);
    const row=rows[0];if(!row)return null;
    await db.query(`INSERT INTO supportv8.voice_tool_effects (tenant_id,session_id,tool_call_id,hire_id,installation_id,operation,result_reference) VALUES ($1,$2,$3,$4,$5,'support_escalation_create',$6)`,
      [input.tenantId,input.sessionId,input.toolCallId,input.hireId,input.installationId,row.external_id]);return {tenantId:row.tenant_id,reference:row.external_id,status:'escalated'};}),
};
