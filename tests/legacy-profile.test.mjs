import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';

const statementBreak='--> statement-breakpoint';
const runMigration=(db,name)=>db.exec(readFileSync(new URL(`../drizzle/${name}`,import.meta.url),'utf8').replaceAll(statementBreak,';'));

test('legacy migration preserves profile history and coach grants while creating guardian recovery context',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 runMigration(db,'0000_slow_hellion.sql');
 const training=JSON.stringify({version:2,sessions:[{id:'saved-session'}],checks:[{note:'saved evidence'}]});
 db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,revision,created_at) VALUES(?,?,?,?,?,?,?,?)').run('legacy-1','adult-1','Legacy goalie','Saints','10–12',training,7,'2026-01-01T00:00:00Z');
 db.prepare('INSERT INTO training_coach_grants(profile_id,email) VALUES(?,?)').run('legacy-1','coach@example.test');
 runMigration(db,'0001_conscious_scarlet_witch.sql');
 runMigration(db,'0002_worried_shotgun.sql');
 const profile=db.prepare('SELECT id,state,revision,setup_status FROM training_profiles WHERE id=?').get('legacy-1');
 assert.deepEqual({...profile},{id:'legacy-1',state:training,revision:7,setup_status:'legacy-review-required'});
 assert.deepEqual({...db.prepare('SELECT account_id,profile_id,relationship,status FROM guardian_player').get()},{account_id:'adult-1',profile_id:'legacy-1',relationship:'guardian',status:'active'});
 assert.deepEqual({...db.prepare('SELECT account_id,profile_id FROM active_player_context').get()},{account_id:'adult-1',profile_id:'legacy-1'});
 assert.equal(db.prepare('SELECT email FROM training_coach_grants WHERE profile_id=?').get('legacy-1').email,'coach@example.test');
});

async function workerSetup(){
 const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
  const sql=await readFile(new URL(`../drizzle/${file}`,import.meta.url),'utf8');
  for(const statement of sql.split(statementBreak))if(statement.trim())await db.prepare(statement.trim()).run();
 }
 const now='2026-01-01T00:00:00Z';
 const state=JSON.stringify({version:2,pathId:'foundation',week:0,day:0,sets:{},rests:{},sessions:[{id:'saved-session'}],checks:[],evaluations:[],answers:{},safetyStopped:false});
 await db.batch([
  db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,revision,created_at) VALUES(?,?,?,?,?,?,?,?)').bind('legacy-1','adult-1','Legacy goalie','Saints','10–12',state,7,now),
  db.prepare('INSERT INTO training_coach_grants(profile_id,email) VALUES(?,?)').bind('legacy-1','coach@example.test'),
  db.prepare('INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind('adult-1','legacy-1','guardian','active',now),
  db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?)').bind('adult-1','legacy-1',now),
 ]);
 return {mf,db,state};
}

const setupInput={profileId:'legacy-1',nickname:'Legacy goalie',ageBand:'10–12',catches:'left',experience:'developing',equipment:[],plannedDays:['monday','thursday'],missionMinutes:25,consentAccepted:true,consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',optionalPermissions:{analytics:false,notifications:false,clips:false}};
const requestHeaders=(id,email,key)=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':email,'Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key});

test('legacy review preserves history and grants and only the owner can complete it',async()=>{
 const {mf,db,state}=await workerSetup();
 try{
  const before=await mf.dispatchFetch('http://localhost/api/player',{headers:requestHeaders('adult-1','adult@example.test','unused-key')});
  assert.equal(before.status,409);
  assert.equal((await before.json()).error.code,'SETUP_REVIEW_REQUIRED');
  const coach=await mf.dispatchFetch('http://localhost/api/onboarding',{method:'PATCH',headers:requestHeaders('coach-id','coach@example.test','coach-review-key'),body:JSON.stringify(setupInput)});
  assert.equal(coach.status,403);
  const reviewed=await mf.dispatchFetch('http://localhost/api/onboarding',{method:'PATCH',headers:requestHeaders('adult-1','adult@example.test','legacy-review-key'),body:JSON.stringify(setupInput)});
  assert.equal(reviewed.status,201);
  assert.deepEqual(await reviewed.json(),{profileId:'legacy-1',setupStatus:'ready'});
  const profile=await db.prepare('SELECT state,revision,setup_status,catches,mission_minutes FROM training_profiles WHERE id=?').bind('legacy-1').first();
  assert.deepEqual(profile,{state,revision:7,setup_status:'ready',catches:'left',mission_minutes:25});
  assert.equal((await db.prepare('SELECT count(*) AS n FROM training_coach_grants WHERE profile_id=?').bind('legacy-1').first()).n,1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM consent_records WHERE profile_id=?').bind('legacy-1').first()).n,1);
  const player=await mf.dispatchFetch('http://localhost/api/player',{headers:requestHeaders('adult-1','adult@example.test','unused-key')});
  assert.equal(player.status,200);
  assert.equal((await player.json()).profile.id,'legacy-1');
 }finally{await mf.dispose();}
});
