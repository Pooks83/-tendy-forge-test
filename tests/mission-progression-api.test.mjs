import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {seedPublishedContent} from './helpers/training-content-fixture.mjs';

async function setup(){
 const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
  const sql=await readFile(new URL(`../drizzle/${file}`,import.meta.url),'utf8');
  for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement.trim()).run();
 }
 await seedPublishedContent(db);return {mf,db};
}

const auth={'oai-authenticated-user-id':'parent','oai-authenticated-user-email':'parent@example.test'};
const post=async(mf,path,body,key)=>{const response=await mf.dispatchFetch(`http://localhost${path}`,{method:'POST',headers:{...auth,'Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
const get=async(mf,path)=>{const response=await mf.dispatchFetch(`http://localhost${path}`,{headers:auth});return {status:response.status,data:await response.json()};};

async function readyPlayer(mf,db){
 const setup={nickname:'Goalie',ageBand:'10–12',catches:'left',experience:'new',equipment:[],plannedDays:['monday'],missionMinutes:15,consentAccepted:true,consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',optionalPermissions:{analytics:true,notifications:false,clips:false}};
 const created=await post(mf,'/api/onboarding',setup,'progression-player');const profileId=created.data.profileId;const now='2026-09-13T12:00:00.000Z';
 await db.prepare('UPDATE training_profiles SET available_spaces_json=? WHERE id=?').bind('["small-indoor"]',profileId).run();
 await db.prepare('INSERT INTO first_challenge_results(profile_id,protocol_version,status,started_at,completed_at,result_json,updated_at) VALUES(?,?,?,?,?,?,?)').bind(profileId,'tf-first-ready-v1','completed',now,now,'{"completedSeconds":60,"claim":"completed"}',now).run();
 return profileId;
}

async function started(mf,key){return (await post(mf,'/api/mission',{action:'start'},key)).data;}
async function terminalize(db,mission,statuses){
 for(let index=0;index<statuses.length;index++)await db.prepare('UPDATE activity_instances SET status=?,completed_at=?,updated_at=? WHERE mission_instance_id=? AND ordinal=?').bind(statuses[index],'2026-09-13T12:05:00.000Z','2026-09-13T12:05:00.000Z',mission.id,index).run();
}
const completeBody=(mission,profileId)=>({action:'complete-mission',missionId:mission.missionId,profileContextId:profileId,revision:mission.revision});

test('eligible completion atomically awards prescribed XP attributes journey and First Save once',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);const first=await started(mf,'start-first');await terminalize(db,first,first.activities.map(()=>'COMPLETED'));
  const expectedXp=first.executionSnapshot.blocks.reduce((sum,block)=>sum+block.minutes,0);const body=completeBody(first,profileId);
  const [a,b]=await Promise.all([post(mf,'/api/mission',body,'complete-first-a'),post(mf,'/api/mission',body,'complete-first-b')]);
  assert.deepEqual([a.status,b.status],[200,200]);assert.deepEqual(a.data,b.data);
  assert.equal(a.data.status,'completed');assert.equal(a.data.completionSummary.xp,expectedXp);assert.equal(a.data.completionSummary.newReward,'FIRST_SAVE');
  assert.deepEqual(a.data.completionSummary.journeyAfter,{pathId:'foundation',week:0,day:1,cycle:0});
  assert.equal((await db.prepare('SELECT count(*) AS n FROM mission_completion_ledger').first()).n,1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM xp_ledger').first()).n,1);
  assert.equal((await db.prepare('SELECT SUM(amount_units) AS n FROM attribute_progress_ledger').first()).n,expectedXp*1000);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM reward_entitlements').first()).n,1);
  const progress=(await get(mf,'/api/progress')).data;assert.equal(progress.totalXp,expectedXp);assert.deepEqual(progress.journey,{pathId:'foundation',week:0,day:1,cycle:0});

  const second=await started(mf,'start-second');await terminalize(db,second,second.activities.map(()=>'COMPLETED'));
  const completedSecond=await post(mf,'/api/mission',completeBody(second,profileId),'complete-second');
  assert.equal(completedSecond.status,200);assert.equal(completedSecond.data.completionSummary.newReward,null);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM mission_completion_ledger').first()).n,2);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM reward_entitlements').first()).n,1);
  assert.deepEqual(completedSecond.data.completionSummary.journeyAfter,{pathId:'foundation',week:0,day:2,cycle:0});
 }finally{await mf.dispose();}
});

