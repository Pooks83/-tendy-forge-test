import type {AdultIdentity} from './account-identity';
import {getActivePlayer} from './household-store';
import {canonicalError} from './identity-contract.mjs';
import {readStoredOperation,storeOperationStatement} from './idempotency-store';
import {productEventStatement} from './product-event-store';
import {createMissionExecution,transitionMission} from './mission-state.mjs';
import {buildSession,normalizeTrainingState,WEEKS} from './training.mjs';

export const MISSION_CONTENT_VERSION='tf-curriculum-v1';

type PlayerProjection={profile:{id:string};training:{pathId:string;week:number;day:number;cycle?:number;safetyStopped?:boolean}};
type Session=ReturnType<typeof buildSession>;
type ExecutionSnapshot=Session&{reading?:{question:string;options:string[];answer:number;explanation:string}};
type MissionRow={id:string;profile_id:string;mission_key:string;status:string;started_at:string;completed_at:string|null;updated_at:string;revision:number;current_activity_index:number;content_version:string;execution_snapshot_json:string;paused_at:string|null;interrupted_at:string|null;abandoned_at:string|null};
type ActivityRow={id:string;mission_instance_id:string;activity_key:string;ordinal:number;status:string;result_json:string|null;rest_remaining_seconds:number;started_at:string|null;completed_at:string|null;updated_at:string;rest_completed_after_set:number};
type ProfileStateRow={state:string;revision:number};
type MutationInput={action:string;missionId:string;profileContextId:string;revision:number;activityKey?:string;remainingSeconds?:number;result?:Record<string,unknown>;reason?:string;queuedAt?:string;offlineMutationId?:string};
type MissionResult=Record<string,string|number|boolean>;
type ExecutionActivity={key:string;ordinal:number;status:string;result:MissionResult|null;restRemainingSeconds:number;restCompletedAfterSet:number;startedAt?:string;completedAt?:string;updatedAt?:string};
type MissionExecution={missionId:string;status:string;revision:number;currentActivityIndex:number;contentVersion:string;activities:ExecutionActivity[];startedAt:string;updatedAt?:string;completedAt?:string;pausedAt?:string;interruptedAt?:string;interruptionReason?:string;abandonedAt?:string};

const missionColumns='id,profile_id,mission_key,status,started_at,completed_at,updated_at,revision,current_activity_index,content_version,execution_snapshot_json,paused_at,interrupted_at,abandoned_at';
const externalStatus=(value:string)=>value.toLowerCase().replaceAll('_','-');
const internalStatus=(value:string)=>value.toUpperCase().replaceAll('-','_');
const parseJson=<T>(value:string|null,fallback:T):T=>{try{return value?JSON.parse(value):fallback;}catch{return fallback;}};
const snapshotFor=(session:Session):ExecutionSnapshot=>{const reading=WEEKS[session.week];return {...session,reading:{question:reading.question,options:[...reading.options],answer:reading.answer,explanation:reading.explanation}};};

async function current(db:D1Database,identity:AdultIdentity){
 const player=await getActivePlayer(db,identity) as unknown as PlayerProjection;
 const session=buildSession(player.training.pathId,player.training.week,player.training.day,player.training.cycle||0);
 return {player,profileId:player.profile.id,missionId:session.id,session};
}

function sessionForMission(missionId:string,fallback:Session){
 const [pathId,week,day,cycle]=missionId.split(':');
 const parsedWeek=Number(week);const parsedDay=Number(day);const parsedCycle=cycle===undefined?0:Number(cycle);
 if(pathId&&Number.isInteger(parsedWeek)&&Number.isInteger(parsedDay)&&Number.isInteger(parsedCycle)){
  try{return buildSession(pathId,parsedWeek,parsedDay,parsedCycle);}catch{return fallback;}
 }
 return fallback;
}

async function activityRows(db:D1Database,missionInstanceId:string){
 return (await db.prepare('SELECT id,mission_instance_id,activity_key,ordinal,status,result_json,rest_remaining_seconds,started_at,completed_at,updated_at,rest_completed_after_set FROM activity_instances WHERE mission_instance_id=? ORDER BY ordinal').bind(missionInstanceId).all<ActivityRow>()).results;
}

