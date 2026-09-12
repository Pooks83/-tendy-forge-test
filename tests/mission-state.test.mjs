import test from 'node:test';
import assert from 'node:assert/strict';

const mission=await import('../lib/mission-state.mjs').catch(()=>({}));
const at='2026-09-11T12:00:00.000Z';

function started(keys=['warm','catch']){
 const initial=mission.createMissionExecution({missionId:'mission-1',activityKeys:keys,contentVersion:'curriculum-v1'});
 return mission.transitionMission(initial,{type:'START'},at);
}

test('mission state machine exposes the canonical lifecycle and immutable execution identity',()=>{
 assert.equal(typeof mission.createMissionExecution,'function');
 const initial=mission.createMissionExecution({missionId:'mission-1',activityKeys:['warm','catch'],contentVersion:'curriculum-v1'});
 assert.deepEqual(initial,{
  missionId:'mission-1',status:'NOT_STARTED',revision:0,currentActivityIndex:0,contentVersion:'curriculum-v1',
  activities:[
   {key:'warm',ordinal:0,status:'READY',result:null,restCompletedAfterSet:0},
   {key:'catch',ordinal:1,status:'READY',result:null,restCompletedAfterSet:0},
  ],
 });
 const active=mission.transitionMission(initial,{type:'START'},at);
 assert.equal(active.status,'IN_PROGRESS');
 assert.equal(active.revision,1);
 assert.equal(active.startedAt,at);
 assert.equal(initial.status,'NOT_STARTED','transition must not mutate its input');
});

test('activity execution is ordered and requires a structured result before completion',()=>{
 let state=started();
 assert.throws(()=>mission.transitionMission(state,{type:'START_ACTIVITY',activityKey:'catch'},at),error=>error?.code==='INVALID_STATE_TRANSITION');
 state=mission.transitionMission(state,{type:'START_ACTIVITY',activityKey:'warm'},at);
 assert.equal(state.activities[0].status,'IN_PROGRESS');
 assert.throws(()=>mission.transitionMission(state,{type:'COMPLETE_ACTIVITY',activityKey:'warm'},at),error=>error?.code==='INVALID_RESULT');
 assert.throws(()=>mission.transitionMission(state,{type:'RECORD_RESULT',activityKey:'warm',result:{completedSets:-1}},at),error=>error?.code==='INVALID_RESULT');
 state=mission.transitionMission(state,{type:'RECORD_RESULT',activityKey:'warm',result:{completedSets:2,usedEasierVersion:false}},at);
 state=mission.transitionMission(state,{type:'COMPLETE_ACTIVITY',activityKey:'warm'},at);
 assert.equal(state.currentActivityIndex,1);
 assert.equal(state.activities[0].status,'COMPLETED');
 assert.equal(state.activities[1].status,'READY');
});

test('rest, pause, interruption, resume, and abandonment follow defined transitions',()=>{
 let state=mission.transitionMission(started(),{type:'START_ACTIVITY',activityKey:'warm'},at);
 state=mission.transitionMission(state,{type:'RECORD_RESULT',activityKey:'warm',result:{completedSets:1}},at);
 state=mission.transitionMission(state,{type:'START_REST',activityKey:'warm',remainingSeconds:30},at);
 assert.equal(state.activities[0].status,'RESTING');
 state=mission.transitionMission(state,{type:'PAUSE'},at);
 assert.equal(state.status,'PAUSED');
 state=mission.transitionMission(state,{type:'RESUME'},at);
 assert.equal(state.status,'IN_PROGRESS');
 assert.equal(state.activities[0].status,'RESTING');
  state=mission.transitionMission(state,{type:'END_REST',activityKey:'warm'},at);
  assert.equal(state.activities[0].status,'IN_PROGRESS');
  assert.equal(state.activities[0].restCompletedAfterSet,1);
 state=mission.transitionMission(state,{type:'INTERRUPT',reason:'app-closed'},at);
 assert.equal(state.status,'INTERRUPTED');
 state=mission.transitionMission(state,{type:'RESUME'},at);
 state=mission.transitionMission(state,{type:'ABANDON',reason:'adult-ended'},at);
 assert.equal(state.status,'ABANDONED');
 assert.equal(state.abandonedAt,at);
 assert.throws(()=>mission.transitionMission(state,{type:'RESUME'},at),error=>error?.code==='SESSION_ALREADY_COMPLETED');
});

