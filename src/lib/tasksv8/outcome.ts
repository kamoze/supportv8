import { exact,identifier,taskWorkUuid } from './contract';
const text=(v:unknown,max=10000):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const timestamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v));
/** Validate the unchanged work-outcome.v1 wire contract before persistence. */
export function validTaskWorkOutcome(v:unknown):boolean {
 if(!exact(v,['specversion','id','source','type','time','datacontenttype','data'])||v.specversion!=='1.0'||!identifier(v.id)||v.source!=='urn:servicev8:tasksv8'||v.type!=='servicev8.work-outcome.v1'||!timestamp(v.time)||v.datacontenttype!=='application/json')return false;
 const d=v.data;if(!exact(d,['schema','eventId','workId','projectId','acceptedSpecVersion','acceptedBy','acceptedAt','outcomeSummary','sourceReferences','execution','verification','artifacts','correlationId'])||d.schema!=='servicev8.work-outcome.v1'||d.eventId!==v.id||!['workId','projectId','acceptedBy','correlationId'].every(k=>identifier(d[k]))||!Number.isSafeInteger(d.acceptedSpecVersion)||Number(d.acceptedSpecVersion)<1||!timestamp(d.acceptedAt)||!text(d.outcomeSummary))return false;
 const refs=d.sourceReferences;if(!Array.isArray(refs)||refs.length<1||refs.length>100||!refs.every(r=>(exact(r,['system','recordId'])||exact(r,['system','recordId','uri']))&&identifier(r.system)&&identifier(r.recordId)&&(r.uri===undefined||text(r.uri,2048))))return false;
 const ex=d.execution;if(!exact(ex,['dispatchId','runId','state'])||!identifier(ex.dispatchId)||!identifier(ex.runId)||ex.state!=='succeeded')return false;
 const verification=d.verification;if(!Array.isArray(verification)||!verification.length||verification.length!==1||!verification.every(r=>exact(r,['system','receiptId','result','evidenceUris'])&&r.system==='tasks-human-verification'&&taskWorkUuid(r.receiptId)&&r.result==='passed'&&Array.isArray(r.evidenceUris)&&r.evidenceUris.length>=1&&r.evidenceUris.length<=100&&r.evidenceUris.every(u=>text(u,2048))))return false;
 const artifacts=d.artifacts;return Array.isArray(artifacts)&&artifacts.length<=100&&artifacts.every(a=>exact(a,['artifactId','uri','sha256'])&&identifier(a.artifactId)&&text(a.uri,2048)&&typeof a.sha256==='string'&&/^[a-f0-9]{64}$/.test(a.sha256)&&!/^0+$/.test(a.sha256));
}
