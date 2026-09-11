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
 nickname:'Test goalie',ageBand:'10–12',catches:'left',experience:'developing',equipment:[],
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

async function callDraft(mf,{user='parent',method='GET',body,key='draft-operation-1'}={}){
 const headers=user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`}:{ };
 if(body){headers['Content-Type']='application/json';headers.Origin='http://localhost';headers['Idempotency-Key']=key;}
 if(method==='DELETE'){headers.Origin='http://localhost';headers['Idempotency-Key']=key;}
 const response=await mf.dispatchFetch('http://localhost/api/onboarding-draft',{method,headers,body:body?JSON.stringify(body):undefined});
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
  assert.deepEqual(profile,{nickname:'Test goalie',team:'',age_band:'10–12',catches:'left',experience:'developing',equipment_json:'[]',planned_days_json:'["monday","thursday"]',mission_minutes:25,setup_status:'ready'});
 }finally{await mf.dispose();}
});

test('household summary contains setup fields but not training state or consent detail',async()=>{
 const {mf}=await setup();
 try{
  await call(mf,{method:'POST',body:input,key:'create-goalie-2'});
  const result=await call(mf);
  assert.equal(result.status,200);
  assert.equal(result.data.profiles.length,1);
  assert.deepEqual(result.data.profiles[0],{id:result.data.profiles[0].id,nickname:'Test goalie',ageBand:'10–12',catches:'left',experience:'developing',equipment:[],plannedDays:['monday','thursday'],missionMinutes:25,setupStatus:'ready',active:true});
  assert.equal(JSON.stringify(result.data).includes('state'),false);
  assert.equal(JSON.stringify(result.data).includes('consentVersion'),false);
 }finally{await mf.dispose();}
});

test('household player limit remains atomic under concurrent creates',async()=>{
 const {mf,db}=await setup();
 try{
  const results=await Promise.all(Array.from({length:9},(_,index)=>call(mf,{method:'POST',body:{...input,nickname:`Goalie ${index+1}`},key:`concurrent-create-${index+1}`})));
  assert.equal(results.filter(result=>result.status===201).length,8);
  assert.equal(results.filter(result=>result.status===400&&result.data.error.code==='INVALID_SETUP').length,1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM training_profiles').first()).n,8);
 }finally{await mf.dispose();}
});

test('consented onboarding draft resumes only for the same adult account',async()=>{
 const {mf,db}=await setup();
 try{
  const rejected=await callDraft(mf,{method:'PUT',body:{step:'gear',consentAccepted:false}});
  assert.equal(rejected.status,403);
  assert.equal(rejected.data.error.code,'CONSENT_REQUIRED');
  const body={
   step:'gear',operationKey:'final-create-key-1',consentAccepted:true,
   consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',
   data:{nickname:'Finn',ageBand:'10–12',catches:'right',experience:'developing',equipment:[],plannedDays:[],missionMinutes:25,analyticsAllowed:false},
  };
  const saved=await callDraft(mf,{method:'PUT',body,key:'final-create-key-1'});
  assert.equal(saved.status,200);
  assert.deepEqual(saved.data.draft,body);
  const resumed=await callDraft(mf);
  assert.deepEqual(resumed.data.draft,body);
  const otherAdult=await callDraft(mf,{user:'other-parent'});
  assert.equal(otherAdult.status,200);
  assert.equal(otherAdult.data.draft,null);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM onboarding_drafts').first()).n,1);
 }finally{await mf.dispose();}
});

test('completed onboarding removes its recovery draft atomically',async()=>{
 const {mf,db}=await setup();
 try{
  await callDraft(mf,{method:'PUT',key:'final-create-key-2',body:{
   step:'training-plan',operationKey:'final-create-key-2',consentAccepted:true,
   consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',
   data:{nickname:'Finn',ageBand:'10–12',catches:'right',experience:'developing',equipment:[],plannedDays:['monday'],missionMinutes:25,analyticsAllowed:false},
  }});
  const created=await call(mf,{method:'POST',body:{...input,nickname:'Finn'},key:'final-create-key-2'});
  assert.equal(created.status,201);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM onboarding_drafts').first()).n,0);
  const lateRetry=await callDraft(mf,{method:'PUT',key:'final-create-key-2',body:{
   step:'training-plan',operationKey:'final-create-key-2',consentAccepted:true,
   consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',
   data:{nickname:'Finn',ageBand:'10–12',catches:'right',experience:'developing',equipment:[],plannedDays:['monday'],missionMinutes:25,analyticsAllowed:false},
  }});
  assert.equal(lateRetry.status,200);
  assert.equal(lateRetry.data.draft,null);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM onboarding_drafts').first()).n,0);
 }finally{await mf.dispose();}
});

test('leaving consented setup removes only that adult account draft',async()=>{
 const {mf,db}=await setup();
 try{
  const draft=account=>({step:'create-goalie',operationKey:`${account}-draft-key`,consentAccepted:true,consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',data:{nickname:'',ageBand:'',catches:'left',experience:'new',equipment:[],plannedDays:[],missionMinutes:25,analyticsAllowed:false}});
  await callDraft(mf,{user:'parent',method:'PUT',key:'parent-draft-key',body:draft('parent')});
  await callDraft(mf,{user:'other',method:'PUT',key:'other-draft-key',body:draft('other')});
  const removed=await callDraft(mf,{user:'parent',method:'DELETE',key:'parent-draft-key'});
  assert.equal(removed.status,200);
  assert.deepEqual(removed.data,{draft:null});
  assert.equal((await db.prepare("SELECT count(*) AS n FROM onboarding_drafts WHERE account_id='parent'").first()).n,0);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM onboarding_drafts WHERE account_id='other'").first()).n,1);
 }finally{await mf.dispose();}
});

test('an outdated consent draft is not returned to the setup UI',async()=>{
 const {mf,db}=await setup();
 try{
  await db.prepare('INSERT INTO onboarding_drafts(account_id,step,draft_json,operation_key,consent_version,policy_version,permission_accepted_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('parent','gear','{"nickname":"Old child data"}','old-draft-key','old-consent','old-policy','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z').run();
  const response=await callDraft(mf);
  assert.equal(response.status,200);
  assert.equal(response.data.draft,null);
 }finally{await mf.dispose();}
});