function remainingRest(row:MissionRow,item:ActivityRow,now=new Date()){
 if(internalStatus(row.status)!=='IN_PROGRESS'||internalStatus(item.status)!=='RESTING')return item.rest_remaining_seconds;
 const elapsed=Math.max(0,Math.floor((now.getTime()-Date.parse(item.updated_at))/1000));return Math.max(0,item.rest_remaining_seconds-elapsed);
}

function projection(row:MissionRow,activities:ActivityRow[],now=new Date()){
 const snapshot=parseJson<ExecutionSnapshot>(row.execution_snapshot_json,{blocks:[]} as unknown as ExecutionSnapshot);
 return {
  id:row.id,missionId:row.mission_key,profileContextId:row.profile_id,status:externalStatus(row.status),revision:row.revision,currentActivityIndex:row.current_activity_index,contentVersion:row.content_version,
  activities:activities.map(item=>{const block=snapshot.blocks?.find(candidate=>candidate.id===item.activity_key);return {key:item.activity_key,ordinal:item.ordinal,status:externalStatus(item.status),result:parseJson(item.result_json,null),restRemainingSeconds:remainingRest(row,item,now),restCompletedAfterSet:item.rest_completed_after_set,requiredSets:block?.sets??0,restSeconds:block?.restSeconds??0,...(item.started_at?{startedAt:item.started_at}:{}),...(item.completed_at?{completedAt:item.completed_at}:{})};}),
  startedAt:row.started_at,...(row.completed_at?{completedAt:row.completed_at}:{}),...(row.paused_at?{pausedAt:row.paused_at}:{}),...(row.interrupted_at?{interruptedAt:row.interrupted_at}:{}),...(row.abandoned_at?{abandonedAt:row.abandoned_at}:{}),executionSnapshot:snapshot,
 };
}

function executionFromRows(row:MissionRow,activities:ActivityRow[],now=new Date()):MissionExecution{
 return {
  missionId:row.mission_key,status:internalStatus(row.status),revision:row.revision,currentActivityIndex:row.current_activity_index,contentVersion:row.content_version,
  activities:activities.map(item=>({key:item.activity_key,ordinal:item.ordinal,status:internalStatus(item.status),result:parseJson(item.result_json,null),restRemainingSeconds:remainingRest(row,item,now),restCompletedAfterSet:item.rest_completed_after_set,...(item.started_at?{startedAt:item.started_at}:{}),...(item.completed_at?{completedAt:item.completed_at}:{}),updatedAt:item.updated_at})),
  startedAt:row.started_at,updatedAt:row.updated_at,...(row.completed_at?{completedAt:row.completed_at}:{}),...(row.paused_at?{pausedAt:row.paused_at}:{}),...(row.interrupted_at?{interruptedAt:row.interrupted_at}:{}),...(row.abandoned_at?{abandonedAt:row.abandoned_at}:{}),
 };
}

