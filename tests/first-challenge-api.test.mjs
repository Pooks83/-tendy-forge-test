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
 const now='2026-09-10T00:00:00.000Z';
 await db.batch([
  db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,revision,created_at,catches,experience,equipment_json,planned_days_json,mission_minutes,setup_status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('p1','adult','Goalie','','10–12',JSON.stringify({version:2,pathId:'foundation',week:0,day:0,sets:{},rests:{},sessions:[],checks:[],evaluations:[],answers:{},safetyStopped:false}),0,now,'left','new','[]','["monday"]',15,'ready',now),
  db.prepare('INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind('adult','p1','guardian','active',now),
  db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?)').bind('adult','p1',now),
 ]);
 return {mf,db};
}

const headers=key=>({'oai-authenticated-user-id':'adult','oai-authenticated-user-email':'adult@example.test','Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key});
const call=async(mf,action,key)=>{
 const response=await mf.dispatchFetch('http://localhost/api/first-challenge',{method:action?'POST':'GET',headers:action?headers(key):headers(key),body:action?JSON.stringify({action}):undefined});
 return {status:response.status,data:await response.json()};
};

test('first challenge start and completion are authoritative and idempotent',async()=>{
 const {mf,db}=await setup();
 try{
  const empty=await call(mf);
  assert.deepEqual(empty.data,{status:'not-started',protocolVersion:'tf-first-ready-v1'});
  const started=await call(mf,'start','start-key-1');
  assert.equal(started.status,201);
  assert.equal(started.data.status,'active');
  const replay=await call(mf,'start','start-key-1');
  assert.deepEqual(replay.data,started.data);
  await db.prepare("UPDATE first_challenge_results SET started_at=datetime('now','-61 seconds') WHERE profile_id='p1'").run();
  const completed=await call(mf,'complete','complete-1');
  assert.equal(completed.status,200);
  assert.deepEqual(completed.data.result,{completedSeconds:60,claim:'completed'});
  const repeated=await call(mf,'complete','complete-2');
  assert.deepEqual(repeated.data,completed.data);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type LIKE 'FIRST_CHALLENGE_%'").first()).n,2);
 }finally{await mf.dispose();}
});

test('first challenge rejects early completion and cross-household context',async()=>{
 const {mf,db}=await setup();
 try{
  await call(mf,'start','start-key-2');
  const early=await call(mf,'complete','complete-early');
  assert.equal(early.status,409);
  assert.equal(early.data.error.code,'CHALLENGE_IN_PROGRESS');
  await db.prepare("UPDATE guardian_player SET status='revoked' WHERE account_id='adult' AND profile_id='p1'").run();
  const revoked=await call(mf);
  assert.equal(revoked.status,403);
  assert.equal(revoked.data.error.code,'RELATIONSHIP_REVOKED');
 }finally{await mf.dispose();}
});
