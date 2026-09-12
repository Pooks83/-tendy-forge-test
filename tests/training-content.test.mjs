import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const content=await import('../lib/training-content.mjs').catch(()=>({}));

const validActivity=()=>({
 activityId:'two-hand-catch',version:1,familyId:'wall-ball-catch',name:'Wall ball two-hand catch',developmentPurpose:'Track a soft ball into controlled hands.',technicalSkillIds:[10,11],attributeIds:['SEE'],
 eligibility:{ageBands:['10–12','13–15'],levels:[1,2,3]},equipment:['tennis-ball','wall-space'],space:['small-indoor'],context:'off-ice',movementTags:['standing','soft-ball'],
 setup:'Use a soft ball. Stand two big steps from a solid wall, away from glass and people.',startingPosition:'Stand balanced with the ball at waist height and both hands visible.',movementSteps:['Throw gently below shoulder height.','Watch the full bounce into both hands.','Reset your feet before the next attempt.'],
 prescriptions:{1:{repsOrTime:'8 attempts',rounds:2,restSeconds:30,estimatedMinutes:5,successCondition:'Finish each attempt balanced.',resultType:'attempt-count',resultUnit:'attempts',plausibility:{min:1,max:16}},2:{repsOrTime:'10 attempts',rounds:2,restSeconds:30,estimatedMinutes:5,successCondition:'Finish each attempt balanced.',resultType:'attempt-count',resultUnit:'attempts',plausibility:{min:1,max:20}},3:{repsOrTime:'10 attempts',rounds:3,restSeconds:30,estimatedMinutes:6,successCondition:'Finish each attempt balanced.',resultType:'attempt-count',resultUnit:'attempts',plausibility:{min:1,max:30}}},
 primaryCues:['See the whole bounce.','Finish with quiet feet.'],commonMistake:'Throwing harder after a miss.',easierVersion:'Allow one floor bounce before the catch.',harderVersion:'Alternate the first receiving hand without increasing throw speed.',
 substitutions:[{id:'open-space-catch',whenEquipmentMissing:['wall-space'],whenSpaceMissing:[],equipment:['tennis-ball'],space:['small-indoor'],setup:'Use a partner under adult supervision for gentle underhand tosses.'}],
 safetyConsiderations:['Use a soft ball only.','Keep people and glass outside the rebound area.'],painStopRule:'Stop immediately if anything hurts and tell an adult.',visualAssetId:'candidate:wall-ball-catch:v1',caption:'Setup, gentle throw, balanced catch.',altText:'Three frames show safe wall-ball setup, gentle throw, and balanced two-hand catch.',
 contentStatus:'PUBLISHED',developmentReview:{reviewerId:'development-reviewer',reviewedAt:'2026-09-12T00:00:00.000Z'},safetyReview:{reviewerId:'qualified-safety-reviewer',reviewedAt:'2026-09-12T00:00:00.000Z'},publishedAt:'2026-09-12T00:00:00.000Z',retiredAt:null,retirementReason:null,
});

test('candidate catalog contains 20–30 complete but unapproved activity families',()=>{
 assert.ok(content.candidateActivityVersions.length>=20&&content.candidateActivityVersions.length<=30);
 assert.equal(new Set(content.candidateActivityVersions.map(item=>item.familyId)).size,content.candidateActivityVersions.length);
 for(const item of content.candidateActivityVersions){
  assert.doesNotThrow(()=>content.validateActivityVersion(item));
  assert.equal(content.isPublishedActivity(item),false);
  assert.ok(['DEVELOPMENT_REVIEW','SAFETY_REVIEW'].includes(item.contentStatus));
 }
});

test('published activity requires both explicit reviews and publication time',()=>{
 const value=validActivity();
 assert.equal(content.isPublishedActivity(value),true);
 assert.equal(content.isPublishedActivity({...value,developmentReview:null}),false);
 assert.equal(content.isPublishedActivity({...value,safetyReview:null}),false);
 assert.equal(content.isPublishedActivity({...value,publishedAt:null}),false);
 assert.equal(content.isPublishedActivity({...value,contentStatus:'APPROVED'}),false);
});

test('activity validation enforces exact instruction safety and prescription fields',()=>{
 assert.deepEqual(content.validateActivityVersion(validActivity()),validActivity());
 assert.throws(()=>content.validateActivityVersion({...validActivity(),primaryCues:['one','two','three']}),/primary cues/i);
 assert.throws(()=>content.validateActivityVersion({...validActivity(),movementSteps:[]}),/movement steps/i);
 assert.throws(()=>content.validateActivityVersion({...validActivity(),prescriptions:{1:validActivity().prescriptions[1]}}),/level 2/i);
 assert.throws(()=>content.validateActivityVersion({...validActivity(),movementTags:['butterfly-drop']}),/prohibited/i);
 assert.throws(()=>content.validateActivityVersion({...validActivity(),contentStatus:'PUBLISHED',safetyReview:null}),/review/i);
});

test('catalog seed serialization emits only fully reviewed published versions',()=>{
 assert.equal(typeof content.publishedActivityRows,'function');
 assert.deepEqual(content.publishedActivityRows([validActivity()]).map(row=>[row.activityId,row.version]),[['two-hand-catch',1]]);
 assert.deepEqual(content.publishedActivityRows([{...validActivity(),contentStatus:'SAFETY_REVIEW',publishedAt:null,safetyReview:null}]),[]);
});

test('catalog seed command emits reviewed versions and rejects false publication claims',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tf-content-'));const input=join(dir,'content.json');
 writeFileSync(input,JSON.stringify([validActivity()]));
 const accepted=spawnSync(process.execPath,['scripts/generate-training-content-seed.mjs',input],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(accepted.status,0,accepted.stderr);assert.match(accepted.stdout,/INSERT INTO `activity_versions`/);assert.match(accepted.stdout,/two-hand-catch/);
 writeFileSync(input,JSON.stringify([{...validActivity(),safetyReview:null}]));
 const rejected=spawnSync(process.execPath,['scripts/generate-training-content-seed.mjs',input],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/requires development and safety review/i);
});
