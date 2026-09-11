import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';

async function setup(){
 const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
  const sql=await readFile(new URL(`../drizzle/${file}`,import.meta.url),'utf8');
  for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement.trim()).run();
 }
 return {mf,db};
}

const auth={'oai-authenticated-user-id':'parent','oai-authenticated-user-email':'parent@example.test'};
const post=async(mf,path,body,key)=>{
 const response=await mf.dispatchFetch(`http://localhost${path}`,{method:'POST',headers:{...auth,'Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key},body:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
};
const get=async(mf,path)=>{const response=await mf.dispatchFetch(`http://localhost${path}`,{headers:auth});return {status:response.status,data:await response.json()};};
const setupInput=analytics=>({nickname:'Goalie',ageBand:'10–12',catches:'left',experience:'new',equipment:[],plannedDays:['monday'],missionMinutes:15,consentAccepted:true,consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',optionalPermissions:{analytics,notifications:false,clips:false}});

test('GJ-01 persists challenge completion and first mission start exactly once',async()=>{
 const {mf,db}=await setup();
 try{
  const created=await post(mf,'/api/onboarding',setupInput(true),'gj-create-1');
  assert.equal(created.status,201);
  assert.equal((await post(mf,'/api/first-challenge',{action:'start'},'gj-challenge-start')).status,201);
  await db.prepare("UPDATE first_challenge_results SET started_at=datetime('now','-61 seconds') WHERE profile_id=?").bind(created.data.profileId).run();
  assert.equal((await post(mf,'/api/first-challenge',{action:'complete'},'gj-challenge-complete')).status,200);
  const ready=await get(mf,'/api/first-challenge');
  assert.equal(ready.data.status,'completed');
  assert.equal(ready.data.missionStatus,'not-started');
  const started=await post(mf,'/api/mission',{action:'start'},'gj-mission-start-1');
  assert.equal(started.status,201);
  assert.equal(started.data.status,'in-progress');
  const replay=await post(mf,'/api/mission',{action:'start'},'gj-mission-start-2');
  assert.equal(replay.status,200);
  assert.deepEqual(replay.data,started.data);
  const resumed=await get(mf,'/api/first-challenge');
  assert.equal(resumed.data.missionStatus,'in-progress');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM mission_instances').first()).n,1);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM product_events WHERE event_name='mission_started'").first()).n,1);
 }finally{await mf.dispose();}
});

test('mission start remains authoritative when optional analytics is declined',async()=>{
 const {mf,db}=await setup();
 try{
  const created=await post(mf,'/api/onboarding',setupInput(false),'gj-create-no-analytics');
  await post(mf,'/api/first-challenge',{action:'start'},'gj-start-no-analytics');
  await db.prepare("UPDATE first_challenge_results SET started_at=datetime('now','-61 seconds') WHERE profile_id=?").bind(created.data.profileId).run();
  await post(mf,'/api/first-challenge',{action:'complete'},'gj-complete-no-analytics');
  const started=await post(mf,'/api/mission',{action:'start'},'gj-mission-no-analytics');
  assert.equal(started.status,201);
  assert.equal(started.data.status,'in-progress');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM mission_instances').first()).n,1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM product_events').first()).n,0);
 }finally{await mf.dispose();}
});

test('mission start is blocked before challenge completion, during a safety stop, and after relationship revocation',async()=>{
 const {mf,db}=await setup();
 try{
  const created=await post(mf,'/api/onboarding',setupInput(true),'gj-create-blocks');
  const tooSoon=await post(mf,'/api/mission',{action:'start'},'gj-mission-too-soon');
  assert.equal(tooSoon.status,409);
  assert.equal(tooSoon.data.error.code,'INVALID_STATE_TRANSITION');
  await post(mf,'/api/first-challenge',{action:'start'},'gj-blocks-start');
  await db.prepare("UPDATE first_challenge_results SET started_at=datetime('now','-61 seconds') WHERE profile_id=?").bind(created.data.profileId).run();
  await post(mf,'/api/first-challenge',{action:'complete'},'gj-blocks-complete');
  const row=await db.prepare('SELECT state FROM training_profiles WHERE id=?').bind(created.data.profileId).first();
  await db.prepare('UPDATE training_profiles SET state=? WHERE id=?').bind(JSON.stringify({...JSON.parse(row.state),safetyStopped:true}),created.data.profileId).run();
  const stopped=await post(mf,'/api/mission',{action:'start'},'gj-mission-stopped');
  assert.equal(stopped.status,409);
  assert.equal(stopped.data.error.code,'SAFETY_STOPPED');
  await db.prepare('UPDATE training_profiles SET state=? WHERE id=?').bind(JSON.stringify({...JSON.parse(row.state),safetyStopped:false}),created.data.profileId).run();
  await db.prepare("UPDATE guardian_player SET status='revoked' WHERE account_id='parent' AND profile_id=?").bind(created.data.profileId).run();
  const revoked=await post(mf,'/api/mission',{action:'start'},'gj-mission-revoked');
  assert.equal(revoked.status,403);
  assert.equal(revoked.data.error.code,'RELATIONSHIP_REVOKED');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM mission_instances').first()).n,0);
 }finally{await mf.dispose();}
});
