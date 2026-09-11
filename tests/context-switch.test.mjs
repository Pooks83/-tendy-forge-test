import test from 'node:test';
import assert from 'node:assert/strict';

const keys=await import('../lib/context-switch.mjs').catch(()=>({}));

test('ambiguous context-switch retry reuses its operation key until success',()=>{
 assert.equal(typeof keys.contextSwitchOperationKey,'function');
 const pending=new Map();
 let sequence=0;
 const create=()=>`context-key-${++sequence}`;
 const first=keys.contextSwitchOperationKey(pending,'player-b',create);
 const retry=keys.contextSwitchOperationKey(pending,'player-b',create);
 assert.equal(retry,first);
 assert.equal(sequence,1);
 keys.completeContextSwitch(pending,'player-b');
 assert.notEqual(keys.contextSwitchOperationKey(pending,'player-b',create),first);
});
