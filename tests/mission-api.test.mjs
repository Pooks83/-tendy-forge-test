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
const setupInput=(nickname,analytics=true)=>({nickname,ageBand:'10–12',catches:'left',experience:'new',equipment:[],plannedDays:['monday'],missionMinutes:15,consentAccepted:true,consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',optionalPermissions:{analytics,notifications:false,clips:false}});
const post=async(mf,path,body,key,headers=auth)=>{const response=await mf.dispatchFetch(`http://localhost${path}`,{method:'POST',headers:{...headers,'Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
const get=async(mf,path)=>{const response=await mf.dispatchFetch(`http://localhost${path}`,{headers:auth});return {status:response.status,data:await response.json()};};

async function readyPlayer(mf,db,nickname='Goalie',key='mission-player',analytics=true){
 const created=await post(mf,'/api/onboarding',setupInput(nickname,analytics),`${key}-create`);
 const now='2026-09-11T12:00:00.000Z';
 await db.prepare("INSERT INTO first_challenge_results(profile_id,protocol_version,status,started_at,completed_at,result_json,updated_at) VALUES(?,?,?,?,?,?,?)").bind(created.data.profileId,'tf-first-ready-v1','completed',now,now,'{"completedSeconds":60,"claim":"completed"}',now).run();
 return created.data.profileId;
}

test('queued mission sync records privacy-safe opt-in events exactly once',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);const started=(await post(mf,'/api/mission',{action:'start'},'offline-start')).data;
  const operationKey='offline-activity-start';const queuedAt='2026-09-11T11:59:00.000Z';
  const body={action:'start-activity',missionId:started.missionId,profileContextId:profileId,revision:started.revision,activityKey:started.activities[0].key,queuedAt,offlineMutationId:operationKey};
  const synced=await post(mf,'/api/mission',body,operationKey);assert.equal(synced.status,200);
  const replay=await post(mf,'/api/mission',body,operationKey);assert.deepEqual(replay.data,synced.data);
  const events=(await db.prepare("SELECT event_name,logical_key,metadata_json FROM product_events WHERE event_name IN ('offline_pending','sync_reconciled') ORDER BY event_name").all()).results;
  assert.deepEqual(events.map(item=>item.event_name),['offline_pending','sync_reconciled']);
  assert.equal(new Set(events.map(item=>item.logical_key)).size,2);
  for(const event of events){const metadata=JSON.parse(event.metadata_json);assert.equal(metadata.missionId,started.missionId);assert.equal(metadata.action,'start-activity');assert.equal(typeof metadata.queuedSeconds,'number');assert.doesNotMatch(event.metadata_json,/Goalie|email|nickname|note/i);}
 }finally{await mf.dispose();}
});

test('queued sync telemetry respects analytics decline and rejects ambiguous queue identity',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db,'Private','private',false);const started=(await post(mf,'/api/mission',{action:'start'},'private-start')).data;
  const body={action:'start-activity',missionId:started.missionId,profileContextId:profileId,revision:started.revision,activityKey:started.activities[0].key,queuedAt:'2026-09-11T11:59:00.000Z',offlineMutationId:'different-key'};
  const rejected=await post(mf,'/api/mission',body,'private-offline');assert.equal(rejected.status,400);assert.equal(rejected.data.error.code,'INVALID_ACTION');
  const synced=await post(mf,'/api/mission',{...body,offlineMutationId:'private-offline'},'private-offline');assert.equal(synced.status,200);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM product_events WHERE event_name IN ('offline_pending','sync_reconciled')").first()).n,0);
 }finally{await mf.dispose();}
});

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
  const mismatchedReplay=await post(mf,'/api/mission',{action:'record-result',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key,result:{completedSets:2,usedEasierVersion:false}},'activity-result-1');
  assert.equal(mismatchedReplay.status,409);assert.equal(mismatchedReplay.data.error.code,'DUPLICATE_REQUEST');
  result=await post(mf,'/api/mission',{action:'start-rest',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key,remainingSeconds:30},'activity-rest-1');
  assert.equal(result.data.activities[0].status,'resting');
  const tooSoon=await post(mf,'/api/mission',{action:'end-rest',missionId,profileContextId:profileId,revision:result.data.revision,activityKey:activity.key},'activity-rest-too-soon');
  assert.equal(tooSoon.status,409);assert.equal(tooSoon.data.error.code,'INVALID_STATE_TRANSITION');
  await db.prepare("UPDATE activity_instances SET updated_at=datetime('now','-31 seconds') WHERE mission_instance_id=? AND activity_key=?").bind(result.data.id,activity.key).run();
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

