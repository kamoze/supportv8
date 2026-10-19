import {it,expect} from 'vitest';
import {Pool} from 'pg';
import {Duplex} from 'node:stream';
import {OperationalPgClient} from '@/lib/db/operational-sql-budget';
import {OperationalOutboxStore} from '@/lib/signals/operational-outbox';
import {PostgresClient,type DatabasePool} from '@/lib/db/pg-client';
import {currentLocalSource} from '@/lib/signals/operational-source';
import {target} from './operational-fixtures';
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function blockedPool(){let reject:(e:Error)=>void=()=>{};let freed=false;let destroyed=0;const queries:string[]=[];const pending=new Promise<any>((_resolve,r)=>reject=r);const client={query:async(sql:any)=>{const text=typeof sql==='string'?sql:sql.text;queries.push(text);if(text.includes('claim_operational_outbox')||text.includes('from supportv8.runtime_support_workspaces'))return pending;return {rows:[]};},release:(destroy?:boolean)=>{freed=true;if(destroy){destroyed++;reject(Error('connection destroyed'));}}};return {client,queries,pool:{connect:async()=>client,query:()=>pending,totalCount:0,idleCount:0,waitingCount:0,options:{max:4}},get freed(){return freed;},get destroyed(){return destroyed;},unblock:()=>reject(Error('test teardown'))};}
it('settles an actual awaited claim by deadline and destroys its blocked client',async()=>{const fixture=blockedPool();const store=new OperationalOutboxStore(fixture.pool as unknown as Pool);const task=(store as any).claim('worker',1,{deadline:Date.now()+40});const result=await Promise.race([task.then(()=> 'success',()=> 'rejected'),delay(160).then(()=> 'still_pending')]);fixture.unblock();await task.catch(()=>{});expect(result).toBe('rejected');expect(fixture.destroyed).toBe(1);expect(fixture.freed).toBe(true);});
it('aborts the optional local-source SQL branch without altering native transaction defaults',async()=>{const fixture=blockedPool();const client=new PostgresClient(undefined,fixture.pool as unknown as DatabasePool);const task=(currentLocalSource as any)(target,client,{deadline:Date.now()+40});const result=await Promise.race([task.then(()=> 'success',()=> 'rejected'),delay(160).then(()=> 'still_pending')]);fixture.unblock();await task.catch(()=>{});expect(result).toBe('rejected');expect(fixture.destroyed).toBe(1);});
it('rejects exhausted or fully reserved pools before another acquisition is queued',async()=>{for(const state of [{totalCount:1,idleCount:0,waitingCount:0,max:1},{totalCount:1,idleCount:1,waitingCount:1,max:4},{totalCount:1,idleCount:0,waitingCount:1,max:4}]){let connections=0;const pool={...state,options:{max:state.max},connect:async()=>{connections++;throw Error('unexpected connect');},query:async()=>{throw Error('old direct query');}};const store=new OperationalOutboxStore(pool as unknown as Pool);await expect((store as any).claim('worker',1,{deadline:Date.now()+40})).rejects.toThrow('operational_sql_pool_busy');expect(connections).toBe(0);}});
it('destroys a delayed checkout after its caller has already expired, without issuing SQL',async()=>{let destroyed=0,queries=0;let checkout:(value:any)=>void=()=>{};const pending=new Promise<any>(resolve=>checkout=resolve);const pool={connect:()=>pending,options:{max:1},totalCount:0,idleCount:0,waitingCount:0};const store=new OperationalOutboxStore(pool as unknown as Pool);await expect(store.claim('late',1,{deadline:Date.now()+20})).rejects.toThrow('operational_sql_deadline');checkout({release:(destroy:boolean)=>{if(destroy)destroyed++;},query:async()=>{queries++;return {rows:[]};}});await delay(5);expect(destroyed).toBe(1);expect(queries).toBe(0);});
it('propagates explicit cancellation to the borrowed SQL client before the wall-clock budget',async()=>{const fixture=blockedPool(),controller=new AbortController();const store=new OperationalOutboxStore(fixture.pool as unknown as Pool);const task=store.claim('cancel',1,{deadline:Date.now()+500,signal:controller.signal});await delay(5);controller.abort();await expect(task).rejects.toThrow('connection destroyed');expect(fixture.destroyed).toBe(1);});
it('keeps the ordinary native provisioning transaction path and its 15s local limit unchanged',async()=>{const calls:any[]=[];let destroyed=0;const pool={connect:async()=>({query:async(...args:any[])=>{calls.push(args);return {rows:[]};},release:(destroy?:boolean)=>{if(destroy)destroyed++;}})};const client=new PostgresClient(undefined,pool as unknown as DatabasePool);await client.withWorkspaceProvisioningSession({tenantId:'tenant_native_a',accountId:'account-a',registryTenantId:'registry-a'},db=>db.query('select 1'));expect(calls.some(([text,values])=>typeof text==='string'&&text.includes("set_config('statement_timeout'")&&values?.[0]==='15s')).toBe(true);expect(calls[0]).toEqual(['BEGIN']);expect(calls.at(-1)).toEqual(['COMMIT']);expect(destroyed).toBe(0);});

