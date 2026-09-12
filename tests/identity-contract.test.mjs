import test from 'node:test';
import assert from 'node:assert/strict';

const contract=await import('../lib/identity-contract.mjs').catch(()=>({}));

const validInput=(overrides={})=>({
 nickname:'  Henry  ',
 ageBand:'10–12',
 catches:'left',
 experience:'developing',
 equipment:[],
 spaces:['small-indoor'],
 plannedDays:['monday','thursday'],
 missionMinutes:25,
 consentAccepted:true,
 consentVersion:'tf-parent-consent-v1.4',
 policyVersion:'tf-privacy-v1.4',
 optionalPermissions:{analytics:false,notifications:false,clips:false},
 ...overrides,
});

test('onboarding rejects child data unless required consent is accepted',()=>{
 assert.equal(typeof contract.normalizeOnboardingInput,'function');
 assert.throws(
  ()=>contract.normalizeOnboardingInput(validInput({consentAccepted:false})),
  error=>error?.code==='CONSENT_REQUIRED'&&error?.status===403,
 );
});

test('onboarding requires the current consent contract',()=>{
 assert.throws(
  ()=>contract.normalizeOnboardingInput(validInput({consentVersion:'old-consent'})),
  error=>error?.code==='CONSENT_REQUIRED',
 );
});

test('onboarding accepts no equipment and canonical duration values',()=>{
 const value=contract.normalizeOnboardingInput(validInput());
 assert.equal(value.nickname,'Henry');
 assert.deepEqual(value.equipment,[]);
 assert.deepEqual(value.spaces,['small-indoor']);
 assert.deepEqual(value.plannedDays,['monday','thursday']);
 assert.equal(value.missionMinutes,25);
 assert.deepEqual(value.optionalPermissions,{analytics:false,notifications:false,clips:false});
});

test('onboarding rejects invalid duration, duplicate days, and unsupported profile values',()=>{
 assert.throws(()=>contract.normalizeOnboardingInput(validInput({missionMinutes:30})),error=>error?.code==='INVALID_SETUP');
 assert.throws(()=>contract.normalizeOnboardingInput(validInput({plannedDays:['monday','monday']})),error=>error?.code==='INVALID_SETUP');
 assert.throws(()=>contract.normalizeOnboardingInput(validInput({catches:'both'})),error=>error?.code==='INVALID_SETUP');
 assert.throws(()=>contract.normalizeOnboardingInput(validInput({experience:'professional'})),error=>error?.code==='INVALID_SETUP');
 assert.throws(()=>contract.normalizeOnboardingInput(validInput({spaces:['hallway']})),error=>error?.code==='INVALID_SETUP');
});

test('onboarding uses the canonical age choices and flags unsupported training eligibility',()=>{
 for(const ageBand of ['Under 10','10–12','13–15']){
  assert.equal(contract.normalizeOnboardingInput(validInput({ageBand})).trainingEligible,true);
 }
 const unsupported=contract.normalizeOnboardingInput(validInput({ageBand:'16 or older'}));
 assert.equal(unsupported.trainingEligible,false);
 assert.throws(()=>contract.normalizeOnboardingInput(validInput({ageBand:'8–10'})),error=>error?.code==='INVALID_SETUP');
});

test('player projection includes training continuity but excludes adult-only data',()=>{
 assert.equal(typeof contract.buildPlayerProjection,'function');
 const result=contract.buildPlayerProjection({
  id:'player-1',nickname:'Goalie',team:'Private team',ageBand:'10–12',catches:'left',experience:'developing',revision:4,
  equipment:['tennis-ball'],spaces:['small-indoor'],plannedDays:['monday'],missionMinutes:15,setupStatus:'ready',
  grants:['coach@example.com'],consentVersion:'secret',ownerId:'adult-1',
 },{
  version:2,pathId:'foundation',week:1,day:0,cycle:0,sets:{a:true},rests:{},sessions:[{id:'s1'}],
  answers:{q:{choice:1}},safetyStopped:false,checks:[{reviewedBy:'adult-1',note:'adult note'}],
  evaluations:[{reviewedBy:'coach-1',note:'coach note'}],
 });
 assert.deepEqual(result.profile,{id:'player-1',nickname:'Goalie',ageBand:'10–12',catches:'left',experience:'developing',equipment:['tennis-ball'],spaces:['small-indoor'],plannedDays:['monday'],missionMinutes:15,setupStatus:'ready',revision:4});
 assert.deepEqual(result.training,{version:2,pathId:'foundation',week:1,day:0,cycle:0,sets:{a:true},rests:{},sessions:[{id:'s1'}],answers:{q:{choice:1}},safetyStopped:false});
 const serialized=JSON.stringify(result);
 for(const forbidden of ['coach@example.com','secret','adult-1','coach-1','adult note','coach note','Private team'])assert.equal(serialized.includes(forbidden),false);
});

test('canonical errors expose stable code, recovery-safe message, and HTTP status',()=>{
 const error=contract.canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',409);
 assert.equal(error.name,'CanonicalError');
 assert.equal(error.code,'PLAYER_CONTEXT_REQUIRED');
 assert.equal(error.message,'Choose your goalie again.');
 assert.equal(error.status,409);
});
