import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateActivityVersions} from '../lib/training-content.mjs';

const eligibility=await import('../lib/activity-eligibility.mjs').catch(()=>({}));
const reviewed=item=>({...item,contentStatus:'PUBLISHED',developmentReview:{reviewerId:'development-reviewer',reviewedAt:'2026-09-12T00:00:00.000Z'},safetyReview:{reviewerId:'qualified-safety-reviewer',reviewedAt:'2026-09-12T00:00:00.000Z'},publishedAt:'2026-09-12T00:00:00.000Z'});
const activity=reviewed(candidateActivityVersions.find(item=>item.activityId==='two-hand-wall-catch'));
const context=overrides=>({ageBand:'10–12',level:1,equipment:['tennis-ball','wall-space'],spaces:['small-indoor'],physicalRestrictions:[],safetyStopped:false,workload:{status:'ready',maxActivityMinutes:10},objective:{technicalSkillIds:[10]},requiredInputs:[],...overrides});

test('eligibility returns a reviewed level prescription with no hidden decision',()=>{
 const result=eligibility.evaluateActivity(activity,context({}));
 assert.equal(result.eligible,true);assert.equal(result.prescription,activity.prescriptions[1]);assert.equal(result.substitution,null);assert.deepEqual(result.reasons,[]);
});

test('eligibility denies every canonical missing or unsafe fact with a stable reason',()=>{
 const cases=[
  [{contentStatus:'SAFETY_REVIEW',safetyReview:null,publishedAt:null},{},'NOT_PUBLISHED'],
  [{},{ageBand:'Under 10'},'AGE_BLOCKED'],
  [{},{level:4},'LEVEL_BLOCKED'],
  [{substitutions:[]},{equipment:[]},'EQUIPMENT_MISSING'],
  [{substitutions:[]},{spaces:[]},'SPACE_MISSING'],
  [{movementTags:['standing','soft-ball']},{physicalRestrictions:['soft-ball']},'PHYSICAL_RESTRICTION'],
  [{},{safetyStopped:true},'SAFETY_STOPPED'],
  [{},{workload:{status:'rest',maxActivityMinutes:0}},'WORKLOAD_BLOCKED'],
  [{requiredInputs:['reviewed-diagram']},{requiredInputs:[]},'INPUT_MISSING'],
  [{},{objective:{technicalSkillIds:[30]}},'OBJECTIVE_MISMATCH'],
 ];
 for(const [activityChange,contextChange,code] of cases){
  const result=eligibility.evaluateActivity({...activity,...activityChange},context(contextChange));
  assert.equal(result.eligible,false,code);assert.ok(result.reasons.some(reason=>reason.code===code),code);
 }
});

test('approved substitution must independently satisfy equipment and space',()=>{
 const missingWall=context({equipment:['tennis-ball']});
 const replaced=eligibility.evaluateActivity(activity,missingWall);
 assert.equal(replaced.eligible,true);assert.equal(replaced.substitution.id,'two-hand-wall-catch-reduced');
 const unsafeReplacement=eligibility.evaluateActivity({...activity,substitutions:[{...activity.substitutions[0],equipment:['reaction-ball']}]},missingWall);
 assert.equal(unsafeReplacement.eligible,false);assert.ok(unsafeReplacement.reasons.some(reason=>reason.code==='EQUIPMENT_MISSING'));
});

test('safety and workload reasons precede lower-order eligibility reasons',()=>{
 const result=eligibility.evaluateActivity({...activity,substitutions:[]},context({ageBand:'Under 10',equipment:[],spaces:[],safetyStopped:true,workload:{status:'blocked',maxActivityMinutes:0},objective:{technicalSkillIds:[30]}}));
 assert.deepEqual(result.reasons.map(reason=>reason.code).slice(0,2),['SAFETY_STOPPED','WORKLOAD_BLOCKED']);
});

test('eligibleActivities is deterministic and preserves explicit exclusions',()=>{
 const catalog=[reviewed(candidateActivityVersions[1]),activity,reviewed(candidateActivityVersions[0])];
 const first=eligibility.eligibleActivities(catalog,context({objective:null}));const second=eligibility.eligibleActivities([...catalog].reverse(),context({objective:null}));
 assert.deepEqual(first,second);assert.deepEqual(first.eligible.map(item=>item.activity.activityId),[...first.eligible.map(item=>item.activity.activityId)].sort());assert.equal(first.excluded.length+first.eligible.length,catalog.length);
});