class SilentHandshakeStream extends Duplex {
  setNoDelay(){return this;}
  setKeepAlive(){return this;}
  connect(){queueMicrotask(()=>this.emit('connect'));return this;}
  _read(){}
  _write(_chunk:unknown,_encoding:unknown,callback:(error?:Error)=>void){callback();}
}
it.each(['deadline','abort'])('cancels a real pg driver connection waiting for handshake: %s',async mode=>{
  const socket=new SilentHandshakeStream();
  const pool=new Pool({Client:OperationalPgClient,stream:()=>socket,connectionTimeoutMillis:5000,max:1,user:'synthetic',database:'synthetic'});
  const controller=new AbortController();
  const store=new OperationalOutboxStore(pool);
  const started=Date.now();
  const pending=store.claim('handshake',1,{deadline:Date.now()+(mode==='deadline'?40:2000),signal:controller.signal});
  if(mode==='abort'){await delay(5);controller.abort();}
  try{await expect(pending).rejects.toThrow();await delay(10);expect(Date.now()-started).toBeLessThan(400);expect(socket.destroyed).toBe(true);expect(pool.totalCount).toBe(0);expect(pool.waitingCount).toBe(0);}finally{socket.destroy();await pool.end();}
});
it('does not retain operational connection budgets in later unrelated async work',async()=>{let laterError:unknown,created:OperationalPgClient|undefined;const pool={options:{max:1},totalCount:0,idleCount:0,waitingCount:0,connect:async()=>{setTimeout(()=>{try{created=new OperationalPgClient({connectionTimeoutMillis:5000});}catch(error){laterError=error;}},45);return {query:async()=>({rows:[]}),release:()=>{}};}};await new OperationalOutboxStore(pool as unknown as Pool).claim('completed',1,{deadline:Date.now()+20});await delay(70);expect(laterError).toBeUndefined();expect(created).toBeInstanceOf(OperationalPgClient);await created?.end();});

// Real pg Pool/Client on a synthetic protocol stream: no sockets or server SQL.
class ReadyPgStream extends Duplex {
  private startup=true;
  connect(){queueMicrotask(()=>this.emit('connect'));return this;}
  setNoDelay(){return this;} setKeepAlive(){return this;} ref(){return this;} unref(){return this;}
  _read(){}
  _write(chunk:Buffer,_encoding:string,done:()=>void){
    const first=this.startup;this.startup=false;done();
    queueMicrotask(()=>{
      if(this.destroyed)return;
      const ready=()=>this.push(Buffer.from([90,0,0,0,5,73]));
      const complete=()=>{const command=Buffer.from('SELECT 0\0');const header=Buffer.alloc(5);header[0]=67;header.writeInt32BE(command.length+4,1);this.push(Buffer.concat([header,command]));};
      if(first){this.push(Buffer.from([82,0,0,0,8,0,0,0,0]));ready();return;}
      for(let offset=0;offset<chunk.length;){const type=chunk[offset],length=chunk.readInt32BE(offset+1);offset+=length+1;
        if(type===80)this.push(Buffer.from([49,0,0,0,4])); // ParseComplete
        else if(type===66)this.push(Buffer.from([50,0,0,0,4])); // BindComplete
        else if(type===68)this.push(Buffer.from([110,0,0,0,4])); // NoData
        else if(type===69)complete();
        else if(type===83)ready();
        else if(type===81){complete();ready();}
      }
    });
  }
}
it('serves concurrent reserved idle pg clients without accepting an exhausted checkout',async()=>{
  const pool=new Pool({Client:OperationalPgClient,max:4,connectionTimeoutMillis:100,stream:()=>new ReadyPgStream()} as any);
  const held=await Promise.all(Array.from({length:4},()=>pool.connect()));held.forEach(client=>client.release());
  expect(pool.idleCount).toBe(4);
  const store=new OperationalOutboxStore(pool);
  const tasks=Array.from({length:4},()=>store.claim('idle-concurrent',1));
  await expect(store.claim('no-idle-capacity',1)).rejects.toThrow('operational_sql_pool_busy');
  const outcomes=await Promise.allSettled(tasks);
  try{expect(outcomes.map(result=>result.status)).toEqual(Array(4).fill('fulfilled'));expect(pool.waitingCount).toBe(0);expect(pool.idleCount).toBe(4);}
  finally{await pool.end();}
});