test('completion is terminal, exactly repeatable, and cannot precede all activities',()=>{
 let state=started(['warm']);
 assert.throws(()=>mission.transitionMission(state,{type:'COMPLETE_MISSION'},at),error=>error?.code==='INVALID_STATE_TRANSITION');
 state=mission.transitionMission(state,{type:'START_ACTIVITY',activityKey:'warm'},at);
 state=mission.transitionMission(state,{type:'RECORD_RESULT',activityKey:'warm',result:{completedSets:2}},at);
 state=mission.transitionMission(state,{type:'COMPLETE_ACTIVITY',activityKey:'warm'},at);
 const complete=mission.transitionMission(state,{type:'COMPLETE_MISSION'},at);
 assert.equal(complete.status,'COMPLETED');
 assert.equal(complete.completedAt,at);
 assert.equal(complete.revision,state.revision+1);
 assert.strictEqual(mission.transitionMission(complete,{type:'COMPLETE_MISSION'},at),complete,'duplicate terminal completion is a no-op');
 assert.throws(()=>mission.transitionMission(complete,{type:'START_ACTIVITY',activityKey:'warm'},at),error=>error?.code==='SESSION_ALREADY_COMPLETED');
});

test('a controlled skip records a reason and still permits mission completion',()=>{
 let state=started(['warm']);
 state=mission.transitionMission(state,{type:'SKIP_ACTIVITY',activityKey:'warm',reason:'safe-substitution'},at);
 assert.equal(state.activities[0].status,'SKIPPED');
 assert.equal(state.activities[0].result.reason,'safe-substitution');
 assert.equal(mission.transitionMission(state,{type:'COMPLETE_MISSION'},at).status,'COMPLETED');
 assert.throws(()=>mission.transitionMission(started(['warm']),{type:'SKIP_ACTIVITY',activityKey:'warm',reason:'because'},at),error=>error?.code==='INVALID_RESULT');
});

test('safety stop interrupts an active mission and requires an explicit later resume',()=>{
 const state=mission.transitionMission(started(['warm']),{type:'SAFETY_STOP'},at);
 assert.equal(state.status,'INTERRUPTED');assert.equal(state.interruptionReason,'safety-stop');
 assert.throws(()=>mission.transitionMission(state,{type:'START_ACTIVITY',activityKey:'warm'},at),error=>error?.code==='INVALID_STATE_TRANSITION');
 assert.equal(mission.transitionMission(state,{type:'RESUME'},at).status,'IN_PROGRESS');
});

test('Today projection covers ready, active, rest, complete, safety, offline, loading, and recovery',()=>{
 const active=started(['warm']);
 const resting=mission.transitionMission(mission.transitionMission(active,{type:'START_ACTIVITY',activityKey:'warm'},at),{type:'START_REST',activityKey:'warm',remainingSeconds:30},at);
 const completed={...active,status:'COMPLETED',completedAt:at};
 assert.deepEqual(mission.resolveTodayExecution({mission:null}),{state:'mission-ready',action:'start-mission'});
 assert.deepEqual(mission.resolveTodayExecution({mission:active}),{state:'active-resume',action:'resume-mission'});
 assert.deepEqual(mission.resolveTodayExecution({mission:resting}),{state:'rest-recovery',action:'resume-rest'});
 assert.deepEqual(mission.resolveTodayExecution({mission:completed}),{state:'mission-complete',action:'acknowledge-completion'});
 assert.deepEqual(mission.resolveTodayExecution({mission:active,safetyStopped:true}),{state:'blocked-adult',action:'return-to-adult'});
 assert.deepEqual(mission.resolveTodayExecution({mission:active,offlinePending:true}),{state:'offline-cached',action:'continue-offline'});
 assert.deepEqual(mission.resolveTodayExecution({loading:true}),{state:'loading',action:null});
 assert.deepEqual(mission.resolveTodayExecution({error:true}),{state:'recoverable-error',action:'retry'});
});
