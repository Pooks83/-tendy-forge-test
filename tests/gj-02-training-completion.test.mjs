import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionExecution,resolveTodayExecution,transitionMission} from '../lib/mission-state.mjs';
import {resolveMissionActivityControl} from '../lib/mission-client.mjs';

test('GJ-02 mission ready through ordered work rest completion and return to Today',()=>{
 let now=0;const at=()=>new Date(1_790_000_000_000+now++*60_000).toISOString();
 let mission=transitionMission(createMissionExecution({missionId:'foundation:0:0',activityKeys:['move','read'],contentVersion:'tf-curriculum-v1'}),{type:'START'},at());
 const enrich=current=>({...current,status:current.status.toLowerCase().replaceAll('_','-'),profileContextId:'p1',activities:current.activities.map(item=>({...item,status:item.status.toLowerCase().replaceAll('_','-'),requiredSets:2,restSeconds:30}))});
 for(const key of ['move','read']){
  mission=transitionMission(mission,{type:'START_ACTIVITY',activityKey:key},at());
  mission=transitionMission(mission,{type:'RECORD_RESULT',activityKey:key,result:{completedSets:1,usedEasierVersion:false}},at());
  assert.equal(resolveMissionActivityControl(enrich(mission)).action,'start-rest');
  mission=transitionMission(mission,{type:'START_REST',activityKey:key,remainingSeconds:30},at());
  mission=transitionMission(mission,{type:'END_REST',activityKey:key},at());
  mission=transitionMission(mission,{type:'RECORD_RESULT',activityKey:key,result:{completedSets:2,usedEasierVersion:false,...(key==='read'?{answer:0,correct:true}:{})}},at());
  mission=transitionMission(mission,{type:'COMPLETE_ACTIVITY',activityKey:key},at());
 }
 assert.equal(resolveMissionActivityControl(enrich(mission)).action,'complete-mission');
 mission=transitionMission(mission,{type:'COMPLETE_MISSION'},at());
 assert.equal(mission.status,'COMPLETED');assert.equal(resolveTodayExecution({mission}).state,'mission-complete');
 assert.equal(resolveMissionActivityControl(enrich(mission)).action,'acknowledge-completion');
 assert.deepEqual(transitionMission(mission,{type:'COMPLETE_MISSION'},at()),mission);
});

test('GJ-02 completion state does not manufacture XP or rewards before TF-MVP-007',()=>{
 let mission=transitionMission(createMissionExecution({missionId:'m1',activityKeys:['only'],contentVersion:'v1'}),{type:'START'},new Date().toISOString());
 mission=transitionMission(mission,{type:'START_ACTIVITY',activityKey:'only'},new Date().toISOString());
 mission=transitionMission(mission,{type:'RECORD_RESULT',activityKey:'only',result:{completedSets:1}},new Date().toISOString());
 mission=transitionMission(mission,{type:'COMPLETE_ACTIVITY',activityKey:'only'},new Date().toISOString());
 mission=transitionMission(mission,{type:'COMPLETE_MISSION'},new Date().toISOString());
 assert.equal('xp' in mission,false);assert.equal('reward' in mission,false);assert.equal('badge' in mission,false);
});
