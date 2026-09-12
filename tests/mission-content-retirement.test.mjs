import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {seedPublishedContent} from './helpers/training-content-fixture.mjs';

async function setup({seed=true,minutes=15,spaces=['small-indoor']}={}){
 const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){const sql=await readFile(new URL(`../drizzle/${file}`,import.meta.url),'utf8');for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement.trim()).run();}
 if(seed)await seedPublishedContent(db);
 const input={nickname:'Goalie',ageBand:'10–12',catches:'left',experience:'new',equipment:['tennis-ball','wall-space','cones'],plannedDays:['monday'],missionMinutes:minutes,consentAccepted:true,consentVersion:'tf-parent-consent-v1.4',policyVersion:'tf-privacy-v1.4',optionalPermissions:{analytics:false,notifications:false,clips:false}};
 const created=await post(mf,'/api/onboarding',input,'content-player');await db.prepare('UPDATE training_profiles SET available_spaces_json=? WHERE id=?').bind(JSON.stringify(spaces),created.data.profileId).run();const now='2026-09-12T00:00:00.000Z';await db.prepare('INSERT INTO first_challenge_results(profile_id,protocol_version,status,started_at,completed_at,result_json,updated_at) VALUES(?,?,?,?,?,?,?)').bind(created.data.profileId,'tf-first-ready-v1','completed',now,now,'{"completedSeconds":60}',now).run();return {mf,db,profileId:created.data.profileId};
}
const auth={'oai-authenticated-user-id':'parent','oai-authenticated-user-email':'parent@example.test'};
const post=async(mf,path,body,key)=>{const response=await mf.dispatchFetch(`http://localhost${path}`,{method:'POST',headers:{...auth,'Content-Type':'application/json','Origin':'http://localhost','Idempotency-Key':key},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
const get=async mf=>{const response=await mf.dispatchFetch('http://localhost/api/mission',{headers:auth});return {status:response.status,data:await response.json()};};

test('new mission uses persisted profile facts and snapshots the generated 15-minute plan',async()=>{
 const {mf,db,profileId}=await setup();try{
  const ready=await get(mf);assert.equal(ready.status,200);assert.equal(ready.data.status,'not-started');assert.equal(ready.data.executionSnapshot.minutes,15);assert.equal(ready.data.executionSnapshot.blocks.length,3);assert.equal(ready.data.contentVersion,'tf-mission-generator-v1');
  const started=await post(mf,'/api/mission',{action:'start'},'generated-start');assert.equal(started.status,201);assert.equal(started.data.profileContextId,profileId);assert.equal(started.data.activities.length,3);assert.equal(started.data.executionSnapshot.generatorExplanation.activityCount,3);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM activity_instances WHERE mission_instance_id=?').bind(started.data.id).first()).n,3);
 }finally{await mf.dispose();}
});

test('mission duration comes from the server profile and supports 25 and 35 minutes',async()=>{
 for(const [minutes,count] of [[25,4],[35,5]]){const {mf}=await setup({minutes});try{const started=await post(mf,'/api/mission',{action:'start',missionMinutes:15,equipment:[],spaces:[]},`generated-${minutes}`);assert.equal(started.status,201);assert.equal(started.data.executionSnapshot.minutes,minutes);assert.equal(started.data.activities.length,count);}finally{await mf.dispose();}}
});

test('missing reviewed content or explicit space returns one safe adult action',async()=>{
 const noContent=await setup({seed:false});try{const ready=await get(noContent.mf);assert.equal(ready.data.status,'unavailable');assert.equal(ready.data.unavailable.code,'CONTENT_REVIEW_REQUIRED');assert.equal(ready.data.unavailable.nextAction,'adult-content-review');}finally{await noContent.mf.dispose();}
 const noSpace=await setup({spaces:[]});try{const ready=await get(noSpace.mf);assert.equal(ready.data.status,'unavailable');assert.equal(ready.data.unavailable.code,'NO_SAFE_MISSION');assert.equal(ready.data.unavailable.nextAction,'adult-plan-review');}finally{await noSpace.mf.dispose();}
});

test('ordinary catalog changes never rewrite an already started mission snapshot',async()=>{
 const {mf,db}=await setup();try{const started=await post(mf,'/api/mission',{action:'start'},'snapshot-start');const snapshot=started.data.executionSnapshot;const first=snapshot.blocks[0];await db.prepare("UPDATE activity_versions SET content_status='RETIRED',retired_at=?,retirement_reason=? WHERE activity_id=? AND version=?").bind('2026-09-12T01:00:00.000Z','ordinary catalog retirement',first.activityId,first.version).run();const reloaded=await get(mf);assert.deepEqual(reloaded.data.executionSnapshot,snapshot);}finally{await mf.dispose();}
});

test('safety retirement blocks unfinished activity and offers a reviewed family replacement',async()=>{
 const {mf,db,profileId}=await setup();try{
  const started=await post(mf,'/api/mission',{action:'start'},'safety-retirement-start');const first=started.data.executionSnapshot.blocks[0];
  const source=await db.prepare('SELECT family_id,payload_json FROM activity_versions WHERE activity_id=? AND version=?').bind(first.activityId,first.version).first();
  const replacement={...JSON.parse(source.payload_json),version:2,publishedAt:'2026-09-12T02:00:00.000Z'};
  await db.prepare('INSERT INTO activity_versions(activity_id,version,family_id,payload_json,content_status,development_reviewer_id,development_reviewed_at,safety_reviewer_id,safety_reviewed_at,published_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(first.activityId,2,source.family_id,JSON.stringify(replacement),'PUBLISHED','development-fixture','2026-09-12T02:00:00.000Z','safety-fixture','2026-09-12T02:00:00.000Z','2026-09-12T02:00:00.000Z','2026-09-12T02:00:00.000Z').run();
  await db.prepare("UPDATE activity_versions SET content_status='RETIRED',retired_at=?,retirement_reason=? WHERE activity_id=? AND version=?").bind('2026-09-12T02:00:00.000Z','SAFETY: reviewer withdrawal',first.activityId,first.version).run();
  const held=await get(mf);assert.equal(held.data.safetyHold.code,'CONTENT_RETIRED_SAFETY');assert.equal(held.data.safetyHold.activityKey,first.id);assert.deepEqual(held.data.safetyHold.replacement,{activityId:first.activityId,version:2,name:first.name});
  const blocked=await post(mf,'/api/mission',{action:'start-activity',missionId:started.data.missionId,profileContextId:profileId,revision:started.data.revision,activityKey:first.id},'safety-retirement-blocked');assert.equal(blocked.status,409);assert.equal(blocked.data.error.code,'CONTENT_RETIRED_SAFETY');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM activity_instances WHERE mission_instance_id=? AND status!='READY'").bind(started.data.id).first()).n,0);
 }finally{await mf.dispose();}
});
