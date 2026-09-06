import test from 'node:test';
import assert from 'node:assert/strict';
import {newTrainingState} from '../lib/training.mjs';
const api=await import('../lib/training-actions.mjs').catch(()=>({}));
test('player actions cannot grant themselves a coach check or unlock a path',()=>{
 assert.equal(typeof api.applyAction,'function');
 assert.throws(()=>api.applyAction(newTrainingState(),{type:'check',group:'Move',passed:true},{role:'player'}),/permission/i);
 assert.throws(()=>api.applyAction(newTrainingState(),{type:'advance'},{role:'owner'}),/accomplishments/i);
});
test('stopping training persists until an adult explicitly clears it',()=>{
 assert.equal(typeof api.applyAction,'function');
 const stopped=api.applyAction(newTrainingState(),{type:'stop'},{role:'player'});
 assert.equal(stopped.safetyStopped,true);
 assert.throws(()=>api.applyAction(stopped,{type:'clear-safety'},{role:'player'}),/permission/i);
 assert.equal(api.applyAction(stopped,{type:'clear-safety'},{role:'owner'}).safetyStopped,false);
});
test('coach evaluation validates all ten sections and preserves evidence without awarding mastery',()=>{
 const action={type:'evaluate',ratings:[2,1,2,1,2,2,1,2,1,2],cause:'tracking',note:'Eyes left the ball before the catch on 4 of 10 throws.'};
 assert.throws(()=>api.applyAction(newTrainingState(),action,{role:'player'}),/permission/i);
 const result=api.applyAction(newTrainingState(),action,{role:'coach',id:'coach-1'},'2026-09-05T12:00:00Z');
 assert.equal(result.evaluations.length,1);
 assert.deepEqual(result.evaluations[0].ratings,[2,1,2,1,2,2,1,2,1,2]);
 assert.equal(result.evaluations[0].reviewedBy,'coach-1');
 assert.equal(result.checks.length,0);
 assert.throws(()=>api.applyAction(result,{...action,ratings:[3,3]},{role:'coach',id:'coach-1'}),/Invalid/);
 assert.throws(()=>api.applyAction(result,{...action,cause:'quicker hands'},{role:'coach',id:'coach-1'}),/Invalid/);
});
test('rest survives reopening and must finish before the next set',()=>{
 const actor={role:'owner',id:'parent'};
 let state=api.applyAction(newTrainingState(),{type:'set',drillId:'warm',setIndex:0},actor,'2026-09-05T12:00:00Z');
 assert.equal(state.rests['foundation:0:0:warm'].until,Date.parse('2026-09-05T12:00:30Z'));
 assert.throws(()=>api.applyAction(state,{type:'set',drillId:'warm',setIndex:1},actor,'2026-09-05T12:00:10Z'),/rest/i);
 state=api.applyAction(state,{type:'pause-rest',drillId:'warm'},actor,'2026-09-05T12:00:10Z');
 assert.equal(state.rests['foundation:0:0:warm'].remaining,20);
 state=api.applyAction(state,{type:'resume-rest',drillId:'warm'},actor,'2026-09-05T12:01:00Z');
 assert.equal(state.rests['foundation:0:0:warm'].until,Date.parse('2026-09-05T12:01:20Z'));
 assert.ok(api.applyAction(state,{type:'set',drillId:'warm',setIndex:1},actor,'2026-09-05T12:01:21Z').sets['foundation:0:0:warm:1']);
});
test('cannot skip sets or mark the reading drill done without an answer',()=>{
 assert.throws(()=>api.applyAction(newTrainingState(),{type:'set',drillId:'warm',setIndex:1},{role:'owner'}),/order/i);
 assert.throws(()=>api.applyAction(newTrainingState(),{type:'set',drillId:'read',setIndex:0},{role:'owner'}),/answer/i);
});
test('different adults keep their same-day evidence',()=>{
 const action={type:'check',skillId:1,passed:true,note:'Five controlled landings observed.'};
 const a=api.applyAction(newTrainingState(),action,{role:'owner',id:'parent'},'2026-09-05T12:00:00Z');
 const b=api.applyAction(a,{...action,passed:false,note:'Balance needs more practice today.'},{role:'coach',id:'coach'},'2026-09-05T13:00:00Z');
 assert.equal(b.checks.length,2);
 assert.equal(b.checks[0].reviewedBy,'parent');
});

test('skill checks derive their group from the declared skill and reject missing skill evidence',()=>{
 const state=newTrainingState();
 assert.throws(()=>api.applyAction(state,{type:'check',group:'Move',passed:true,note:'Five controlled landings observed.'},{role:'owner',id:'parent'}),/skill/i);
 const result=api.applyAction(state,{type:'check',skillId:18,passed:true,note:'Named the release cue before choosing a response.'},{role:'coach',id:'coach'});
 assert.equal(result.checks[0].skillId,18);
 assert.equal(result.checks[0].group,'React');
});
test('week 20 starts a fresh practice cycle without advancing the path or losing history',()=>{
 const state={...newTrainingState(),week:19,day:2,sessions:[{id:'foundation:19:2',date:'2026-09-05T12:00:00Z',pathId:'foundation',week:19,day:2}]};
 const next=api.applyAction(state,{type:'next'},{role:'owner'});
 assert.equal(next.pathId,'foundation');assert.equal(next.week,0);assert.equal(next.cycle,1);assert.equal(next.sessions.length,1);
 const done=api.applyAction(next,{type:'set',drillId:'warm',setIndex:0},{role:'owner'});
 assert.equal(done.sets['foundation:0:0:r1:warm:0'],true);
});
