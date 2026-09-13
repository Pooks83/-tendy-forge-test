import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateActivityVersions} from '../lib/training-content.mjs';

const generator=await import('../lib/mission-generator.mjs').catch(()=>({}));
const reviewed=item=>({...item,developmentAttributeIds:['BALANCE'],contentStatus:'PUBLISHED',developmentReview:{reviewerId:'development-reviewer',reviewedAt:'2026-09-12T00:00:00.000Z'},safetyReview:{reviewerId:'qualified-safety-reviewer',reviewedAt:'2026-09-12T00:00:00.000Z'},publishedAt:'2026-09-12T00:00:00.000Z'});
const catalog=candidateActivityVersions.map(reviewed);
const context=overrides=>({profileContextId:'player-1',planKey:'foundation:0:0',durationMinutes:25,ageBand:'10–12',level:1,equipment:['tennis-ball','wall-space','cones'],spaces:['small-indoor'],physicalRestrictions:[],safetyStopped:false,workload:{status:'ready',maxActivityMinutes:10},requiredInputs:[],activePriorities:[],coachFocus:null,dueRetest:null,coverageHistory:[],varietyHistory:[],catalog,rewardRuleVersion:'tf-reward-v1',...overrides});

test('identical planning inputs produce the same immutable mission plan',()=>{
 const first=generator.generateMission(context({}));const second=generator.generateMission(context({catalog:[...catalog].reverse()}));
 assert.deepEqual(first,second);assert.equal(first.kind,'mission');assert.equal(first.missionId,'foundation:0:0');assert.equal(first.version,generator.GENERATOR_VERSION);assert.equal(first.rewardRuleVersion,'tf-reward-v1');
 assert.equal(first.explanation.activityCount,4);assert.equal(first.explanation.durationMinutes,25);assert.equal(first.orderedActivityVersions.length,4);
 assert.deepEqual(first.orderedActivityVersions[0].developmentAttributeIds,['BALANCE']);
});

test('canonical duration selects three four or five eligible activities',()=>{
 for(const [duration,count] of [[15,3],[25,4],[35,5]]){
  const plan=generator.generateMission(context({durationMinutes:duration,planKey:`foundation:${duration}:0`}));
  assert.equal(plan.durationMinutes,duration);assert.equal(plan.orderedActivityVersions.length,count);assert.equal(new Set(plan.orderedActivityVersions.map(item=>item.activityId)).size,count);
 }
 assert.throws(()=>generator.generateMission(context({durationMinutes:30})),/15, 25, or 35/i);
});

test('safety and recovery return one explainable next action before content selection',()=>{
 const stopped=generator.generateMission(context({safetyStopped:true,workload:{status:'rest',maxActivityMinutes:0},catalog:[]}));
 assert.deepEqual(stopped,{kind:'unavailable',code:'SAFETY_STOPPED',audience:'player',message:'Training is paused. Ask an adult to check in.',nextAction:'adult-check-in',explanation:{dominantRule:'SAFETY_RESTRICTION'}});
 const recovery=generator.generateMission(context({workload:{status:'rest',maxActivityMinutes:0},catalog:[]}));
 assert.equal(recovery.code,'RECOVERY_DAY');assert.equal(recovery.nextAction,'rest-recovery');
});

test('one ACTIVE priority receives 40–60 percent of meaningful 25-minute work',()=>{
 const activePriority={id:'priority-depth',status:'ACTIVE',technicalSkillIds:[10,11],interventionFamilyIds:['two-hand-wall-catch','alternate-hand-wall-catch'],childCue:'See the whole bounce.',shortExplanation:'Track the ball before the hands move.'};
 const plan=generator.generateMission(context({activePriorities:[activePriority]}));
 assert.equal(plan.source,'ACTIVE_PRIORITY');assert.deepEqual(plan.priorityIds,['priority-depth']);
 const priorityMinutes=plan.orderedActivityVersions.filter(item=>activePriority.interventionFamilyIds.includes(item.familyId)).reduce((sum,item)=>sum+item.prescription.estimatedMinutes,0);
 const meaningfulMinutes=plan.orderedActivityVersions.reduce((sum,item)=>sum+item.prescription.estimatedMinutes,0);
 assert.ok(priorityMinutes/meaningfulMinutes>=0.4&&priorityMinutes/meaningfulMinutes<=0.6,`${priorityMinutes}/${meaningfulMinutes}`);
 assert.equal(plan.explanation.dominantRule,'ACTIVE_PRIORITY');assert.equal(plan.explanation.priorityAllocation.priorityId,'priority-depth');
});

test('multiple ACTIVE priorities and missing intervention content fail closed',()=>{
 const priority={id:'p1',status:'ACTIVE',technicalSkillIds:[10],interventionFamilyIds:['two-hand-wall-catch'],childCue:'Track it.',shortExplanation:'See the ball.'};
 assert.throws(()=>generator.generateMission(context({activePriorities:[priority,{...priority,id:'p2'}]})),/one active priority/i);
 const blocked=generator.generateMission(context({activePriorities:[{...priority,interventionFamilyIds:['not-reviewed']}]}));
 assert.equal(blocked.kind,'unavailable');assert.equal(blocked.code,'PRIORITY_CONTENT_UNAVAILABLE');assert.equal(blocked.nextAction,'adult-plan-review');
});

test('unreviewed or insufficient catalog returns adult review instead of an empty mission',()=>{
 const unreviewed=generator.generateMission(context({catalog:candidateActivityVersions}));
 assert.equal(unreviewed.kind,'unavailable');assert.equal(unreviewed.code,'CONTENT_REVIEW_REQUIRED');assert.equal(unreviewed.nextAction,'adult-content-review');
 const tooSmall=generator.generateMission(context({catalog:catalog.slice(0,2),durationMinutes:15}));
 assert.equal(tooSmall.kind,'unavailable');assert.equal(tooSmall.code,'NO_SAFE_MISSION');
});

test('confirmed coach focus outranks ACTIVE priority while safety still controls eligibility',()=>{
 const plan=generator.generateMission(context({coachFocus:{id:'coach-1',confirmed:true,technicalSkillIds:[3],interventionFamilyIds:['quiet-side-steps']},activePriorities:[{id:'priority-1',status:'ACTIVE',technicalSkillIds:[10],interventionFamilyIds:['two-hand-wall-catch'],childCue:'Track it.',shortExplanation:'See the ball.'}]}));
 assert.equal(plan.source,'COACH_FOCUS');assert.equal(plan.orderedActivityVersions[0].familyId,'quiet-side-steps');assert.equal(plan.explanation.selected[0].reason,'COACH_FOCUS');
});

test('explanation lists selected reasons and exact excluded reason counts without private data',()=>{
 const plan=generator.generateMission(context({catalog:[...catalog,{...catalog[0],activityId:'blocked-copy',familyId:'blocked-copy',eligibility:{...catalog[0].eligibility,ageBands:['13–15']}}]}));
 assert.equal(plan.explanation.excludedCounts.AGE_BLOCKED,1);assert.equal(plan.explanation.selected.length,4);assert.doesNotMatch(JSON.stringify(plan.explanation),/nickname|email|note/i);
});
