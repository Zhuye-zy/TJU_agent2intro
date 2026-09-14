import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../../frontend/src/transport/api.ts';
test('JSON transport preserves upstream error and hides invalid body',async()=>{
 const saved=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{code:'NOT_CONFIGURED'}}),{status:503});
  await assert.rejects(api('/maps/config'),(e:any)=>e.error.code==='NOT_CONFIGURED');
  globalThis.fetch=async()=>new Response('<html>private upstream diagnostics</html>',{status:502});
  await assert.rejects(api('/maps/config'),(e:any)=>e.error.code==='UPSTREAM_PROTOCOL_ERROR'&&!JSON.stringify(e).includes('private'));
 }finally{globalThis.fetch=saved;}
});
test('timeout covers headers and response JSON; external cancellation remains cancellation',async()=>{
 const savedFetch=globalThis.fetch,savedTimer=globalThis.setTimeout;
 try{
  globalThis.setTimeout=((fn:any)=>savedTimer(fn,5)) as typeof setTimeout;
  globalThis.fetch=async(_url,options)=>new Promise((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(options!.signal!.reason)));
  await assert.rejects(api('/health'),(e:any)=>e.error.code==='TRANSPORT_TIMEOUT');
  const external=new AbortController();const pending=api('/health',{signal:external.signal});external.abort(new Error('explicit-cancel'));
  await assert.rejects(pending,{message:'explicit-cancel'});
  globalThis.fetch=async(_url,options)=>({ok:true,json:()=>new Promise((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(options!.signal!.reason)))}) as Response;
  await assert.rejects(api('/health'),(e:any)=>e.error.code==='TRANSPORT_TIMEOUT');
 }finally{globalThis.fetch=savedFetch;globalThis.setTimeout=savedTimer;}
});
