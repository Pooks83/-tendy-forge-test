import test from 'node:test';
import assert from 'node:assert/strict';

const progression=await import('../lib/progression.mjs').catch(()=>({}));

const input=overrides=>({
 missionInstanceId:'mi-1',profileId:'p1',
 snapshot:{blocks:[
  {id:'move',minutes:4,developmentAttributeIds:['BALANCE','EXPLOSIVENESS']},
  {id:'track',minutes:6,developmentAttributeIds:['TRACKING']},
  {id:'mind',minutes:5,developmentAttributeIds:['MINDSET']},
 ]},
 activities:[{key:'move',status:'COMPLETED'},{key:'track',status:'COMPLETED'},{key:'mind',status:'SKIPPED'}],
 journey:{pathId:'foundation',week:0,day:0,cycle:0,daysPerWeek:3,weeksPerCycle:20},
 ...overrides,
});

test('completed prescribed minutes award exact XP while skipped and extra volume award zero',()=>{
 assert.equal(typeof progression.calculateCompletionPackage,'function');
 const result=progression.calculateCompletionPackage(input({activities:[{key:'move',status:'COMPLETED',result:{completedSets:999}},{key:'track',status:'COMPLETED'},{key:'mind',status:'SKIPPED'}]}));
 assert.equal(result.ruleVersion,'tf-progression-v1');
 assert.equal(result.completedPrescribedMinutes,10);
 assert.equal(result.skippedPrescribedMinutes,5);
 assert.equal(result.totalPrescribedMinutes,15);
 assert.equal(result.completionMultiplier,10/15);
 assert.equal(result.xp,10);
 assert.equal(result.xpUnits,10000);
 assert.equal(result.firstSaveEligible,true);
 assert.deepEqual(result.attributeUnits,{BALANCE:2000,EXPLOSIVENESS:2000,TRACKING:6000});
 assert.deepEqual(result.journeyAfter,{pathId:'foundation',week:0,day:1,cycle:0});
});

test('attribute allocation conserves every milli-unit with deterministic lexical remainders',()=>{
 const result=progression.calculateCompletionPackage(input({snapshot:{blocks:[{id:'one',minutes:1,developmentAttributeIds:['TRACKING','BALANCE','HANDS']}]},activities:[{key:'one',status:'COMPLETED'}]}));
 assert.deepEqual(result.attributeUnits,{BALANCE:334,HANDS:333,TRACKING:333});
 assert.equal(Object.values(result.attributeUnits).reduce((sum,value)=>sum+value,0),1000);
});

test('journey advances day week and cycle once without changing path',()=>{
 const block={id:'one',minutes:1,developmentAttributeIds:['MINDSET']};
 const activities=[{key:'one',status:'COMPLETED'}];
 const week=progression.calculateCompletionPackage(input({snapshot:{blocks:[block]},activities,journey:{pathId:'builder',week:4,day:2,cycle:1,daysPerWeek:3,weeksPerCycle:20}}));
 assert.deepEqual(week.journeyAfter,{pathId:'builder',week:5,day:0,cycle:1});
 const cycle=progression.calculateCompletionPackage(input({snapshot:{blocks:[block]},activities,journey:{pathId:'performance',week:19,day:3,cycle:2,daysPerWeek:4,weeksPerCycle:20}}));
 assert.deepEqual(cycle.journeyAfter,{pathId:'performance',week:0,day:0,cycle:3});
});

test('all-skipped completion advances the journey but awards no XP attributes or first reward',()=>{
 const result=progression.calculateCompletionPackage(input({activities:[{key:'move',status:'SKIPPED'},{key:'track',status:'SKIPPED'},{key:'mind',status:'SKIPPED'}]}));
 assert.equal(result.xp,0);assert.equal(result.firstSaveEligible,false);assert.deepEqual(result.attributeUnits,{});
 assert.deepEqual(result.journeyAfter,{pathId:'foundation',week:0,day:1,cycle:0});
});

test('invalid progression inputs fail closed with a stable code',()=>{
 const throwsCode=(value,code)=>assert.throws(()=>progression.calculateCompletionPackage(value),error=>error?.code===code);
 throwsCode(input({activities:[{key:'move',status:'IN_PROGRESS'},{key:'track',status:'COMPLETED'},{key:'mind',status:'SKIPPED'}]}),'MISSION_NOT_READY');
 throwsCode(input({snapshot:{blocks:[{id:'move',minutes:4,developmentAttributeIds:[]}]},activities:[{key:'move',status:'COMPLETED'}]}),'PROGRESSION_CONFIG_REQUIRED');
 throwsCode(input({snapshot:{blocks:[{id:'move',minutes:4,developmentAttributeIds:['REFLEXES']}]},activities:[{key:'move',status:'COMPLETED'}]}),'PROGRESSION_CONFIG_REQUIRED');
 throwsCode(input({snapshot:{blocks:[{id:'move',minutes:0,developmentAttributeIds:['BALANCE']}]},activities:[{key:'move',status:'COMPLETED'}]}),'PROGRESSION_CONFIG_REQUIRED');
});
