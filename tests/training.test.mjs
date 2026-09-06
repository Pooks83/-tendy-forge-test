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
  assert.equal(engine.SKILLS?.length,30);
  for (const skill of engine.SKILLS) {
    assert.ok(engine.GROUPS.includes(skill.group),`${skill.name} group`);
    assert.ok(skill.cue?.length>=12,`${skill.name} child cue`);
    for (const path of engine.PATHS) assert.ok(skill.benchmarks?.[path.id]?.length>=12,`${skill.name} ${path.id} benchmark`);
  }
  const covered=new Set(engine.WEEKS.flatMap(w=>w.skills));
  for(const skill of engine.SKILLS) assert.ok(covered.has(skill.id),skill.name);
  assert.equal(engine.canAdvance({pathId:'foundation',checks:[],sessions:[],week:20}),false);
});

test('advancement requires accomplished evidence for every skill and two observed days per group',()=>{
  const checks=engine.SKILLS.flatMap(skill=>[
    {skillId:skill.id,group:skill.group,pathId:'foundation',passed:true,reviewedBy:'adult',date:'2026-08-01T12:00:00Z'},
  ]);
  assert.equal(engine.canAdvance({...engine.newTrainingState(),checks}),false);
  const secondDays=engine.GROUPS.map((group,index)=>({skillId:engine.SKILLS.find(s=>s.group===group).id,group,pathId:'foundation',passed:true,reviewedBy:'adult',date:`2026-09-${String(index+1).padStart(2,'0')}T12:00:00Z`}));
  assert.equal(engine.canAdvance({...engine.newTrainingState(),checks:[...checks,...secondDays]}),true);
});

test('evaluation protocol has ten repeatable off-ice sections',()=>{
  assert.equal(engine.EVALUATION_SECTIONS.length,10);
  for (const section of engine.EVALUATION_SECTIONS) {
    assert.ok(section.name && section.task && section.watchFor.length>=2);
    assert.equal(section.context,'off-ice');
  }
});

test('saved version-one progress is normalized without losing history',()=>{
  const old={...engine.newTrainingState(),version:1,sessions:[{id:'old',date:'2026-01-01',pathId:'foundation',week:0,day:0}]};
  delete old.rests;delete old.evaluations;
  const migrated=engine.normalizeTrainingState(old);
  assert.equal(migrated.version,2);
  assert.deepEqual(migrated.rests,{});
  assert.deepEqual(migrated.evaluations,[]);
  assert.equal(migrated.sessions[0].id,'old');
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
