import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';

async function setup(analyticsAllowed=true){
 const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
  const sql=await readFile(new URL(`../drizzle/${file}`,import.meta.url),'utf8');
  for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement.trim()).run();
 }
 const now='2026-09-11T00:00:00.000Z';
 await db.batch([
  db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,revision,created_at,catches,experience,equipment_json,planned_days_json,mission_minutes,setup_status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('p1','adult','Private Nickname','','10–12',JSON.stringify({version:2,pathId:'foundation',week:0,day:0,cycle:0,sets:{},rests:{},sessions:[],checks:[],evaluations:[],answers:{},safetyStopped:false}),0,now,'left','new','[]','["monday"]',15,'ready',now),
  db.prepare('INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind('adult','p1','guardian','active',now),
  db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?)').bind('adult','p1',now),
  db.prepare('INSERT INTO privacy_preferences(profile_id,analytics_allowed,notifications_allowed,clips_allowed,updated_at) VALUES(?,?,?,?,?)').bind('p1',analyticsAllowed?1:0,0,0,now),
 ]);
 return {mf,db};
}

const call=async(mf,eventName,key='event-operation-1')=>{
 const response=await mf.dispatchFetch('http://localhost/api/player-event',{method:'POST',headers:{'oai-authenticated-user-id':'adult','oai-authenticated-user-email':'adult@example.test','Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key},body:JSON.stringify({eventName})});
 return {status:response.status,data:await response.json()};
};

test('Today and mission-start events are once-only per authoritative mission',async()=>{
 const {mf,db}=await setup(true);
 try{
  const viewed=await call(mf,'today_viewed','today-operation-1');
  assert.equal(viewed.status,201);
  assert.equal(viewed.data.recorded,true);
  const retried=await call(mf,'today_viewed','today-operation-2');
  assert.equal(retried.status,200);
  assert.deepEqual(retried.data,viewed.data);
  const started=await call(mf,'mission_started','mission-operation-1');
  assert.equal(started.status,201);
  const events=await db.prepare('SELECT event_name,logical_key,metadata_json FROM product_events ORDER BY event_name').all();
  assert.equal(events.results.length,2);
  assert.deepEqual(events.results.map(event=>event.event_name),['mission_started','today_viewed']);
  assert.equal(JSON.stringify(events.results).includes('Private Nickname'),false);
  assert.equal(JSON.stringify(events.results).includes('adult@example.test'),false);
 }finally{await mf.dispose();}
});

test('declined analytics returns a successful no-op and stores nothing',async()=>{
 const {mf,db}=await setup(false);
 try{
  const result=await call(mf,'today_viewed','declined-operation-1');
  assert.equal(result.status,200);
  assert.deepEqual(result.data,{recorded:false,eventName:'today_viewed'});
  assert.equal((await db.prepare('SELECT count(*) AS n FROM product_events').first()).n,0);
 }finally{await mf.dispose();}
});

test('player event endpoint rejects unknown events and revoked relationships',async()=>{
 const {mf,db}=await setup(true);
 try{
  const unknown=await call(mf,'nickname_changed','unknown-event-1');
  assert.equal(unknown.status,400);
  await db.prepare("UPDATE guardian_player SET status='revoked' WHERE account_id='adult' AND profile_id='p1'").run();
  const revoked=await call(mf,'today_viewed','revoked-event-1');
  assert.equal(revoked.status,403);
  assert.equal(revoked.data.error.code,'RELATIONSHIP_REVOKED');
 }finally{await mf.dispose();}
});
