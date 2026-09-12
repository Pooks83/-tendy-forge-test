import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionExecution,resolveTodayExecution,transitionMission} from '../lib/mission-state.mjs';
import {createOfflineMutation,enqueueOfflineMutation,hasPendingSafetyStop,nextOfflineMutation,projectOfflineQueue,reconcileOfflineQueue,restoreOfflineQueue,serializeOfflineQueue} from '../lib/offline-mission-queue.mjs';
import {parseTrainingLocation,trainingLocation} from '../lib/training-navigation.mjs';

const activity={key:'warm',ordinal:0,status:'in-progress',result:null,requiredSets:2,restSeconds:30,restRemainingSeconds:0,restCompletedAfterSet:0};
const mission=overrides=>({id:'i1',missionId:'foundation:0:0',profileContextId:'player-1',status:'in-progress',revision:2,currentActivityIndex:0,contentVersion:'tf-curriculum-v1',activities:[activity],executionSnapshot:{id:'foundation:0:0',blocks:[{id:'warm',sets:2,restSeconds:30}]},startedAt:'2026-08-01T00:00:00.000Z',...overrides});

test('GJ-05 pause Back reload process termination and missed time preserve the next action',()=>{
 let state=transitionMission(createMissionExecution({missionId:'foundation:0:0',activityKeys:['warm'],contentVersion:'tf-curriculum-v1'}),{type:'START'},'2026-08-01T00:00:00.000Z');
 state=transitionMission(state,{type:'START_ACTIVITY',activityKey:'warm'},'2026-08-01T00:01:00.000Z');state=transitionMission(state,{type:'PAUSE'},'2026-08-01T00:02:00.000Z');
 assert.deepEqual(resolveTodayExecution({mission:state}),{state:'active-resume',action:'resume-mission'});
 const location=trainingLocation({view:'Today',drill:null});assert.deepEqual(parseTrainingLocation(location.slice(1),['warm'],'player'),{view:'Today',drill:null});
 const queued=createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');
 const afterTermination=restoreOfflineQueue(serializeOfflineQueue([queued]));assert.equal(afterTermination[0].operationKey,queued.operationKey);
 assert.equal(projectOfflineQueue(mission(),afterTermination).activities[0].result.completedSets,1);
});

test('GJ-05 reconnect is idempotent, conflict-aware, and pinned to the original goalie',async()=>{
 const item=createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');let sends=0;
 const result=await reconcileOfflineQueue({queue:enqueueOfflineMutation(enqueueOfflineMutation([],item),item),profileContextId:'player-1',send:async()=>{sends++;throw Object.assign(new Error('response lost after commit'),{code:'STALE_REVISION',status:409});},fetchAuthoritative:async()=>mission({revision:3,activities:[{...activity,result:{completedSets:1,usedEasierVersion:false}}]})});
 assert.equal(sends,1);assert.equal(result.status,'synced');assert.deepEqual(result.queue,[]);
 assert.equal(nextOfflineMutation([item],'player-2'),null);assert.deepEqual(projectOfflineQueue(mission({profileContextId:'player-2'}),[item]),mission({profileContextId:'player-2'}));
});

test('GJ-05 offline safety stop takes local priority and remains pending until acknowledged',async()=>{
 const progress=createOfflineMutation(mission(),'record-result',{activityKey:'warm',completedSets:1},'2026-09-12T00:00:00.000Z');
 const stop=createOfflineMutation(mission(),'safety-stop',{},'2026-09-12T00:00:01.000Z');const queue=[progress,stop];
 assert.equal(nextOfflineMutation(queue,'player-1').body.action,'safety-stop');
 assert.equal(hasPendingSafetyStop(restoreOfflineQueue(serializeOfflineQueue(queue)),'player-1'),true,'a restored Stop keeps training blocked before server acknowledgement');
 const local=projectOfflineQueue(mission(),queue);assert.equal(local.status,'interrupted');assert.equal(local.pendingSync,true);
 const pending=await reconcileOfflineQueue({queue,profileContextId:'player-1',send:async()=>{throw Object.assign(new Error('offline'),{retryable:true});},fetchAuthoritative:async()=>mission()});
 assert.equal(pending.status,'pending');assert.deepEqual(pending.queue,queue);
});
