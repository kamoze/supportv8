import {it,expect} from 'vitest';
import {boundedJson} from '../../src/lib/tasksv8/http';
it('aborts a hanging response body without awaiting an uncooperative cancel',async()=>{let cancels=0;const stream=new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>{cancels++;return new Promise(()=>{});}});await expect(boundedJson(new Response(stream),1024,AbortSignal.timeout(20))).rejects.toThrow();expect(cancels).toBeGreaterThan(0);},1000);
it('bounds an inbound request body by its abort signal',async()=>{const request=new Request('https://tasks.example',{method:'POST',body:new ReadableStream({pull:()=>new Promise(()=>{})}),duplex:'half',signal:AbortSignal.timeout(20)} as RequestInit);await expect(boundedJson(request,1024)).rejects.toThrow();},1000);
it('rejects a response that exceeds the byte cap',async()=>{await expect(boundedJson(new Response('x'.repeat(100)),10)).rejects.toThrow('payload_too_large');});