test('skipped work earns zero and an all-skipped mission advances without First Save',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);const mission=await started(mf,'start-skipped');await terminalize(db,mission,mission.activities.map(()=>'SKIPPED'));
  const completed=await post(mf,'/api/mission',completeBody(mission,profileId),'complete-skipped');
  assert.equal(completed.status,200);assert.equal(completed.data.completionSummary.xp,0);assert.equal(completed.data.completionSummary.newReward,null);
  assert.equal((await db.prepare('SELECT SUM(amount) AS n FROM xp_ledger').first()).n,0);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM attribute_progress_ledger').first()).n,0);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM reward_entitlements').first()).n,0);
  assert.deepEqual(completed.data.completionSummary.journeyAfter,{pathId:'foundation',week:0,day:1,cycle:0});
 }finally{await mf.dispose();}
});

test('missing canonical attributes and transaction failure leave the entire completion package unchanged',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);const missing=await started(mf,'start-missing');await terminalize(db,missing,missing.activities.map(()=>'COMPLETED'));
  const snapshot={...missing.executionSnapshot,blocks:missing.executionSnapshot.blocks.map((block,index)=>index===0?{...block,developmentAttributeIds:[]}:block)};
  await db.prepare('UPDATE mission_instances SET execution_snapshot_json=? WHERE id=?').bind(JSON.stringify(snapshot),missing.id).run();
  const blocked=await post(mf,'/api/mission',completeBody(missing,profileId),'complete-missing');assert.equal(blocked.status,409);assert.equal(blocked.data.error.code,'PROGRESSION_CONFIG_REQUIRED');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM mission_completion_ledger').first()).n,0);
  assert.equal((await db.prepare('SELECT status FROM mission_instances WHERE id=?').bind(missing.id).first()).status,'IN_PROGRESS');

  await db.prepare('UPDATE mission_instances SET execution_snapshot_json=? WHERE id=?').bind(JSON.stringify(missing.executionSnapshot),missing.id).run();
  await db.prepare("CREATE TRIGGER force_xp_failure BEFORE INSERT ON xp_ledger BEGIN SELECT RAISE(ABORT,'forced progression failure'); END").run();
  const profileBefore=await db.prepare('SELECT state,revision FROM training_profiles WHERE id=?').bind(profileId).first();
  const failed=await post(mf,'/api/mission',completeBody(missing,profileId),'complete-failed');assert.equal(failed.status,503);
  const profileAfter=await db.prepare('SELECT state,revision FROM training_profiles WHERE id=?').bind(profileId).first();assert.deepEqual(profileAfter,profileBefore);
  assert.equal((await db.prepare('SELECT status FROM mission_instances WHERE id=?').bind(missing.id).first()).status,'IN_PROGRESS');
  for(const table of ['mission_completion_ledger','xp_ledger','attribute_progress_ledger','reward_entitlements'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0,table);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='MISSION_COMPLETE_MISSION'").first()).n,0);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM idempotency_records WHERE operation_key='complete-failed'").first()).n,0);
 }finally{await mf.dispose();}
});

test('end-of-program completion rolls the cycle without changing the development path',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);const row=await db.prepare('SELECT state FROM training_profiles WHERE id=?').bind(profileId).first();
  await db.prepare('UPDATE training_profiles SET state=? WHERE id=?').bind(JSON.stringify({...JSON.parse(row.state),pathId:'foundation',week:19,day:2,cycle:2}),profileId).run();
  const mission=await started(mf,'start-cycle');await terminalize(db,mission,mission.activities.map(()=>'COMPLETED'));
  const completed=await post(mf,'/api/mission',completeBody(mission,profileId),'complete-cycle');
  assert.equal(completed.status,200);assert.deepEqual(completed.data.completionSummary.journeyAfter,{pathId:'foundation',week:0,day:0,cycle:3});
  const saved=JSON.parse((await db.prepare('SELECT state FROM training_profiles WHERE id=?').bind(profileId).first()).state);
  assert.deepEqual({pathId:saved.pathId,week:saved.week,day:saved.day,cycle:saved.cycle},{pathId:'foundation',week:0,day:0,cycle:3});
 }finally{await mf.dispose();}
});

test('legacy mission completion records history without invented progression or journey movement',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);const mission=await started(mf,'start-legacy');await terminalize(db,mission,mission.activities.map(()=>'COMPLETED'));
  await db.prepare('UPDATE mission_instances SET content_version=? WHERE id=?').bind('tf-curriculum-v1',mission.id).run();
  const completed=await post(mf,'/api/mission',completeBody(mission,profileId),'complete-legacy');
  assert.equal(completed.status,200);assert.equal(completed.data.completionSummary.classification,'LEGACY_UNCREDITED');assert.equal(completed.data.completionSummary.xp,0);
  assert.deepEqual(completed.data.completionSummary.journeyAfter,{pathId:'foundation',week:0,day:0,cycle:0});
  for(const table of ['mission_completion_ledger','xp_ledger','attribute_progress_ledger','reward_entitlements'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0,table);
 }finally{await mf.dispose();}
});
