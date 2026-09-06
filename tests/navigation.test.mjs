import test from 'node:test';
import assert from 'node:assert/strict';
const navigation=await import('../lib/training-navigation.mjs').catch(()=>({}));

test('navigation state accepts only product views and known drill ids',()=>{
  assert.equal(typeof navigation.parseTrainingLocation,'function');
  assert.deepEqual(navigation.parseTrainingLocation('?view=train&drill=catch',['catch','warm']),{view:'Train',drill:'catch'});
  assert.deepEqual(navigation.parseTrainingLocation('?view=admin&drill=unknown',['catch']),{view:'Home',drill:null});
});

test('navigation state serializes home cleanly and preserves valid deep links',()=>{
  assert.equal(navigation.trainingLocation({view:'Home',drill:null}),'/');
  assert.equal(navigation.trainingLocation({view:'Progress',drill:null}),'/?view=progress');
  assert.equal(navigation.trainingLocation({view:'Train',drill:'wall ball'}),'/?view=train&drill=wall+ball');
});

test('signed-out deep links cannot open a training drill',()=>{
  assert.equal(navigation.resolveTrainingDrill(false,'catch',['catch']),null);
  assert.equal(navigation.resolveTrainingDrill(true,'catch',['catch']),'catch');
});
