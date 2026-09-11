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
 const state={version:2,pathId:'foundation',week:0,day:0,cycle:0,sets:{},rests:{},sessions:[],checks:[{reviewedBy:'adult-1',note:'private adult note'}],evaluations:[{reviewedBy:'coach-1',note:'private coach note'}],answers:{},safetyStopped:false};
 const now='2026-09-10T00:00:00Z';
 await db.batch([
  db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,revision,created_at,catches,experience,equipment_json,planned_days_json,mission_minutes,setup_status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('p1','adult','Goalie','','10–12',JSON.stringify(state),0,now,'left','new','[]','["monday"]',15,'ready',now),
  db.prepare('INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind('adult','p1','guardian','active',now),
  db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?)').bind('adult','p1',now),
 ]);
 return {mf,db};
}

const headers=(user='adult',key='player-action-key')=>({'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`,'Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key});
const call=async(mf,body,user='adult',key='player-action-key')=>{
 const response=await mf.dispatchFetch('http://localhost/api/player-action',{method:'POST',headers:headers(user,key),body:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
};

test('player mutation uses server active context and returns only the child-safe projection',async()=>{
 const {mf}=await setup();
 try{
  const stopped=await call(mf,{revision:0,action:{type:'stop'}});
  assert.equal(stopped.status,200);
  assert.equal(stopped.data.training.safetyStopped,true);
  assert.equal(stopped.data.profile.id,'p1');
  const serialized=JSON.stringify(stopped.data);
  assert.equal(serialized.includes('private adult note'),false);
  assert.equal(serialized.includes('private coach note'),false);
  assert.equal(serialized.includes('reviewedBy'),false);
  const replay=await call(mf,{revision:0,action:{type:'stop'}},'adult','player-action-key');
  assert.deepEqual(replay.data,stopped.data);
 }finally{await mf.dispose();}
});

test('player mutation rejects client profile substitution and non-guardian access',async()=>{
 const {mf}=await setup();
 try{
  const substitution=await call(mf,{profileId:'other-player',revision:0,action:{type:'stop'}},'adult','substitute-key');
  assert.equal(substitution.status,400);
  assert.equal(substitution.data.error.code,'INVALID_ACTION');
  const outsider=await call(mf,{revision:0,action:{type:'stop'}},'outsider','outsider-key');
  assert.equal(outsider.status,409);
  assert.equal(outsider.data.error.code,'PLAYER_CONTEXT_REQUIRED');
 }finally{await mf.dispose();}
});
