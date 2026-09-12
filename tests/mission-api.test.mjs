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
const setupInput=nickname=>({nickname,ageBand:'10–12',catches:'left',experience:'new',equipment:[],plannedDays:['monday'],missionMinutes:15,consentAccepted:true,consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',optionalPermissions:{analytics:true,notifications:false,clips:false}});
const post=async(mf,path,body,key,headers=auth)=>{const response=await mf.dispatchFetch(`http://localhost${path}`,{method:'POST',headers:{...headers,'Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
const get=async(mf,path)=>{const response=await mf.dispatchFetch(`http://localhost${path}`,{headers:auth});return {status:response.status,data:await response.json()};};

async function readyPlayer(mf,db,nickname='Goalie',key='mission-player'){
 const created=await post(mf,'/api/onboarding',setupInput(nickname),`${key}-create`);
 const now='2026-09-11T12:00:00.000Z';
 await db.prepare("INSERT INTO first_challenge_results(profile_id,protocol_version,status,started_at,completed_at,result_json,updated_at) VALUES(?,?,?,?,?,?,?)").bind(created.data.profileId,'tf-first-ready-v1','completed',now,now,'{"completedSeconds":60,"claim":"completed"}',now).run();
 return created.data.profileId;
}

test('mission start snapshots ordered execution and GET returns the authoritative projection',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);
  const started=await post(mf,'/api/mission',{action:'start'},'mission-start-1');
  assert.equal(started.status,201);
  assert.equal(started.data.status,'in-progress');
  assert.equal(started.data.profileContextId,profileId);
  assert.equal(started.data.revision,1);
  assert.equal(started.data.contentVersion,'tf-curriculum-v1');
  assert.deepEqual(started.data.activities.map(item=>item.ordinal),[0,1,2,3,4,5]);
  assert.equal(started.data.activities[0].status,'ready');
  const row=await db.prepare('SELECT execution_snapshot_json,current_activity_index,revision FROM mission_instances WHERE profile_id=?').bind(profileId).first();
  assert.equal(JSON.parse(row.execution_snapshot_json).blocks.length,6);
  assert.deepEqual({current_activity_index:row.current_activity_index,revision:row.revision},{current_activity_index:0,revision:1});
  assert.equal((await db.prepare('SELECT count(*) AS n FROM activity_instances WHERE mission_instance_id=?').bind(started.data.id).first()).n,6);
  const profile=await db.prepare('SELECT state FROM training_profiles WHERE id=?').bind(profileId).first();
  await db.prepare('UPDATE training_profiles SET state=? WHERE id=?').bind(JSON.stringify({...JSON.parse(profile.state),week:1}),profileId).run();
  assert.deepEqual((await get(mf,'/api/mission')).data,started.data);
 }finally{await mf.dispose();}
});

test('activity mutations preserve rest and result state and replay the same authoritative response',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);
  let result=await post(mf,'/api/mission',{action:'start'},'mission-start-2');
  const missionId=result.data.missionId;const activity=result.data.activities[0];
  result=await post(mf,'/api/mission',{action:'start-activity',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key},'activity-start-1');
  assert.equal(result.data.activities[0].status,'in-progress');
  const skipped=await post(mf,'/api/mission',{action:'record-result',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key,result:{completedSets:2}},'activity-result-skipped');
  assert.equal(skipped.status,400);assert.equal(skipped.data.error.code,'INVALID_RESULT');
  const earlyRest=await post(mf,'/api/mission',{action:'start-rest',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key},'activity-rest-early');
  assert.equal(earlyRest.status,409);assert.equal(earlyRest.data.error.code,'INVALID_STATE_TRANSITION');
  result=await post(mf,'/api/mission',{action:'record-result',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key,result:{completedSets:1,usedEasierVersion:false}},'activity-result-1');
  result=await post(mf,'/api/mission',{action:'start-rest',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key,remainingSeconds:30},'activity-rest-1');
  assert.equal(result.data.activities[0].status,'resting');
  result=await post(mf,'/api/mission',{action:'end-rest',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key},'activity-rest-end-1');
  result=await post(mf,'/api/mission',{action:'record-result',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key,result:{completedSets:2,usedEasierVersion:false}},'activity-result-2');
  const completed=await post(mf,'/api/mission',{action:'complete-activity',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key},'activity-complete-1');
  assert.equal(completed.data.currentActivityIndex,1);
  assert.equal(completed.data.activities[0].status,'completed');
  const replay=await post(mf,'/api/mission',{action:'complete-activity',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key},'activity-complete-1');
  assert.equal(replay.status,200);
  assert.deepEqual(replay.data,completed.data);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='MISSION_COMPLETE_ACTIVITY'").first()).n,1);
 }finally{await mf.dispose();}
});

