import test from 'node:test';
import assert from 'node:assert/strict';
const navigation=await import('../lib/training-navigation.mjs').catch(()=>({}));

test('navigation state accepts only product views and known drill ids',()=>{
  assert.equal(typeof navigation.parseTrainingLocation,'function');
  assert.deepEqual(navigation.parseTrainingLocation('?view=train&drill=catch',['catch','warm']),{view:'Train',drill:'catch'});
  assert.deepEqual(navigation.parseTrainingLocation('?view=admin&drill=unknown',['catch']),{view:'Home',drill:null});
});

test('player navigation exposes exactly the v1.4 destinations and normalizes old links',()=>{
 assert.deepEqual(navigation.PLAYER_DESTINATIONS,['Today','Journey','Progress','Profile']);
 assert.deepEqual(navigation.parseTrainingLocation('?view=today&drill=catch',['catch'],'player'),{view:'Today',drill:'catch'});
 assert.deepEqual(navigation.parseTrainingLocation('?view=journey',[],'player'),{view:'Journey',drill:null});
 assert.deepEqual(navigation.parseTrainingLocation('?view=train',[],'player'),{view:'Journey',drill:null});
 assert.deepEqual(navigation.parseTrainingLocation('?view=locker',[],'player'),{view:'Today',drill:null});
});

test('navigation state serializes home cleanly and preserves valid deep links',()=>{
  assert.equal(navigation.trainingLocation({view:'Home',drill:null}),'/');
  assert.equal(navigation.trainingLocation({view:'Progress',drill:null}),'/?view=progress');
  assert.equal(navigation.trainingLocation({view:'Train',drill:'wall ball'}),'/?view=train&drill=wall+ball');
});

test('player locations use canonical destination names',()=>{
 assert.equal(navigation.trainingLocation({view:'Today',drill:null}),'/');
 assert.equal(navigation.trainingLocation({view:'Journey',drill:null}),'/?view=journey');
 assert.equal(navigation.trainingLocation({view:'Today',drill:'catch'}),'/?drill=catch');
});

test('signed-out deep links cannot open a training drill',()=>{
  assert.equal(navigation.resolveTrainingDrill(false,'catch',['catch']),null);
  assert.equal(navigation.resolveTrainingDrill(true,'catch',['catch']),'catch');
});
