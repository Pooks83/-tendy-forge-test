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

const auth=id=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
const get=async(mf,id)=>{const response=await mf.dispatchFetch('http://localhost/api/progress',{headers:auth(id)});return {status:response.status,data:await response.json(),cache:response.headers.get('cache-control')};};
const state=({week=0,day=1,cycle=0}={})=>JSON.stringify({version:2,pathId:'foundation',week,day,cycle,sets:{},rests:{},sessions:[],checks:[],evaluations:[],answers:{},safetyStopped:false});

async function player(db,{profileId,accountId,active=true,week=0,day=1,xp=10,attribute='TRACKING',units=10000}){
 const at='2026-09-13T12:00:00.000Z';
 await db.batch([
  db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,created_at,catches,experience,equipment_json,available_spaces_json,planned_days_json,mission_minutes,setup_status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(profileId,accountId,'Goalie','','10–12',state({week,day}),at,'left','developing','[]','["small-indoor"]','["monday"]',15,'ready',at),
  db.prepare('INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind(accountId,profileId,'guardian','active',at),
  db.prepare('INSERT INTO mission_instances(id,profile_id,mission_key,status,started_at,completed_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(`mi-${profileId}`,profileId,`foundation:${week}:${Math.max(0,day-1)}`,'COMPLETED',at,at,at),
 ]);
 if(active)await db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?)').bind(accountId,profileId,at).run();
 await db.prepare('INSERT INTO mission_completion_ledger VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(`c-${profileId}`,`mi-${profileId}`,profileId,'tf-progression-v1','tf-mission-generator-v1',xp,0,xp,1000,xp,xp*1000,'{"pathId":"foundation","week":0,"day":0,"cycle":0}',JSON.stringify({pathId:'foundation',week,day,cycle:0}),`op-${profileId}`,at).run();
 await db.prepare('INSERT INTO xp_ledger VALUES(?,?,?,?,?,?,?,?)').bind(`x-${profileId}`,profileId,`c-${profileId}`,`mission:mi-${profileId}`,xp,xp*1000,'tf-progression-v1',at).run();
 await db.prepare('INSERT INTO attribute_progress_ledger VALUES(?,?,?,?,?,?)').bind(`c-${profileId}`,profileId,attribute,units,'tf-progression-v1',at).run();
 await db.prepare('INSERT INTO reward_entitlements VALUES(?,?,?,?,?)').bind(profileId,'FIRST_SAVE',`c-${profileId}`,'tf-progression-v1',at).run();
}

test('progress endpoint returns only the active player authoritative development projection',async()=>{
 const {mf,db}=await setup();
 try{
  await player(db,{profileId:'p1',accountId:'parent'});
  const result=await get(mf,'parent');
  assert.equal(result.status,200);assert.equal(result.cache,'no-store');
  assert.equal(result.data.profileContextId,'p1');assert.equal(result.data.ruleVersion,'tf-progression-v1');assert.equal(result.data.totalXp,10);
  assert.deepEqual(result.data.attributes,{TRACKING:10,HANDS:0,BALANCE:0,EXPLOSIVENESS:0,STRENGTH:0,MOBILITY:0,CONDITIONING:0,MINDSET:0});
  assert.deepEqual(result.data.journey,{pathId:'foundation',week:0,day:1,cycle:0});
  assert.deepEqual(result.data.rewards,[{id:'FIRST_SAVE',awardedAt:'2026-09-13T12:00:00.000Z'}]);
  assert.deepEqual(result.data.recentCompletions,[{missionId:'foundation:0:0',completedAt:'2026-09-13T12:00:00.000Z',completedPrescribedMinutes:10,skippedPrescribedMinutes:0,xp:10,ruleVersion:'tf-progression-v1'}]);
  assert.equal(result.data.meaning,'Development work only — not a goalie ability or game-performance score.');
  assert.doesNotMatch(JSON.stringify(result.data),/parent@example|consent|nickname|adult/i);
 }finally{await mf.dispose();}
});

test('progress endpoint requires current active relationship and never leaks another player',async()=>{
 const {mf,db}=await setup();
 try{
  assert.equal((await get(mf,'nobody')).data.error.code,'PLAYER_CONTEXT_REQUIRED');
  await player(db,{profileId:'p1',accountId:'parent',xp:10,attribute:'TRACKING',units:10000});
  await player(db,{profileId:'p2',accountId:'parent',active:false,week:2,day:2,xp:7,attribute:'BALANCE',units:7000});
  let result=await get(mf,'parent');assert.equal(result.data.profileContextId,'p1');assert.equal(result.data.totalXp,10);assert.equal(result.data.attributes.BALANCE,0);
  await db.prepare('UPDATE active_player_context SET profile_id=? WHERE account_id=?').bind('p2','parent').run();
  result=await get(mf,'parent');assert.equal(result.data.profileContextId,'p2');assert.equal(result.data.totalXp,7);assert.equal(result.data.attributes.TRACKING,0);assert.equal(result.data.attributes.BALANCE,7);
  await db.prepare("UPDATE guardian_player SET status='revoked' WHERE account_id=? AND profile_id=?").bind('parent','p2').run();
  const revoked=await get(mf,'parent');assert.equal(revoked.status,403);assert.equal(revoked.data.error.code,'RELATIONSHIP_REVOKED');
 }finally{await mf.dispose();}
});
