// Required hosted native gate. Vitest still runs through the local-only wrapper.
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export function requireOperationalSqlFixture(raw) {
  if (!raw) throw Error('operational_sql_ci_fixture_required');
  try {
    const url=new URL(raw);
    if (!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||!['5432','55489'].includes(url.port)||url.username!=='postgres'||url.pathname!=='/postgres'||url.search||url.hash) throw Error();
  } catch { throw Error('operational_sql_ci_fixture_invalid'); }
  return raw;
}

export function validateOperationalSqlReport(path,exitCode) {
  const invalid=()=>{throw Error('operational_sql_ci_report_invalid');};
  if (exitCode!==0) invalid();
  let report;try { report=JSON.parse(readFileSync(path,'utf8')); } catch { invalid(); }
  if (report?.success!==true||report.numTotalTests!==23||report.numPassedTests!==23||report.numFailedTests!==0||report.numPendingTests!==0||report.numTodoTests!==0||!Array.isArray(report.testResults)||report.testResults.length!==1) invalid();
  const file=report.testResults[0],cases=file.assertionResults;
  if (typeof file.name!=='string'||!file.name.replaceAll('\\','/').endsWith('/test/operational-outbox.postgres.test.ts')||file.status!=='passed'||file.message!==''||!Array.isArray(cases)||cases.length!==23) invalid();
  if (cases.some(c=>c.status!=='passed'||typeof c.fullName!=='string'||!c.fullName.startsWith('Support native transactional operational outbox ')||!Array.isArray(c.failureMessages)||c.failureMessages.length!==0)||new Set(cases.map(c=>c.fullName)).size!==23) invalid();
}

function main() {
  const fixture=requireOperationalSqlFixture(process.env.SUPPORT_OPERATIONAL_TEST_ADMIN_URL);
  const report=join(mkdtempSync(join(tmpdir(),'support-native-sql-ci-')),'report.json');
  const wrapper=fileURLToPath(new URL('./test-local-only.mjs',import.meta.url));
  console.log(`Required native SQL report: ${report}`);
  const result=spawnSync(process.execPath,[wrapper,'test/operational-outbox.postgres.test.ts','--reporter=default','--reporter=json',`--outputFile=${report}`],{stdio:'inherit',env:{PATH:process.env.PATH,NODE_ENV:'test',CI:'true',SUPPORT_OPERATIONAL_TEST_ADMIN_URL:fixture}});
  // A successful JSON count never overrides a failed hook, runtime error or signal.
  if (result.error||result.signal||result.status===null) throw Error('operational_sql_ci_runner_failed');
  if (result.status!==0) return result.status;
  validateOperationalSqlReport(report,result.status);
  console.log('Required native SQL gate: 23 unique passed, 0 skipped');
  return 0;
}
if (process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try { process.exitCode=main(); } catch(error) { console.error(error.message);process.exitCode=1; }
}
