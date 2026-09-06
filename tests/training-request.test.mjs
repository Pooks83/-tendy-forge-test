import test from 'node:test';
import assert from 'node:assert/strict';
const client=await import('../lib/training-request.mjs').catch(()=>({}));

test('training response keeps useful API errors and handles non-JSON failures',async()=>{
  assert.equal(typeof client.readTrainingResponse,'function');
  await assert.rejects(()=>client.readTrainingResponse(new Response(JSON.stringify({error:'Progress changed on another device.'}),{status:409,headers:{'content-type':'application/json'}})),/Progress changed/);
  await assert.rejects(()=>client.readTrainingResponse(new Response('Bad gateway',{status:502,headers:{'content-type':'text/html'}})),/temporarily unavailable/i);
});

test('training response returns valid successful JSON',async()=>{
  assert.deepEqual(await client.readTrainingResponse(new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}})),{ok:true});
});
