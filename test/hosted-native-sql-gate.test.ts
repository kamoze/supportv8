import {it,expect} from 'vitest';
import {existsSync,readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateOperationalSqlReport,requireOperationalSqlFixture} from '../scripts/test-operational-sql-ci.mjs';
const report=()=>({success:true,numTotalTests:23,numPassedTests:23,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[{name:'/work/test/operational-outbox.postgres.test.ts',status:'passed',message:'',assertionResults:Array.from({length:23},(_,i)=>({fullName:`Support native transactional operational outbox case ${i}`,status:'passed',failureMessages:[]}))}]});
it('accepts only a successful complete native23 report',()=>{const dir=mkdtempSync(join(tmpdir(),'support-ci-gate-'));try{const file=join(dir,'report.json');writeFileSync(file,JSON.stringify(report()));expect(()=>validateOperationalSqlReport(file,0)).not.toThrow();expect(()=>validateOperationalSqlReport(file,1)).toThrow();expect(()=>validateOperationalSqlReport(join(dir,'missing.json'),0)).toThrow();}finally{rmSync(dir,{recursive:true});}});
it.each(['zero','skipped','duplicate','wrong-file','failed-hook','missing-assertions','malformed'])('rejects an invalid required native report: %s',kind=>{const dir=mkdtempSync(join(tmpdir(),'support-ci-gate-'));try{const value=report();if(kind==='zero')value.numTotalTests=0;if(kind==='skipped')value.testResults[0].assertionResults[0].status='pending';if(kind==='duplicate')value.testResults[0].assertionResults[1].fullName=value.testResults[0].assertionResults[0].fullName;if(kind==='wrong-file')value.testResults[0].name='/work/test/other.test.ts';if(kind==='failed-hook')value.testResults[0].status='failed';if(kind==='missing-assertions')value.testResults[0].assertionResults=[];const file=join(dir,'report.json');writeFileSync(file,kind==='malformed'?'not json':JSON.stringify(value));expect(()=>validateOperationalSqlReport(file,0)).toThrow();}finally{rmSync(dir,{recursive:true});}});
it('requires an explicit owned loopback admin fixture before any runner dispatch',()=>{expect(()=>requireOperationalSqlFixture(undefined)).toThrow('operational_sql_ci_fixture_required');expect(()=>requireOperationalSqlFixture('postgresql://postgres@production.invalid:5432/postgres')).toThrow();expect(()=>requireOperationalSqlFixture('postgresql://postgres:synthetic@127.0.0.1:5432/postgres')).not.toThrow();const child=spawnSync(process.execPath,['scripts/test-operational-sql-ci.mjs'],{env:{PATH:process.env.PATH!,NODE_ENV:'test'},encoding:'utf8'});expect(child.status).not.toBe(0);expect(child.stderr).toContain('operational_sql_ci_fixture_required');});
it.each(['.circleci/config.yml'])('requires guarded units/native tests and native23 before role-creating migrations: %s',file=>{const text=readFileSync(file,'utf8');expect(text).not.toMatch(/npx\s+vitest|node_modules\/vitest/);expect(text).toContain('node scripts/test-local-only.mjs');const gate=text.indexOf('node scripts/test-operational-sql-ci.mjs');expect(gate).toBeGreaterThan(0);expect(gate).toBeLessThan(text.indexOf('Rehearse Runtime Support workspace migration'));expect(text.slice(gate,text.indexOf('Rehearse Runtime Support workspace migration'))).toContain('SUPPORT_OPERATIONAL_TEST_ADMIN_URL: postgresql://postgres:support-workspace-test@127.0.0.1:5432/postgres');});
it('keeps all PR validation in CircleCI and deployment limited to main/master',()=>{
  expect(existsSync('.github/workflows/ci.yml')).toBe(false);
  const workflow=readFileSync('.circleci/config.yml','utf8');
  const jobs=workflow.slice(workflow.indexOf('workflows:'));
  const validation=jobs.slice(jobs.indexOf('      - build:'),jobs.indexOf('      - push-image:'));
  expect(validation).not.toContain('filters:');expect(validation).not.toContain('context:');
  for(const name of ['push-image','update-devops']) expect(jobs.split('      - '+name+':')[1].split('\n      - ')[0]).toContain('only:\n                - main\n                - master');
  for(const name of ['action-gateway-writeback','interaction-ingress','mvp-intelligence-projections','retention-policy','support-intelligence-repository']) expect(workflow).toContain('test/'+name+'.postgres.test.ts');
});
it('uses matching trust only in the disposable CircleCI PostgreSQL service',()=>{
  const workflow=readFileSync('.circleci/config.yml','utf8');
  const postgres=workflow.match(/      - image: postgres:17-alpine\n([\s\S]*?)\n    steps:/)?.[1];
  expect(postgres).toBeDefined();
  expect(postgres).toMatch(/environment:\n(?: {10}[^\n]+\n)* {10}POSTGRES_HOST_AUTH_METHOD: trust(?:\n|$)/);
});
