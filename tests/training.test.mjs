import test from 'node:test';
import assert from 'node:assert/strict';
const engine = await import('../lib/training.mjs').catch(() => ({}));
test('20 weeks keep every path at its fixed duration and all drills off ice', () => {
  assert.equal(typeof engine.buildSession, 'function');
  for (const path of engine.PATHS) for (let w=0;w<20;w++) for(let day=0;day<path.days;day++) {
    const session=engine.buildSession(path.id,w,day);
    assert.equal(session.blocks.reduce((n,b)=>n+b.minutes,0),path.minutes);
    assert.ok(path.minutes>=30 && path.minutes<=60);
    for(const b of session.blocks) {
      assert.equal(b.offIce,true);
      assert.ok(b.steps.length>=3 && b.setup && b.cue && b.target && b.restSeconds>=0);
    }
  }
});
test('curriculum covers every declared skill; advancement requires evidence, not elapsed weeks',()=>{
  assert.ok(engine.SKILLS?.length>=30);
  const covered=new Set(engine.WEEKS.flatMap(w=>w.skills));
  for(const skill of engine.SKILLS) assert.ok(covered.has(skill.id),skill.name);
  assert.equal(engine.canAdvance({pathId:'foundation',checks:[],sessions:[],week:20}),false);
});
test('drill completion is idempotent and safety stops block completion',()=>{
  assert.equal(typeof engine.recordSet,'function');
  const state=engine.newTrainingState();
  const session=engine.buildSession('foundation',0,0);
  const one=engine.recordSet(state,session,session.blocks[0].id,0);
  assert.deepEqual(engine.recordSet(one,session,session.blocks[0].id,0),one);
  assert.throws(()=>engine.recordSet({...state,safetyStopped:true},session,session.blocks[0].id,0),/paused/i);
  assert.throws(()=>engine.recordSet(state,session,'unknown',0),/drill/i);
});
