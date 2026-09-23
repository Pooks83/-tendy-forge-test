import test from 'node:test';
import assert from 'node:assert/strict';

const measurement=await import('../lib/measurement.mjs').catch(()=>({}));

const protocol={id:'tracking-wall-ball-v1',attributeId:'TRACKING',metric:'successful_catches',direction:'HIGHER_IS_BETTER',minimumValid:0,maximumValid:100};

test('baseline stores a valid measured result without inventing an ability score',()=>{
 assert.equal(typeof measurement.evaluateMeasurement,'function');
 const result=measurement.evaluateMeasurement({protocol,value:18,kind:'BASELINE'});
 assert.deepEqual(result,{protocolId:'tracking-wall-ball-v1',attributeId:'TRACKING',metric:'successful_catches',kind:'BASELINE',value:18,valid:true});
 assert.equal('rating' in result,false);
});

test('retest compares only the same protocol and reports measured change',()=>{
 assert.equal(typeof measurement.compareMeasurements,'function');
 const result=measurement.compareMeasurements({
  baseline:{protocolId:'tracking-wall-ball-v1',attributeId:'TRACKING',metric:'successful_catches',kind:'BASELINE',value:18,valid:true},
  retest:{protocolId:'tracking-wall-ball-v1',attributeId:'TRACKING',metric:'successful_catches',kind:'RETEST',value:23,valid:true},
  direction:'HIGHER_IS_BETTER'
 });
 assert.deepEqual(result,{eligible:true,absoluteChange:5,percentChange:27.8,improved:true});
});

test('invalid, mismatched, or zero baselines cannot create a PR',()=>{
 const invalid=measurement.evaluateMeasurement({protocol,value:101,kind:'RETEST'});
 assert.equal(invalid.valid,false);
 assert.deepEqual(measurement.compareMeasurements({
  baseline:{protocolId:'a',attributeId:'TRACKING',metric:'x',kind:'BASELINE',value:10,valid:true},
  retest:{protocolId:'b',attributeId:'TRACKING',metric:'x',kind:'RETEST',value:20,valid:true},
  direction:'HIGHER_IS_BETTER'
 }),{eligible:false,reason:'PROTOCOL_MISMATCH'});
 assert.equal(measurement.compareMeasurements({
  baseline:{protocolId:'a',attributeId:'TRACKING',metric:'x',kind:'BASELINE',value:0,valid:true},
  retest:{protocolId:'a',attributeId:'TRACKING',metric:'x',kind:'RETEST',value:1,valid:true},
  direction:'HIGHER_IS_BETTER'
 }).eligible,false);
});