test('legacy active missions migrate existing set progress instead of restarting the player',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);
  const profile=await db.prepare('SELECT state FROM training_profiles WHERE id=?').bind(profileId).first();
  const state={...JSON.parse(profile.state),sets:{'foundation:0:0:warm:0':true,'foundation:0:0:warm:1':true,'foundation:0:0:catch:0':true}};
  await db.prepare('UPDATE training_profiles SET state=? WHERE id=?').bind(JSON.stringify(state),profileId).run();
  await db.prepare('INSERT INTO mission_instances(id,profile_id,mission_key,status,started_at,updated_at) VALUES(?,?,?,?,?,?)').bind('legacy-mission',profileId,'foundation:0:0','in-progress','2026-09-10T00:00:00.000Z','2026-09-10T00:00:00.000Z').run();
  const migrated=await get(mf,'/api/mission');
  assert.equal(migrated.status,200);
  assert.equal(migrated.data.currentActivityIndex,1);
  assert.equal(migrated.data.activities[0].status,'completed');
  assert.deepEqual(migrated.data.activities[0].result,{completedSets:2});
  assert.equal(migrated.data.activities[1].status,'in-progress');
  assert.deepEqual(migrated.data.activities[1].result,{completedSets:1});
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='MISSION_EXECUTION_HYDRATED'").first()).n,1);
  await get(mf,'/api/mission');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='MISSION_EXECUTION_HYDRATED'").first()).n,1);
 }finally{await mf.dispose();}
});

test('stale revision, wrong player context, invalid result, and revoked relationship make no writes',async()=>{
 const {mf,db}=await setup();
 try{
  const first=await readyPlayer(mf,db,'First','first');
  const started=await post(mf,'/api/mission',{action:'start'},'mission-start-3');
  const missionId=started.data.missionId;const activityKey=started.data.activities[0].key;
  const stale=await post(mf,'/api/mission',{action:'start-activity',missionId,profileContextId:first,revision:0,activityKey},'mission-stale-1');
  assert.equal(stale.status,409);assert.equal(stale.data.error.code,'STALE_REVISION');
  const invalid=await post(mf,'/api/mission',{action:'start-activity',missionId,profileContextId:first,revision:1,activityKey:'not-current'},'mission-invalid-1');
  assert.equal(invalid.status,409);assert.equal(invalid.data.error.code,'INVALID_STATE_TRANSITION');
  const second=await readyPlayer(mf,db,'Second','second');
  const wrong=await post(mf,'/api/mission',{action:'start-activity',missionId,profileContextId:first,revision:1,activityKey},'mission-context-1');
  assert.equal(wrong.status,409);assert.equal(wrong.data.error.code,'PLAYER_CONTEXT_REQUIRED');
  await db.prepare("UPDATE guardian_player SET status='revoked' WHERE account_id='parent' AND profile_id=?").bind(second).run();
  const revoked=await post(mf,'/api/mission',{action:'start-activity',missionId,profileContextId:second,revision:1,activityKey},'mission-revoked-1');
  assert.equal(revoked.status,403);assert.equal(revoked.data.error.code,'RELATIONSHIP_REVOKED');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM activity_instances WHERE status!='READY'").first()).n,0);
 }finally{await mf.dispose();}
});

test('every activity can complete once and mission completion is terminal without duplicate event or history',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);
  let current=(await post(mf,'/api/mission',{action:'start'},'mission-start-4')).data;
  for(const activity of current.activities){
   current=(await post(mf,'/api/mission',{action:'start-activity',missionId:current.missionId,profileContextId:profileId,revision:current.revision,activityKey:activity.key},`full-start-${activity.ordinal}`)).data;
   for(let set=1;set<=activity.requiredSets;set++){
    current=(await post(mf,'/api/mission',{action:'record-result',missionId:current.missionId,profileContextId:profileId,revision:current.revision,activityKey:activity.key,result:{completedSets:set,...(activity.key==='read'?{answer:0}:{})}},`full-result-${activity.ordinal}-${set}`)).data;
    if(set<activity.requiredSets){
     current=(await post(mf,'/api/mission',{action:'start-rest',missionId:current.missionId,profileContextId:profileId,revision:current.revision,activityKey:activity.key},`full-rest-${activity.ordinal}-${set}`)).data;
     current=(await post(mf,'/api/mission',{action:'end-rest',missionId:current.missionId,profileContextId:profileId,revision:current.revision,activityKey:activity.key},`full-rest-end-${activity.ordinal}-${set}`)).data;
    }
   }
   current=(await post(mf,'/api/mission',{action:'complete-activity',missionId:current.missionId,profileContextId:profileId,revision:current.revision,activityKey:activity.key},`full-complete-${activity.ordinal}`)).data;
  }
  const completed=await post(mf,'/api/mission',{action:'complete-mission',missionId:current.missionId,profileContextId:profileId,revision:current.revision},'mission-complete-1');
  assert.equal(completed.status,200);assert.equal(completed.data.status,'completed');
  const replay=await post(mf,'/api/mission',{action:'complete-mission',missionId:current.missionId,profileContextId:profileId,revision:current.revision},'mission-complete-1');
  assert.deepEqual(replay.data,completed.data);
  const closed=await post(mf,'/api/mission',{action:'resume',missionId:current.missionId,profileContextId:profileId,revision:completed.data.revision},'mission-closed-1');
  assert.equal(closed.status,409);assert.equal(closed.data.error.code,'SESSION_ALREADY_COMPLETED');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM product_events WHERE event_name='mission_completed'").first()).n,1);
  const profile=await db.prepare('SELECT state FROM training_profiles WHERE id=?').bind(profileId).first();
  assert.equal(JSON.parse(profile.state).sessions.filter(item=>item.id===current.missionId).length,1);
 }finally{await mf.dispose();}
});
