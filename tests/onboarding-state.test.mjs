import test from 'node:test';
import assert from 'node:assert/strict';

const state=await import('../lib/onboarding-state.mjs').catch(()=>({}));

test('parent onboarding follows the canonical seven-step order and back restores the prior step',()=>{
 assert.equal(typeof state.onboardingReducer,'function');
 let value=state.initialOnboardingState();
 assert.equal(value.step,'welcome');
 for(const expected of ['adult-account','parent-permission','create-goalie','gear','training-plan']){
  value=state.onboardingReducer(value,{type:'NEXT'});
  assert.equal(value.step,expected);
 }
 value=state.onboardingReducer(value,{type:'BACK'});
 assert.equal(value.step,'gear');
});

test('optional permission denial does not prevent required-consent progression',()=>{
 let value=state.initialOnboardingState();
 value=state.onboardingReducer(value,{type:'SET',field:'consentAccepted',value:true});
 value=state.onboardingReducer(value,{type:'SET',field:'analyticsAllowed',value:false});
 assert.equal(value.data.consentAccepted,true);
 assert.equal(value.data.analyticsAllowed,false);
});

test('submission operation key remains stable across retry and changes after reset',()=>{
 const first=state.initialOnboardingState('operation-fixed');
 const retry=state.onboardingReducer(first,{type:'SUBMIT_FAILED',message:'Try again'});
 assert.equal(retry.operationKey,'operation-fixed');
 const reset=state.onboardingReducer(retry,{type:'RESET',operationKey:'operation-new'});
 assert.equal(reset.operationKey,'operation-new');
});

test('successful setup enters handoff with the created profile identity',()=>{
 const value=state.onboardingReducer(state.initialOnboardingState('operation-fixed'),{type:'SUBMIT_SUCCEEDED',profileId:'player-1',nickname:'Goalie'});
 assert.equal(value.step,'handoff');
 assert.equal(value.profileId,'player-1');
 assert.equal(value.data.nickname,'Goalie');
});

test('saved account draft resumes the exact consented setup step and operation',()=>{
 assert.equal(typeof state.restoreOnboardingState,'function');
 const restored=state.restoreOnboardingState({
  step:'gear',
  operationKey:'operation-resume-1',
  data:{nickname:'Finn',ageBand:'10–12',catches:'right',experience:'developing',equipment:['tennis-ball'],plannedDays:[],missionMinutes:25,consentAccepted:true,analyticsAllowed:false},
 });
 assert.equal(restored.step,'gear');
 assert.equal(restored.operationKey,'operation-resume-1');
 assert.equal(restored.data.nickname,'Finn');
 assert.equal(restored.data.consentAccepted,true);
});

test('invalid or pre-consent saved state cannot bypass parent permission',()=>{
 const restored=state.restoreOnboardingState({step:'training-plan',operationKey:'unsafe',data:{nickname:'Child',consentAccepted:false}});
 assert.equal(restored.step,'welcome');
 assert.equal(restored.data.nickname,'');
 assert.notEqual(restored.operationKey,'unsafe');
});
