import {randomUUID} from 'node:crypto';
import {pgClient} from '@/lib/db/pg-client';

export type OrderHandoffInput = {tenantId:string;caseRef:string;objectiveId:string;installationId:string;hireId:string;responseDueAt:string;nextStep:string;knowledgeTitle?:string};
export type OrderHandoffResult = {ticketReference:string;receiptRef:string;owner:'Sophia';nextStep:string;knowledgeTitle?:string};

export const orderHandoffStore = {
  tenant: (id:string) => pgClient.withTenantSession(id,async db => {
    const row=(await db.query<{id:string;domain:string;servicev8_account_id:string|null}>(`SELECT id,domain,servicev8_account_id FROM supportv8.tenants WHERE id=$1`,[id]))[0];
    return row?{id:row.id,domain:row.domain,servicev8AccountId:row.servicev8_account_id}:null;
  }),
  knowledge: (tenantId:string) => pgClient.withTenantSession(tenantId,async db => {
    return db.query<{title:string;summary:string;url:string|null}>(`SELECT title,summary,url FROM supportv8.knowledge_articles WHERE status='active' AND (title ILIKE $1 OR summary ILIKE $1 OR content ILIKE $1) ORDER BY usage_count DESC,last_updated DESC LIMIT 5`,['%delayed order%']);
  }),
  get: (tenantId:string,caseRef:string) => pgClient.withTenantSession(tenantId,async db => {
    const row=(await db.query<{objective_id:string;installation_id:string;hire_id:string;ticket_reference:string;receipt_ref:string;next_step:string;knowledge_title:string|null}>(`SELECT objective_id,installation_id,hire_id,ticket_reference,receipt_ref,next_step,knowledge_title FROM supportv8.runtime_order_handoffs WHERE tenant_id=$1 AND case_ref=$2`,[tenantId,caseRef]))[0];
    return row?{objectiveId:row.objective_id,installationId:row.installation_id,hireId:row.hire_id,ticketReference:row.ticket_reference,receiptRef:row.receipt_ref,owner:'Sophia' as const,nextStep:row.next_step,...(row.knowledge_title?{knowledgeTitle:row.knowledge_title}:{})}:null;
  }),
  create: (input:OrderHandoffInput):Promise<OrderHandoffResult> => pgClient.withTenantSession(input.tenantId,async db => {
    await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2,0))`,[input.tenantId,input.caseRef]);
    const prior=(await db.query<{objective_id:string;installation_id:string;hire_id:string;ticket_reference:string;receipt_ref:string;next_step:string;knowledge_title:string|null}>(`SELECT objective_id,installation_id,hire_id,ticket_reference,receipt_ref,next_step,knowledge_title FROM supportv8.runtime_order_handoffs WHERE tenant_id=$1 AND case_ref=$2`,[input.tenantId,input.caseRef]))[0];
    if(prior){
      if(prior.objective_id!==input.objectiveId||prior.installation_id!==input.installationId||prior.hire_id!==input.hireId)throw new Error('order_handoff_conflict');
      return {ticketReference:prior.ticket_reference,receiptRef:prior.receipt_ref,owner:'Sophia' as const,nextStep:prior.next_step,...(prior.knowledge_title?{knowledgeTitle:prior.knowledge_title}:{})};
    }
    const suffix=randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
    const ticketReference=`SV8-ORDER-${suffix}`;
    const receiptRef=`supportv8:order-handoff:${input.caseRef}`;
    const summary=`Triage accepted OrderV8 follow-up ${input.caseRef}. Customer contact remains with OrderV8. Response due ${input.responseDueAt}.`;
    await db.query(`INSERT INTO supportv8.issues (id,tenant_id,source,external_id,source_url,customer_ref,customer_name,summary,category,product,version,sentiment,priority,business_impact,resolution_risk_score,source_status,tags,recommended_action,assigned_agent)
      VALUES ($1,$2,'orderv8_handoff',$3,$4,$5,'OrderV8 customer',$6,'order_follow_up','SupportV8','1.0','neutral','normal','medium',0.3,'open',ARRAY['orderv8','sophia'],$7,'Sophia')`,
      [`iss_order_${suffix.toLowerCase()}`,input.tenantId,ticketReference,`urn:servicev8:orderv8:case:${input.caseRef}`,input.caseRef,summary,input.nextStep]);
    await db.query(`INSERT INTO supportv8.runtime_order_handoffs(tenant_id,case_ref,objective_id,installation_id,hire_id,ticket_reference,receipt_ref,next_step,knowledge_title) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [input.tenantId,input.caseRef,input.objectiveId,input.installationId,input.hireId,ticketReference,receiptRef,input.nextStep,input.knowledgeTitle??null]);
    return {ticketReference,receiptRef,owner:'Sophia' as const,nextStep:input.nextStep,...(input.knowledgeTitle?{knowledgeTitle:input.knowledgeTitle}:{})};
  }),
};
