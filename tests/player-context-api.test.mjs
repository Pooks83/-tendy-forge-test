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

const setupInput=nickname=>({nickname,ageBand:'8–10',catches:'left',experience:'developing',equipment:[],plannedDays:['monday'],missionMinutes:15,consentAccepted:true,consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',optionalPermissions:{analytics:false,notifications:false,clips:false}});
const headers=(user,key)=>({'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`,...(key?{'Content-Type':'application/json',Origin:'http://localhost','Idempotency-Key':key}:{})});

async function create(mf,user,nickname,key){
 const response=await mf.dispatchFetch('http://localhost/api/onboarding',{method:'POST',headers:headers(user,key),body:JSON.stringify(setupInput(nickname))});
 assert.equal(response.status,201);
 return response.json();
}

async function setContext(mf,user,profileId,key){
 const response=await mf.dispatchFetch('http://localhost/api/player-context',{method:'POST',headers:headers(user,key),body:JSON.stringify({profileId})});
 return {status:response.status,data:await response.json()};
}

async function getPlayer(mf,user){
 const response=await mf.dispatchFetch('http://localhost/api/player',{headers:headers(user)});
 return {status:response.status,data:await response.json()};
}

test('player context requires a signed-in guardian and rejects cross-household substitution',async()=>{
 const {mf}=await setup();
 try{
  const owner=await create(mf,'parent-a','Goalie A','create-a');
  const unauthenticated=await mf.dispatchFetch('http://localhost/api/player');
  assert.equal(unauthenticated.status,401);
  assert.equal((await unauthenticated.json()).error.code,'UNAUTHENTICATED');
  const attack=await setContext(mf,'parent-b',owner.profileId,'context-attack');
  assert.equal(attack.status,403);
  assert.equal(attack.data.error.code,'FORBIDDEN');
 }finally{await mf.dispose();}
});

test('missing or revoked player context returns a recovery-safe canonical error',async()=>{
 const {mf,db}=await setup();
 try{
  const missing=await getPlayer(mf,'parent-a');
  assert.equal(missing.status,409);
  assert.equal(missing.data.error.code,'PLAYER_CONTEXT_REQUIRED');
  const created=await create(mf,'parent-a','Goalie A','create-revoke');
  await db.prepare("UPDATE guardian_player SET status='revoked',revoked_at=? WHERE account_id=? AND profile_id=?").bind('2026-09-10T00:00:00Z','parent-a',created.profileId).run();
  const revoked=await setContext(mf,'parent-a',created.profileId,'context-revoked');
  assert.equal(revoked.status,403);
  assert.equal(revoked.data.error.code,'RELATIONSHIP_REVOKED');
 }finally{await mf.dispose();}
});

test('two-child switching is atomic idempotent and returns only the selected child projection',async()=>{
 const {mf,db}=await setup();
 try{
  const a=await create(mf,'parent-a','Goalie A','create-player-a');
  const b=await create(mf,'parent-a','Goalie B','create-player-b');
  const selectedA=await setContext(mf,'parent-a',a.profileId,'context-player-a');
  assert.equal(selectedA.status,200);
  assert.equal(selectedA.data.profile.nickname,'Goalie A');
  const selectedB=await setContext(mf,'parent-a',b.profileId,'context-player-b');
  assert.equal(selectedB.status,200);
  assert.equal(selectedB.data.profile.nickname,'Goalie B');
  assert.equal(JSON.stringify(selectedB.data).includes('Goalie A'),false);
  const repeated=await setContext(mf,'parent-a',b.profileId,'context-player-b');
  assert.equal(repeated.status,200);
  assert.deepEqual(repeated.data,selectedB.data);
  const current=await getPlayer(mf,'parent-a');
  assert.equal(current.status,200);
  assert.deepEqual(current.data,selectedB.data);
  const context=await db.prepare('SELECT profile_id FROM active_player_context WHERE account_id=?').bind('parent-a').first();
  assert.equal(context.profile_id,b.profileId);
  const audit=await db.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='ACTIVE_PLAYER_CHANGED'").first();
  assert.equal(audit.n,2);
 }finally{await mf.dispose();}
});