test('pain stop is authoritative and blocks resume until an adult clears the safety flag',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);let current=(await post(mf,'/api/mission',{action:'start'},'safety-mission-start')).data;
  current=(await post(mf,'/api/mission',{action:'start-activity',missionId:current.missionId,profileContextId:profileId,revision:current.revision,activityKey:current.activities[0].key},'safety-activity-start')).data;
  const stopped=await post(mf,'/api/mission',{action:'safety-stop',missionId:current.missionId,profileContextId:profileId,revision:current.revision},'safety-stop-1');
  assert.equal(stopped.status,200);assert.equal(stopped.data.status,'interrupted');
  const profile=await db.prepare('SELECT state FROM training_profiles WHERE id=?').bind(profileId).first();assert.equal(JSON.parse(profile.state).safetyStopped,true);
  const blocked=await post(mf,'/api/mission',{action:'resume',missionId:current.missionId,profileContextId:profileId,revision:stopped.data.revision},'safety-resume-blocked');
  assert.equal(blocked.status,409);assert.equal(blocked.data.error.code,'SAFETY_STOPPED');
  await db.prepare('UPDATE training_profiles SET state=? WHERE id=?').bind(JSON.stringify({...JSON.parse(profile.state),safetyStopped:false}),profileId).run();
  const resumed=await post(mf,'/api/mission',{action:'resume',missionId:current.missionId,profileContextId:profileId,revision:stopped.data.revision},'safety-resume-cleared');
  assert.equal(resumed.status,200);assert.equal(resumed.data.status,'in-progress');
 }finally{await mf.dispose();}
});

test('queued safety stop becomes authoritative once and remains blocked for adult review',async()=>{
 const {mf,db}=await setup();
 try{
  const profileId=await readyPlayer(mf,db);let current=(await post(mf,'/api/mission',{action:'start'},'offline-safety-start')).data;
  current=(await post(mf,'/api/mission',{action:'start-activity',missionId:current.missionId,profileContextId:profileId,revision:current.revision,activityKey:current.activities[0].key},'offline-safety-activity')).data;
  const operationKey='offline-safety-stop';const body={action:'safety-stop',missionId:current.missionId,profileContextId:profileId,revision:current.revision,queuedAt:'2026-09-12T00:00:00.000Z',offlineMutationId:operationKey};
  const stopped=await post(mf,'/api/mission',body,operationKey);assert.equal(stopped.status,200);assert.equal(stopped.data.status,'interrupted');
  assert.deepEqual((await post(mf,'/api/mission',body,operationKey)).data,stopped.data);
  const rebasedReplay=await post(mf,'/api/mission',{...body,revision:body.revision+1},operationKey);assert.equal(rebasedReplay.status,200);assert.deepEqual(rebasedReplay.data,stopped.data);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='MISSION_SAFETY_STOP'").first()).n,1);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM product_events WHERE logical_key LIKE '%offline-safety-stop'").first()).n,2);
  const blocked=await post(mf,'/api/mission',{action:'resume',missionId:current.missionId,profileContextId:profileId,revision:stopped.data.revision},'offline-safety-resume');assert.equal(blocked.data.error.code,'SAFETY_STOPPED');
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
     await db.prepare("UPDATE activity_instances SET updated_at=datetime('now','-120 seconds') WHERE mission_instance_id=? AND activity_key=?").bind(current.id,activity.key).run();
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
