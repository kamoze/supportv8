import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {it,expect,vi} from "vitest";
it("never serves a cached tenant login and removes the previous page cache",async()=>{
 const handlers:Record<string,Function>={},deleted:string[]=[];
 const match=vi.fn(async()=>new Response('<input type="password">'));
 runInNewContext(readFileSync('public/sw.js','utf8'),{URL,Response,self:{location:{origin:'https://dex.support.servicev8.com'},addEventListener:(name:string,fn:Function)=>handlers[name]=fn,clients:{claim:async()=>{}}},caches:{match,keys:async()=>['supportv8-pwa-v1','supportv8-pwa-v2'],delete:async(name:string)=>{deleted.push(name);}},fetch:async()=>{throw Error('offline');}});
 let pending:Promise<any>=Promise.resolve();handlers.activate({waitUntil:(p:Promise<any>)=>pending=p});await pending;expect(deleted).toEqual(['supportv8-pwa-v1']);
 handlers.fetch({request:{url:'https://dex.support.servicev8.com/?signin=1',method:'GET',mode:'navigate'},respondWith:(p:Promise<any>)=>pending=p});const response=await pending;expect(response.status).toBe(503);expect(await response.text()).not.toContain('<input');expect(match).not.toHaveBeenCalled();
 const respond=vi.fn();for(const path of ['/login','/api/workspace/lookup?workspace=dex','/?_rsc=value']) handlers.fetch({request:{url:'https://dex.support.servicev8.com'+path,method:'GET',mode:'cors'},respondWith:respond});expect(respond).not.toHaveBeenCalled();
});
