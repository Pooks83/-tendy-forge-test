import test from 'node:test';
import assert from 'node:assert/strict';

const client=await import('../lib/mission-client.mjs').catch(()=>({}));

const activity=overrides=>({key:'warm',ordinal:0,status:'in-progress',result:null,requiredSets:2,restSeconds:30,restRemainingSeconds:0,restCompletedAfterSet:0,...overrides});
const mission=overrides=>({missionId:'foundation:0:0',profileContextId:'player-1',status:'in-progress',revision:1,currentActivityIndex:0,activities:[activity()],...overrides});

test('activity control is derived entirely from authoritative mission state',()=>{
 assert.deepEqual(client.resolveMissionActivityControl(mission({activities:[activity({status:'ready'})]})),{action:'start-activity',label:'Start this activity'});
 assert.deepEqual(client.resolveMissionActivityControl(mission({activities:[activity({})]})),{action:'record-result',label:'I finished set 1'});
 assert.deepEqual(client.resolveMissionActivityControl(mission({activities:[activity({result:{completedSets:1},restCompletedAfterSet:0})]})),{action:'start-rest',label:'Start 30-second rest'});
 assert.deepEqual(client.resolveMissionActivityControl(mission({activities:[activity({status:'resting',result:{completedSets:1},restRemainingSeconds:30})]})),{action:'end-rest',label:'Resting'});
 assert.deepEqual(client.resolveMissionActivityControl(mission({activities:[activity({result:{completedSets:1},restCompletedAfterSet:1})]})),{action:'record-result',label:'I finished set 2'});
 assert.deepEqual(client.resolveMissionActivityControl(mission({activities:[activity({result:{completedSets:2},restCompletedAfterSet:1})]})),{action:'complete-activity',label:'Finish activity'});
 assert.deepEqual(client.resolveMissionActivityControl(mission({status:'paused'})),{action:'resume',label:'Resume mission'});
 assert.deepEqual(client.resolveMissionActivityControl(mission({status:'interrupted'})),{action:'resume',label:'Resume mission'});
 assert.deepEqual(client.resolveMissionActivityControl(mission({status:'completed'})),{action:'acknowledge-completion',label:'Mission complete'});
});

test('mutation identity is stable across retry and pinned to mission revision and player context',()=>{
 const value=mission({revision:7});
 const first=client.missionMutation(value,'record-result',{activityKey:'warm',completedSets:1});
 const second=client.missionMutation(value,'record-result',{activityKey:'warm',completedSets:1});
 assert.deepEqual(first,second);
 assert.deepEqual(first.body,{action:'record-result',missionId:'foundation:0:0',profileContextId:'player-1',revision:7,activityKey:'warm',result:{completedSets:1,usedEasierVersion:false}});
 assert.match(first.operationKey,/^mission:/);
 assert.doesNotMatch(JSON.stringify(first),/nickname|email|note/i);
});

test('reading result keeps the selected answer but never trusts the client for correctness',()=>{
 const value=mission({activities:[activity({key:'read',requiredSets:1})]});
 const request=client.missionMutation(value,'record-result',{activityKey:'read',completedSets:1,answer:2,usedEasierVersion:true});
 assert.deepEqual(request.body.result,{completedSets:1,usedEasierVersion:true,answer:2});
 assert.equal('correct' in request.body.result,false);
});
