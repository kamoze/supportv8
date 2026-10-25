/** Bound bytes and wall time, including peers that stop streaming or never cancel. */
export async function boundedJson(input:Request|Response,max=65536,parent?:AbortSignal):Promise<unknown>{
 const signal=AbortSignal.any([parent??(input instanceof Request?input.signal:new AbortController().signal),AbortSignal.timeout(5000)]);
 signal.throwIfAborted();const reader=input.body?.getReader();if(!reader)throw Error('invalid_json');
 let abort!:()=>void;const interrupted=new Promise<never>((_,reject)=>{abort=()=>{reject(signal.reason??Error('body_aborted'));void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const next=await Promise.race([reader.read(),interrupted]);signal.throwIfAborted();if(next.done)break;size+=next.value.byteLength;if(size>max)throw Error('payload_too_large');chunks.push(next.value);}return JSON.parse(Buffer.concat(chunks,size).toString('utf8')) as unknown;}
 finally{signal.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