async function hydrateLegacyMission(db:D1Database,identity:AdultIdentity,row:MissionRow,session:Session){
 const snapshot=parseJson<{blocks?:unknown[]}>(row.execution_snapshot_json,{});
 if(row.content_version!=='tf-curriculum-legacy'&&Array.isArray(snapshot.blocks)&&snapshot.blocks.length)return row;
 const now=new Date().toISOString();const executionSnapshot=snapshotFor(session);
 const profile=await db.prepare('SELECT state FROM training_profiles WHERE id=?').bind(row.profile_id).first<{state:string}>();
 const training=normalizeTrainingState(parseJson(profile?.state||'{}',{}));
 const migrated=session.blocks.map((block,ordinal)=>{
  const key=`${row.mission_key}:${block.id}`;const completedSets=Array.from({length:block.sets},(_,index)=>training.sets[`${key}:${index}`]).filter(Boolean).length;
  const answer=block.id==='read'?training.answers[row.mission_key]:null;const rest=training.rests?.[key];const remaining=rest?(rest.remaining||Math.max(0,Math.ceil((rest.until-Date.parse(now))/1000))):0;
  const complete=completedSets===block.sets&&(block.id!=='read'||Boolean(answer));const active=!complete&&(completedSets>0||Boolean(answer)||remaining>0);
  const result=completedSets||answer?{completedSets,...(answer?{answer:answer.choice,correct:answer.correct}:{} )}:null;
  return {id:crypto.randomUUID(),key:block.id,ordinal,status:complete?'COMPLETED':remaining>0?'RESTING':active?'IN_PROGRESS':'READY',result,remaining,restCompletedAfterSet:rest&&remaining===0&&completedSets<block.sets?completedSets:0,startedAt:active||complete?row.started_at:null,completedAt:complete?now:null};
 });
 const currentIndex=migrated.findIndex(activity=>!['COMPLETED','SKIPPED'].includes(activity.status));
 await db.batch([
  db.prepare('UPDATE mission_instances SET content_version=?,execution_snapshot_json=?,current_activity_index=?,updated_at=? WHERE id=? AND content_version=?').bind(MISSION_CONTENT_VERSION,JSON.stringify(executionSnapshot),currentIndex<0?migrated.length:currentIndex,now,row.id,'tf-curriculum-legacy'),
  ...migrated.map(activity=>db.prepare('INSERT OR IGNORE INTO activity_instances(id,mission_instance_id,activity_key,ordinal,status,result_json,rest_remaining_seconds,started_at,completed_at,updated_at,rest_completed_after_set) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND content_version=?)').bind(activity.id,row.id,activity.key,activity.ordinal,activity.status,activity.result?JSON.stringify(activity.result):null,activity.remaining,activity.startedAt,activity.completedAt,now,activity.restCompletedAfterSet,row.id,MISSION_CONTENT_VERSION)),
  db.prepare('INSERT OR IGNORE INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND content_version=?)').bind(`mission-hydrate:${row.id}`,identity.id,row.profile_id,'MISSION_EXECUTION_HYDRATED',JSON.stringify({missionId:row.mission_key,contentVersion:MISSION_CONTENT_VERSION}),now,row.id,MISSION_CONTENT_VERSION),
 ]);
 return {...row,content_version:MISSION_CONTENT_VERSION,execution_snapshot_json:JSON.stringify(executionSnapshot),current_activity_index:currentIndex<0?migrated.length:currentIndex,updated_at:now};
}

async function loadMission(db:D1Database,identity:AdultIdentity,profileId:string,missionId:string,session:Session){
 let row=await db.prepare(`SELECT ${missionColumns} FROM mission_instances WHERE profile_id=? AND mission_key=?`).bind(profileId,missionId).first<MissionRow>();
 if(!row)return null;
 row=await hydrateLegacyMission(db,identity,row,session);
 return {row,activities:await activityRows(db,row.id)};
}

export async function getCurrentMission(db:D1Database,identity:AdultIdentity){
 const {profileId,missionId,session}=await current(db,identity);
 const active=await db.prepare(`SELECT ${missionColumns} FROM mission_instances WHERE profile_id=? AND UPPER(REPLACE(status,'-','_')) IN ('IN_PROGRESS','PAUSED','INTERRUPTED') ORDER BY started_at LIMIT 1`).bind(profileId).first<MissionRow>();
 if(active){
  const hydrated=await hydrateLegacyMission(db,identity,active,sessionForMission(active.mission_key,session));
  return projection(hydrated,await activityRows(db,hydrated.id));
 }
 const loaded=await loadMission(db,identity,profileId,missionId,session);
 return loaded?projection(loaded.row,loaded.activities):{missionId,profileContextId:profileId,status:'not-started',revision:0,activities:[],executionSnapshot:session,contentVersion:MISSION_CONTENT_VERSION};
}

