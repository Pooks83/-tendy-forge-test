import test from 'node:test';
import assert from 'node:assert/strict';
import {sendMissionMutation} from '../lib/mission-request.mjs';

const item={operationKey:'mission-key',body:{action:'pause'}};

test('mission request marks network and server failures retryable',async()=>{
 await assert.rejects(()=>sendMissionMutation(async()=>{throw new TypeError('network')},item),error=>error.retryable===true&&error.code==='NETWORK_RETRYABLE');
 await assert.rejects(()=>sendMissionMutation(async()=>new Response(JSON.stringify({error:{code:'INTERNAL_RETRYABLE',message:'Try again'}}),{status:503}),item),error=>error.retryable===true&&error.status===503);
});

test('mission request preserves canonical conflict details and successful projection',async()=>{
 await assert.rejects(()=>sendMissionMutation(async()=>new Response(JSON.stringify({error:{code:'STALE_REVISION',message:'Reload progress'}}),{status:409}),item),error=>error.retryable===false&&error.code==='STALE_REVISION'&&error.message==='Reload progress');
 const projection={missionId:'m1',revision:4};
 assert.deepEqual(await sendMissionMutation(async(_url,init)=>{assert.equal(init.headers['Idempotency-Key'],'mission-key');return new Response(JSON.stringify(projection),{status:200});},item),projection);
});
