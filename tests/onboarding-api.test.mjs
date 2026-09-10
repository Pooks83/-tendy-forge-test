import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';

async function setup(){
 const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
 const db=await mf.getD1Database('DB');
 const files=(await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
 for(const file of files){
  const sql=await readFile(new URL(`../drizzle/${file}`,import.meta.url),'utf8');
  for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement.trim()).run();
 }
 return {mf,db};
}

const input={
 nickname:'Test goalie',ageBand:'8–10',catches:'left',experience:'developing',equipment:[],
 plannedDays:['monday','thursday'],missionMinutes:25,consentAccepted:true,
 consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',
 optionalPermissions:{analytics:false,notifications:false,clips:false},
};

async function call(mf,{user='parent',method='GET',body,key='operation-1'}={}){
 const headers=user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`}:{};
 if(body){headers['Content-Type']='application/json';headers.Origin='http://localhost';headers['Idempotency-Key']=key;}
 const response=await mf.dispatchFetch('http://localhost/api/onboarding',{method,headers,body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json()};
}

test('onboarding requires adult identity and versioned parental consent',async()=>{
 const {mf}=await setup();
 try{
  const unauthenticated=await call(mf,{user:null});
  assert.equal(unauthenticated.status,401);
  assert.equal(unauthenticated.data.error.code,'UNAUTHENTICATED');
  const noConsent=await call(mf,{method:'POST',body:{...input,consentAccepted:false}});
  assert.equal(noConsent.status,403);
  assert.equal(noConsent.data.error.code,'CONSENT_REQUIRED');
 }finally{await mf.dispose();}
});

test('onboarding atomically creates profile relationship consent preferences context audit and idempotency',async()=>{
 const {mf,db}=await setup();
 try{
  const created=await call(mf,{method:'POST',body:input,key:'create-goalie-1'});
  assert.equal(created.status,201);
  assert.equal(created.data.setupStatus,'ready');
  assert.ok(created.data.profileId);
  const repeated=await call(mf,{method:'POST',body:input,key:'create-goalie-1'});
  assert.equal(repeated.status,200);
  assert.deepEqual(repeated.data,created.data);
  for(const table of ['training_profiles','guardian_player','consent_records','privacy_preferences','active_player_context','audit_events','idempotency_records']){
   const count=await db.prepare(`SELECT count(*) AS n FROM ${table}`).first();
   assert.equal(count.n,1,table);
  }
  const profile=await db.prepare('SELECT nickname,team,age_band,catches,experience,equipment_json,planned_days_json,mission_minutes,setup_status FROM training_profiles WHERE id=?').bind(created.data.profileId).first();
  assert.deepEqual(profile,{nickname:'Test goalie',team:'',age_band:'8–10',catches:'left',experience:'developing',equipment_json:'[]',planned_days_json:'["monday","thursday"]',mission_minutes:25,setup_status:'ready'});
 }finally{await mf.dispose();}
});

test('household summary contains setup fields but not training state or consent detail',async()=>{
 const {mf}=await setup();
 try{
  await call(mf,{method:'POST',body:input,key:'create-goalie-2'});
  const result=await call(mf);
  assert.equal(result.status,200);
  assert.equal(result.data.profiles.length,1);
  assert.deepEqual(result.data.profiles[0],{id:result.data.profiles[0].id,nickname:'Test goalie',ageBand:'8–10',catches:'left',experience:'developing',equipment:[],plannedDays:['monday','thursday'],missionMinutes:25,setupStatus:'ready',active:true});
  assert.equal(JSON.stringify(result.data).includes('state'),false);
  assert.equal(JSON.stringify(result.data).includes('consentVersion'),false);
 }finally{await mf.dispose();}
});
