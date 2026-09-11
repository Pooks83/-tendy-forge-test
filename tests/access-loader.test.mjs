import test from 'node:test';
import assert from 'node:assert/strict';

const access=await import('../lib/access-loader.mjs').catch(()=>({}));
const response=(status,data)=>({ok:status>=200&&status<300,status,data});
const read=async value=>{if(!value.ok)throw new Error(value.data?.error||'failed');return value.data;};

test('valid active player loads only the child-safe endpoint',async()=>{
 const calls=[];
 const result=await access.loadInitialAccess(async url=>{calls.push(url);return response(200,{profile:{id:'p1'},training:{}});},read);
 assert.deepEqual(calls,['/api/player']);
 assert.equal(result.kind,'player');
});

test('only missing or unavailable context may fall back to adult profile loading',async()=>{
 for(const status of [403,409]){
  const calls=[];
  const result=await access.loadInitialAccess(async url=>{calls.push(url);return url==='/api/player'?response(status,{}):response(200,{profiles:[]});},read);
  assert.deepEqual(calls,['/api/player','/api/training']);
  assert.equal(result.kind,'adult');
 }
});

test('player endpoint failure never exposes the adult dataset as a fallback',async()=>{
 const calls=[];
 await assert.rejects(()=>access.loadInitialAccess(async url=>{calls.push(url);return response(503,{error:'player unavailable'});},read),/player unavailable/);
 assert.deepEqual(calls,['/api/player']);
});

test('child view state supplies safe empty evidence collections without adult notes',()=>{
 const value=access.buildPlayerViewState({version:2,pathId:'foundation',sets:{}},{version:2,pathId:'foundation',checks:[{note:'default must not leak'}],evaluations:[{note:'default must not leak'}],sessions:[],rests:{},answers:{},safetyStopped:false});
 assert.deepEqual(value.checks,[]);
 assert.deepEqual(value.evaluations,[]);
 assert.equal(JSON.stringify(value).includes('default must not leak'),false);
});