export async function startCurrentMission(db:D1Database,identity:AdultIdentity,operationKey:string,now=new Date()){
 const {player,profileId,missionId,session}=await current(db,identity);
 if(player.training.safetyStopped)throw canonicalError('SAFETY_STOPPED','Training is paused. Ask a parent or guardian to check in before continuing.',409);
 const challenge=await db.prepare('SELECT status FROM first_challenge_results WHERE profile_id=?').bind(profileId).first<{status:string}>();
 if(challenge?.status!=='completed')throw canonicalError('INVALID_STATE_TRANSITION','Finish the 60-second first challenge before starting this mission.',409);
 const operation=`mission-start:${profileId}`;
 const stored=await readStoredOperation(db,identity.id,operationKey,operation);
 if(stored)return {data:stored,replayed:true};
 const active=await db.prepare(`SELECT ${missionColumns} FROM mission_instances WHERE profile_id=? AND UPPER(REPLACE(status,'-','_')) IN ('IN_PROGRESS','PAUSED','INTERRUPTED') ORDER BY started_at LIMIT 1`).bind(profileId).first<MissionRow>();
 if(active){const hydrated=await hydrateLegacyMission(db,identity,active,sessionForMission(active.mission_key,session));return {data:projection(hydrated,await activityRows(db,hydrated.id)),replayed:true};}
 const existing=await loadMission(db,identity,profileId,missionId,session);
 if(existing)return {data:projection(existing.row,existing.activities),replayed:true};
 const timestamp=now.toISOString();const id=crypto.randomUUID();const executionSnapshot=snapshotFor(session);
 const execution=transitionMission(createMissionExecution({missionId,activityKeys:session.blocks.map(block=>block.id),contentVersion:MISSION_CONTENT_VERSION}),{type:'START'},timestamp);
 const row:MissionRow={id,profile_id:profileId,mission_key:missionId,status:execution.status,started_at:execution.startedAt,completed_at:null,updated_at:timestamp,revision:execution.revision,current_activity_index:0,content_version:MISSION_CONTENT_VERSION,execution_snapshot_json:JSON.stringify(executionSnapshot),paused_at:null,interrupted_at:null,abandoned_at:null};
 const rows:ActivityRow[]=execution.activities.map((activity:{key:string;ordinal:number;status:string;restCompletedAfterSet:number})=>({id:crypto.randomUUID(),mission_instance_id:id,activity_key:activity.key,ordinal:activity.ordinal,status:activity.status,result_json:null,rest_remaining_seconds:0,started_at:null,completed_at:null,updated_at:timestamp,rest_completed_after_set:activity.restCompletedAfterSet}));
 const data=projection(row,rows);
 const preference=await db.prepare('SELECT analytics_allowed FROM privacy_preferences WHERE profile_id=?').bind(profileId).first<{analytics_allowed:number}>();
 try{
  await db.batch([
   db.prepare('INSERT INTO mission_instances(id,profile_id,mission_key,status,started_at,completed_at,updated_at,revision,current_activity_index,content_version,execution_snapshot_json,paused_at,interrupted_at,abandoned_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,profileId,missionId,execution.status,timestamp,null,timestamp,execution.revision,0,MISSION_CONTENT_VERSION,JSON.stringify(executionSnapshot),null,null,null),
   ...rows.map(item=>db.prepare('INSERT INTO activity_instances(id,mission_instance_id,activity_key,ordinal,status,result_json,rest_remaining_seconds,started_at,completed_at,updated_at,rest_completed_after_set) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(item.id,id,item.activity_key,item.ordinal,item.status,null,0,null,null,timestamp,0)),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity.id,profileId,'MISSION_STARTED',JSON.stringify({missionId,contentVersion:MISSION_CONTENT_VERSION}),timestamp),
   ...(preference?.analytics_allowed===1?[productEventStatement(db,{eventName:'mission_started',logicalKey:`mission_started:${profileId}:${missionId}`,accountContextId:identity.id,profileContextId:profileId,metadata:{missionId}},timestamp)]:[]),storeOperationStatement(db,identity.id,operationKey,operation,data,timestamp),
  ]);
  return {data,replayed:false};
 }catch(error){
  const replay=await readStoredOperation(db,identity.id,operationKey,operation);if(replay)return {data:replay,replayed:true};
  const created=await loadMission(db,identity,profileId,missionId,session);if(created)return {data:projection(created.row,created.activities),replayed:true};throw error;
 }
}

function transitionAction(input:MutationInput){
 const shared={activityKey:input.activityKey};
 switch(input.action){
  case 'start-activity':return {type:'START_ACTIVITY',...shared};case 'record-result':return {type:'RECORD_RESULT',...shared,result:input.result};case 'start-rest':return {type:'START_REST',...shared,remainingSeconds:input.remainingSeconds};case 'end-rest':return {type:'END_REST',...shared};case 'complete-activity':return {type:'COMPLETE_ACTIVITY',...shared};case 'skip-activity':return {type:'SKIP_ACTIVITY',...shared,reason:input.reason};case 'pause':return {type:'PAUSE'};case 'interrupt':return {type:'INTERRUPT',reason:input.reason};case 'safety-stop':return {type:'SAFETY_STOP'};case 'resume':return {type:'RESUME'};case 'abandon':return {type:'ABANDON',reason:input.reason};case 'complete-mission':return {type:'COMPLETE_MISSION'};default:throw canonicalError('INVALID_ACTION','That mission action is not available.',400);
 }
}

function legacyProjection(raw:string,snapshot:Session,next:MissionExecution,timestamp:string,safetyStopped=false){
 const state=normalizeTrainingState(parseJson(raw,{}));const sets={...state.sets};const rests={...state.rests};const answers={...state.answers};
 for(const activity of next.activities){
  const block=snapshot.blocks.find(item=>item.id===activity.key);if(!block)continue;const key=`${next.missionId}:${activity.key}`;
  if(['COMPLETED','SKIPPED'].includes(activity.status))for(let index=0;index<block.sets;index++)sets[`${key}:${index}`]=true;
  if(activity.status==='RESTING')rests[key]={until:0,remaining:activity.restRemainingSeconds||0};else if(rests[key])rests[key]={until:0,remaining:0};
  if(activity.key==='read'&&typeof activity.result?.answer==='number')answers[next.missionId]={choice:activity.result.answer,correct:activity.result.correct===true};
 }
 const sessions=[...state.sessions];if(next.status==='COMPLETED'&&!sessions.some(item=>item.id===next.missionId))sessions.push({id:next.missionId,date:timestamp,pathId:snapshot.pathId,week:snapshot.week,day:snapshot.day});
 return {...state,sets,rests,answers,sessions,safetyStopped:safetyStopped||state.safetyStopped};
}

function eventFor(input:MutationInput){return ({'start-activity':'activity_started','complete-activity':'activity_completed','skip-activity':'activity_skipped','complete-mission':'mission_completed','abandon':'mission_abandoned'} as Record<string,string>)[input.action]||null;}

function offlineEventStatements(db:D1Database,identity:AdultIdentity,profileId:string,input:MutationInput,timestamp:string,condition:string,conditionBindings:(string|number)[]){
 if(!input.queuedAt||!input.offlineMutationId)return [];
 const queuedSeconds=Math.max(0,Math.floor((Date.parse(timestamp)-Date.parse(input.queuedAt))/1000));
 const metadata=JSON.stringify({missionId:input.missionId,action:input.action,queuedSeconds});
 return ['offline_pending','sync_reconciled'].map(eventName=>db.prepare(`INSERT OR IGNORE INTO product_events(id,logical_key,event_name,account_context_id,profile_context_id,app_version,build_version,config_version,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${condition}`).bind(crypto.randomUUID(),`${eventName}:${profileId}:${input.offlineMutationId}`,eventName,identity.id,profileId,'0.1.0',process.env.SITES_BUILD_ID||process.env.GIT_COMMIT_SHA||'local-unpublished','tf-v1.4',metadata,timestamp,...conditionBindings));
}

function normalizedResult(input:MutationInput,before:MissionExecution,snapshot:ExecutionSnapshot){
 const activity=before.activities[before.currentActivityIndex];const block=snapshot.blocks.find(item=>item.id===activity?.key);const raw=input.result;
 if(!activity||!block||!raw||!Number.isInteger(raw.completedSets))throw canonicalError('INVALID_RESULT','Finish one listed set before saving progress.',400);
 const previous=typeof activity.result?.completedSets==='number'?activity.result.completedSets:0;
 if(previous>activity.restCompletedAfterSet&&block.restSeconds>0)throw canonicalError('INVALID_STATE_TRANSITION','Finish the listed rest before starting the next set.',409);
 if(raw.completedSets!==previous+1||raw.completedSets>block.sets)throw canonicalError('INVALID_RESULT','Save each listed set once and in order.',400);
 const result:MissionResult={completedSets:raw.completedSets as number,usedEasierVersion:raw.usedEasierVersion===true};
 if(block.id==='read'){
  if(!Number.isInteger(raw.answer)||!snapshot.reading||Number(raw.answer)<0||Number(raw.answer)>=snapshot.reading.options.length)throw canonicalError('INVALID_RESULT','Choose an answer before completing the reading activity.',400);
  result.answer=Number(raw.answer);result.correct=Number(raw.answer)===snapshot.reading.answer;
 }
 return result;
}

export async function mutateCurrentMission(db:D1Database,identity:AdultIdentity,input:MutationInput,operationKey:string,now=new Date()){
 const active=await current(db,identity);
 if(input.profileContextId!==active.profileId)throw canonicalError('PLAYER_CONTEXT_REQUIRED','Return to the goalie this progress belongs to before syncing it.',409);
 const operation=`mission-action:${active.profileId}:${input.missionId}:${input.action}`;const stored=await readStoredOperation(db,identity.id,operationKey,operation);if(stored)return {data:stored,replayed:true};
 const loaded=await loadMission(db,identity,active.profileId,input.missionId,sessionForMission(input.missionId,active.session));if(!loaded)throw canonicalError('MISSION_NOT_FOUND','Start today’s mission before recording progress.',404);
 if(input.revision!==loaded.row.revision)throw canonicalError('STALE_REVISION','Progress changed on another device. Reload before continuing.',409);
 if(active.player.training.safetyStopped&&input.action!=='safety-stop')throw canonicalError('SAFETY_STOPPED','Training is paused. Ask a parent or guardian to check in before continuing.',409);
 const timestamp=now.toISOString();const before=executionFromRows(loaded.row,loaded.activities,now);const snapshot=parseJson<ExecutionSnapshot>(loaded.row.execution_snapshot_json,snapshotFor(active.session));
 if(input.action==='complete-activity'){
  const activity=before.activities[before.currentActivityIndex];const required=snapshot.blocks.find(block=>block.id===activity?.key)?.sets;
  if(!activity||activity.result?.completedSets!==required)throw canonicalError('INVALID_RESULT','Finish the listed sets before completing this activity.',400);
 }
 if(input.action==='record-result')input={...input,result:normalizedResult(input,before,snapshot)};
 if(input.action==='start-rest'){
  const activity=before.activities[before.currentActivityIndex];const block=snapshot.blocks.find(item=>item.id===activity?.key);const completed=typeof activity?.result?.completedSets==='number'?activity.result.completedSets:0;
  if(!block||completed<1||completed>=block.sets||block.restSeconds<1)throw canonicalError('INVALID_STATE_TRANSITION','Rest is available only between listed sets.',409);
  input={...input,remainingSeconds:block.restSeconds};
 }
 if(input.action==='end-rest'&&before.activities[before.currentActivityIndex]?.restRemainingSeconds>0)throw canonicalError('INVALID_STATE_TRANSITION','Finish the listed rest before continuing.',409);
 const next=transitionMission(before,transitionAction(input),timestamp) as MissionExecution;
 const profile=await db.prepare('SELECT state,revision FROM training_profiles WHERE id=?').bind(active.profileId).first<ProfileStateRow>();if(!profile)throw canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',409);
 const legacy=legacyProjection(profile.state,snapshot,next,timestamp,input.action==='safety-stop');const nextRows=next.activities;
 const projectedRows=loaded.activities.map((row,index)=>({...row,status:nextRows[index].status,result_json:nextRows[index].result?JSON.stringify(nextRows[index].result):null,rest_remaining_seconds:nextRows[index].restRemainingSeconds||0,rest_completed_after_set:nextRows[index].restCompletedAfterSet||0,started_at:nextRows[index].startedAt||null,completed_at:nextRows[index].completedAt||null,updated_at:timestamp}));
 const data=projection({...loaded.row,status:next.status,revision:next.revision,current_activity_index:next.currentActivityIndex,completed_at:next.completedAt||null,updated_at:timestamp,paused_at:next.pausedAt||loaded.row.paused_at,interrupted_at:next.interruptedAt||loaded.row.interrupted_at,abandoned_at:next.abandonedAt||loaded.row.abandoned_at},projectedRows);
 const eventName=eventFor(input);const analytics=await db.prepare('SELECT analytics_allowed FROM privacy_preferences WHERE profile_id=?').bind(active.profileId).first<{analytics_allowed:number}>();
 const condition='EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM training_profiles WHERE id=? AND revision=?)';
 const conditionBindings=[loaded.row.id,next.revision,active.profileId,profile.revision+1];
 const activityStatements=nextRows.map((activity,index)=>db.prepare(`UPDATE activity_instances SET status=?,result_json=?,rest_remaining_seconds=?,rest_completed_after_set=?,started_at=?,completed_at=?,updated_at=? WHERE id=? AND ${condition}`).bind(activity.status,activity.result?JSON.stringify(activity.result):null,activity.restRemainingSeconds||0,activity.restCompletedAfterSet||0,activity.startedAt||null,activity.completedAt||null,timestamp,loaded.activities[index].id,loaded.row.id,next.revision,active.profileId,profile.revision+1));
 try{
  const results=await db.batch([
   db.prepare('UPDATE mission_instances SET status=?,revision=?,current_activity_index=?,completed_at=?,paused_at=?,interrupted_at=?,abandoned_at=?,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM training_profiles WHERE id=? AND revision=?)').bind(next.status,next.revision,next.currentActivityIndex,next.completedAt||null,next.pausedAt||loaded.row.paused_at,next.interruptedAt||loaded.row.interrupted_at,next.abandonedAt||loaded.row.abandoned_at,timestamp,loaded.row.id,loaded.row.revision,active.profileId,profile.revision),
   db.prepare('UPDATE training_profiles SET state=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND revision=?)').bind(JSON.stringify(legacy),timestamp,active.profileId,profile.revision,loaded.row.id,next.revision),
   ...activityStatements,
   db.prepare(`INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) SELECT ?,?,?,?,?,? WHERE ${condition}`).bind(crypto.randomUUID(),identity.id,active.profileId,`MISSION_${input.action.replaceAll('-','_').toUpperCase()}`,JSON.stringify({missionId:input.missionId,activityKey:input.activityKey||null,revision:next.revision}),timestamp,loaded.row.id,next.revision,active.profileId,profile.revision+1),
   ...(eventName&&analytics?.analytics_allowed===1?[db.prepare(`INSERT OR IGNORE INTO product_events(id,logical_key,event_name,account_context_id,profile_context_id,app_version,build_version,config_version,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${condition}`).bind(crypto.randomUUID(),`${eventName}:${active.profileId}:${input.missionId}:${input.activityKey||'mission'}`,eventName,identity.id,active.profileId,'0.1.0',process.env.SITES_BUILD_ID||process.env.GIT_COMMIT_SHA||'local-unpublished','tf-v1.4',JSON.stringify({missionId:input.missionId,activityKey:input.activityKey||null}),timestamp,loaded.row.id,next.revision,active.profileId,profile.revision+1)]:[]),
   ...(analytics?.analytics_allowed===1?offlineEventStatements(db,identity,active.profileId,input,timestamp,condition,conditionBindings):[]),
   db.prepare(`INSERT INTO idempotency_records(account_id,operation_key,operation,response_json,created_at) SELECT ?,?,?,?,? WHERE ${condition}`).bind(identity.id,operationKey,operation,JSON.stringify(data),timestamp,loaded.row.id,next.revision,active.profileId,profile.revision+1),
  ]);
  if(!results[0].meta.changes||!results[1].meta.changes)throw canonicalError('STALE_REVISION','Progress changed on another device. Reload before continuing.',409);
  return {data,replayed:false};
 }catch(error){const replay=await readStoredOperation(db,identity.id,operationKey,operation);if(replay)return {data:replay,replayed:true};throw error;}
}
