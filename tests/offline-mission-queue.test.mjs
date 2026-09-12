import test from 'node:test';
import assert from 'node:assert/strict';

const offline=await import('../lib/offline-mission-queue.mjs').catch(()=>({}));
const baseActivity={key:'warm',ordinal:0,status:'in-progress',result:null,requiredSets:2,restSeconds:30,restRemainingSeconds:0,restCompletedAfterSet:0};
const mission=overrides=>({id:'instance-1',missionId:'foundation:0:0',profileContextId:'player-1',status:'in-progress',revision:2,currentActivityIndex:0,contentVersion:'tf-curriculum-v1',activities:[baseActivity],executionSnapshot:{id:'foundation:0:0',blocks:[{id:'warm',sets:2,restSeconds:30}]},...overrides});

test('offline queue stores only allowlisted pseudonymous mutation data',()=>{
 const item=offline.createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');
 const raw=offline.serializeOfflineQueue([item]);
 assert.deepEqual(offline.restoreOfflineQueue(raw),[item]);
 assert.doesNotMatch(raw,/nickname|email|note|consent|media/i);
 assert.deepEqual(offline.restoreOfflineQueue(JSON.stringify([{...item,nickname:'Private child'}])),[]);
});

test('safety stops replay before ordinary progress and never cross player context',()=>{
 const progress=offline.createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');
 const stop=offline.createOfflineMutation(mission(),'safety-stop',{},'2026-09-12T00:00:01.000Z');
 const queue=offline.enqueueOfflineMutation(offline.enqueueOfflineMutation([],progress),stop);
 assert.equal(offline.nextOfflineMutation(queue,'player-1').body.action,'safety-stop');
 assert.equal(offline.nextOfflineMutation(queue,'player-2'),null);
 assert.equal(offline.enqueueOfflineMutation(queue,stop).length,2,'same idempotency key is never duplicated');
});

test('optimistic offline state survives an ordered set rest and resume sequence',()=>{
 let current=mission();
 const set=offline.createOfflineMutation(current,'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');
 current=offline.applyOfflineMutation(current,set);
 assert.deepEqual(current.activities[0].result,{completedSets:1,usedEasierVersion:false});
 const rest=offline.createOfflineMutation(current,'start-rest',{activityKey:'warm'},'2026-09-12T00:00:01.000Z');
 current=offline.applyOfflineMutation(current,rest);
 assert.equal(current.activities[0].status,'resting');assert.equal(current.activities[0].restRemainingSeconds,30);
 const pause=offline.createOfflineMutation(current,'pause',{},'2026-09-12T00:00:02.000Z');
 current=offline.applyOfflineMutation(current,pause);
 assert.equal(current.status,'paused');
 const restored=offline.restoreOfflineQueue(offline.serializeOfflineQueue([set,rest,pause]));
 assert.deepEqual(restored.map(item=>item.operationKey),[set.operationKey,rest.operationKey,pause.operationKey]);
 const projected=offline.projectOfflineQueue(mission(),restored);
 assert.equal(projected.status,'paused');assert.equal(projected.activities[0].status,'resting');assert.equal(projected.activities[0].result.completedSets,1);
});

test('conflict classification distinguishes applied safe-retry and adult-review states',()=>{
 const item=offline.createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');
 assert.equal(offline.classifyOfflineConflict(item,mission({revision:4,activities:[{...baseActivity,result:{completedSets:1}}]})),'already-applied');
 assert.equal(offline.classifyOfflineConflict(item,mission({revision:4})),'safe-retry');
 assert.equal(offline.classifyOfflineConflict(item,mission({revision:4,profileContextId:'player-2'})),'adult-review');
 assert.equal(offline.classifyOfflineConflict(item,mission({revision:4,status:'completed'})),'adult-review');
 const rebased=offline.rebaseOfflineMutation(item,mission({revision:4}));
 assert.equal(rebased.body.revision,4);assert.equal(rebased.operationKey,item.operationKey);
});

test('reconciliation applies matching actions in order and retains another goalie context',async()=>{
 const first=offline.createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');
 const other=offline.createOfflineMutation(mission({profileContextId:'player-2'}),'pause',{},'2026-09-12T00:00:01.000Z');
 const sent=[];
 const result=await offline.reconcileOfflineQueue({queue:[first,other],profileContextId:'player-1',send:async item=>{sent.push(item.operationKey);return mission({revision:3,activities:[{...baseActivity,result:{completedSets:1,usedEasierVersion:false}}]});},fetchAuthoritative:async()=>mission()});
 assert.deepEqual(sent,[first.operationKey]);assert.deepEqual(result.queue,[other]);assert.equal(result.status,'other-profile');assert.equal(result.mission.revision,3);
});

test('reconciliation rebases a safe stale action without changing its operation identity',async()=>{
 const item=offline.createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');let calls=0;
 const result=await offline.reconcileOfflineQueue({queue:[item],profileContextId:'player-1',send:async queued=>{calls++;if(calls===1)throw Object.assign(new Error('stale'),{code:'STALE_REVISION',status:409});assert.equal(queued.operationKey,item.operationKey);assert.equal(queued.body.revision,4);return mission({revision:5});},fetchAuthoritative:async()=>mission({revision:4})});
 assert.equal(result.status,'synced');assert.deepEqual(result.queue,[]);assert.equal(calls,2);
});

test('reconciliation keeps retryable and unsafe conflicts for explicit recovery',async()=>{
 const item=offline.createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');
 const pending=await offline.reconcileOfflineQueue({queue:[item],profileContextId:'player-1',send:async()=>{throw Object.assign(new Error('offline'),{retryable:true});},fetchAuthoritative:async()=>mission()});
 assert.equal(pending.status,'pending');assert.deepEqual(pending.queue,[item]);
 const review=await offline.reconcileOfflineQueue({queue:[item],profileContextId:'player-1',send:async()=>{throw Object.assign(new Error('stale'),{code:'STALE_REVISION',status:409});},fetchAuthoritative:async()=>mission({profileContextId:'player-2',revision:9})});
 assert.equal(review.status,'adult-review');assert.deepEqual(review.queue,[item]);
});
