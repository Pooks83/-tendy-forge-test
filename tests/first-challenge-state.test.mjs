import test from 'node:test';
import assert from 'node:assert/strict';

const flow=await import('../lib/first-challenge-state.mjs').catch(()=>({}));

test('first value follows welcome challenge win and Today without a tutorial carousel',()=>{
 assert.equal(typeof flow.firstValueReducer,'function');
 let state=flow.initialFirstValueState();
 assert.equal(state.step,'goalie-welcome');
 state=flow.firstValueReducer(state,{type:'WELCOME_CONTINUED'});
 assert.equal(state.step,'first-challenge');
 state=flow.firstValueReducer(state,{type:'CHALLENGE_STARTED'});
 assert.equal(state.step,'challenge-active');
 state=flow.firstValueReducer(state,{type:'CHALLENGE_COMPLETED'});
 assert.equal(state.step,'first-win');
 state=flow.firstValueReducer(state,{type:'WIN_CONTINUED'});
 assert.equal(state.step,'first-today');
});

test('challenge countdown never becomes negative and completion cannot be inferred early',()=>{
 let state={...flow.initialFirstValueState(),step:'challenge-active',remaining:60};
 state=flow.firstValueReducer(state,{type:'TICK',seconds:59});
 assert.equal(state.remaining,1);
 assert.equal(state.step,'challenge-active');
 state=flow.firstValueReducer(state,{type:'TICK',seconds:2});
 assert.equal(state.remaining,0);
 assert.equal(state.step,'challenge-active');
});

test('retry preserves the challenge operation keys',()=>{
 const state=flow.initialFirstValueState('start-key','complete-key');
 const failed=flow.firstValueReducer(state,{type:'FAILED',message:'Try again'});
 assert.equal(failed.startOperationKey,'start-key');
 assert.equal(failed.completeOperationKey,'complete-key');
});

test('reload resumes an active challenge and sends completed players to Today',()=>{
 const initial=flow.initialFirstValueState('start-key','complete-key');
 const active=flow.firstValueReducer(initial,{type:'HYDRATE',status:'active',remainingSeconds:17});
 assert.equal(active.step,'challenge-active');
 assert.equal(active.remaining,17);
 const complete=flow.firstValueReducer(initial,{type:'HYDRATE',status:'completed'});
 assert.equal(complete.step,'first-today');
});

test('safety stop exits the active challenge into an adult recovery path',()=>{
 const initial={...flow.initialFirstValueState(),step:'challenge-active'};
 const stopped=flow.firstValueReducer(initial,{type:'SAFETY_STOPPED'});
 assert.equal(stopped.step,'safety-stopped');
});

test('server projection is authoritative for every first-value status',()=>{
 const now=new Date('2026-09-11T12:01:00.000Z');
 assert.deepEqual(flow.resolveFirstValueStatus(null,false,now),{
  status:'not-started',protocolVersion:'tf-first-ready-v1',
 });
 assert.deepEqual(flow.resolveFirstValueStatus({status:'active',protocol_version:'tf-first-ready-v1',started_at:'2026-09-11T12:00:43.000Z'},false,now),{
  status:'active',protocolVersion:'tf-first-ready-v1',remainingSeconds:43,canComplete:false,
 });
 assert.deepEqual(flow.resolveFirstValueStatus({status:'active',protocol_version:'tf-first-ready-v1',started_at:'2026-09-11T11:59:59.000Z'},false,now),{
  status:'active',protocolVersion:'tf-first-ready-v1',remainingSeconds:0,canComplete:true,
 });
 assert.deepEqual(flow.resolveFirstValueStatus({status:'completed',protocol_version:'tf-first-ready-v1',started_at:'2026-09-11T11:59:00.000Z',result_json:'{"completedSeconds":60,"claim":"completed"}'},false,now),{
  status:'completed',protocolVersion:'tf-first-ready-v1',result:{completedSeconds:60,claim:'completed'},
 });
 assert.deepEqual(flow.resolveFirstValueStatus({status:'active',protocol_version:'tf-first-ready-v1',started_at:'2026-09-11T12:00:43.000Z'},true,now),{
  status:'safety-stopped',protocolVersion:'tf-first-ready-v1',recovery:'adult-required',
 });
});

test('server projection rejects corrupt or unknown persisted state',()=>{
 assert.throws(()=>flow.resolveFirstValueStatus({status:'mystery',protocol_version:'tf-first-ready-v1',started_at:'2026-09-11T12:00:00.000Z'},false,new Date()),/Invalid first challenge status/);
 assert.throws(()=>flow.resolveFirstValueStatus({status:'active',protocol_version:'tf-first-ready-v1',started_at:'not-a-date'},false,new Date()),/Invalid first challenge start time/);
});
