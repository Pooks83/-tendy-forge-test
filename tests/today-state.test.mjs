import test from 'node:test';
import assert from 'node:assert/strict';

const today=await import('../lib/today-state.mjs').catch(()=>({}));

test('Today uses the authoritative mission start before local drill progress exists',()=>{
 assert.equal(typeof today.resolveTodayMissionAction,'function');
 assert.deepEqual(today.resolveTodayMissionAction({missionInProgress:false,completedActivities:0}),{action:'start-mission',label:'Start today’s training'});
 assert.deepEqual(today.resolveTodayMissionAction({missionInProgress:true,completedActivities:0}),{action:'resume-mission',label:'Resume mission'});
 assert.deepEqual(today.resolveTodayMissionAction({missionInProgress:false,completedActivities:2}),{action:'resume-mission',label:'Continue training'});
});
