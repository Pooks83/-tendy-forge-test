import type {AdultIdentity} from './account-identity';
import {getActivePlayer} from './household-store';
import {canonicalError} from './identity-contract.mjs';
import {readStoredOperation,storeOperationStatement} from './idempotency-store';
import {productEventStatement} from './product-event-store';
import {createMissionExecution,transitionMission} from './mission-state.mjs';
import {GENERATOR_VERSION,generateMission} from './mission-generator.mjs';
import {calculateCompletionPackage,PROGRESSION_RULE_VERSION} from './progression.mjs';
import {findSafetyRetirement,loadPublishedCatalog,resolveSafetyRetirement} from './training-content-store';
import {buildSession,normalizeTrainingState,PATHS,WEEKS} from './training.mjs';

export const MISSION_CONTENT_VERSION=GENERATOR_VERSION;
const LEGACY_CONTENT_VERSION='tf-curriculum-v1';

type PlayerProjection={profile:{id:string;ageBand:string;equipment:string[];spaces?:string[];missionMinutes:number};training:{pathId:string;week:number;day:number;cycle?:number;safetyStopped?:boolean;sessions?:Array<{id:string}>}};
type Session=ReturnType<typeof buildSession>;
type GeneratedSession=Session&{contentVersion?:string;generatorExplanation?:Record<string,unknown>;missionSource?:string;priorityIds?:string[]};
type PlannedActivity={activityId:string;version:number;familyId:string;name:string;technicalSkillIds:number[];attributeIds:string[];developmentAttributeIds:string[];movementTags:string[];prescription:{rounds:number;repsOrTime:string;restSeconds:number;estimatedMinutes:number};equipment:string[];space:string[];setup:string;startingPosition:string;movementSteps:string[];primaryCues:string[];commonMistake:string;easierVersion:string;harderVersion:string;safetyConsiderations:string[];painStopRule:string;visualAssetId:string;caption:string;altText:string;substitution:Record<string,unknown>|null};
type ReplacementActivity=Omit<PlannedActivity,'prescription'|'substitution'>&{prescriptions:Record<number,PlannedActivity['prescription']>};
type ReplacementEvaluation={prescription:PlannedActivity['prescription'];substitution:({equipment?:string[];space?:string[];setup?:string}&Record<string,unknown>)|null};
type PlannedMission={missionId:string;version:string;source:string;objective?:{childCue?:string};priorityIds:string[];durationMinutes:number;explanation:Record<string,unknown>;orderedActivityVersions:PlannedActivity[]};
type ExecutionSnapshot=GeneratedSession&{reading?:{question:string;options:string[];answer:number;explanation:string}};
type MissionRow={id:string;profile_id:string;mission_key:string;status:string;started_at:string;completed_at:string|null;updated_at:string;revision:number;current_activity_index:number;content_version:string;execution_snapshot_json:string;paused_at:string|null;interrupted_at:string|null;abandoned_at:string|null};
type ActivityRow={id:string;mission_instance_id:string;activity_key:string;ordinal:number;status:string;result_json:string|null;rest_remaining_seconds:number;started_at:string|null;completed_at:string|null;updated_at:string;rest_completed_after_set:number};
type ProfileStateRow={state:string;revision:number};
type CompletionRow={id:string;rule_version:string;completed_prescribed_minutes:number;skipped_prescribed_minutes:number;total_prescribed_minutes:number;xp:number;journey_before_json:string;journey_after_json:string};
type AttributeCreditRow={attribute_id:string;amount_units:number};
type MutationInput={action:string;missionId:string;profileContextId:string;revision:number;activityKey?:string;remainingSeconds?:number;result?:Record<string,unknown>;reason?:string;queuedAt?:string;offlineMutationId?:string};
type MissionResult=Record<string,string|number|boolean>;
type ExecutionActivity={key:string;ordinal:number;status:string;result:MissionResult|null;restRemainingSeconds:number;restCompletedAfterSet:number;startedAt?:string;completedAt?:string;updatedAt?:string};
type MissionExecution={missionId:string;status:string;revision:number;currentActivityIndex:number;contentVersion:string;activities:ExecutionActivity[];startedAt:string;updatedAt?:string;completedAt?:string;pausedAt?:string;interruptedAt?:string;interruptionReason?:string;abandonedAt?:string};

const missionColumns='id,profile_id,mission_key,status,started_at,completed_at,updated_at,revision,current_activity_index,content_version,execution_snapshot_json,paused_at,interrupted_at,abandoned_at';
const externalStatus=(value:string)=>value.toLowerCase().replaceAll('_','-');
const internalStatus=(value:string)=>value.toUpperCase().replaceAll('-','_');
const parseJson=<T>(value:string|null,fallback:T):T=>{try{return value?JSON.parse(value):fallback;}catch{return fallback;}};
const snapshotFor=(session:GeneratedSession):ExecutionSnapshot=>{if(session.generatorExplanation)return {...session};const reading=WEEKS[session.week];return {...session,reading:{question:reading.question,options:[...reading.options],answer:reading.answer,explanation:reading.explanation}};};

const legacySession=(player:PlayerProjection)=>buildSession(player.training.pathId,player.training.week,player.training.day,player.training.cycle||0);
const safetyEligibility=(player:PlayerProjection)=>({ageBand:player.profile.ageBand,level:({foundation:1,builder:2,performance:3} as Record<string,number>)[player.training.pathId]||1,equipment:player.profile.equipment||[],spaces:player.profile.spaces||[],physicalRestrictions:[],safetyStopped:player.training.safetyStopped===true,workload:{status:'ready',maxActivityMinutes:10},objective:null,requiredInputs:[]});
function generatedSession(plan:PlannedMission):GeneratedSession{
 const [pathId,week,day]=String(plan.missionId).split(':');
 return {id:plan.missionId,pathId,week:Number(week),day:Number(day),title:plan.objective?.childCue||'Today’s mission',minutes:plan.durationMinutes,contentVersion:plan.version,missionSource:plan.source,priorityIds:plan.priorityIds,generatorExplanation:plan.explanation,blocks:plan.orderedActivityVersions.map(item=>({id:item.activityId,activityId:item.activityId,version:item.version,familyId:item.familyId,name:item.name,group:item.attributeIds[0]||'DEVELOP',developmentAttributeIds:[...item.developmentAttributeIds],equipment:item.equipment.join(', ')||'None',equipmentIds:item.equipment,space:item.space.join(', ')||'Adult-confirmed clear area',spaceIds:item.space,sets:item.prescription.rounds,target:item.prescription.repsOrTime,restSeconds:item.prescription.restSeconds,setup:item.setup,startingPosition:item.startingPosition,steps:item.movementSteps,cue:item.primaryCues.join(' '),primaryCues:item.primaryCues,commonMistake:item.commonMistake,easier:item.easierVersion,harder:item.harderVersion,safety:item.safetyConsiderations.join(' '),painStopRule:item.painStopRule,visualAssetId:item.visualAssetId,caption:item.caption,altText:item.altText,minutes:item.prescription.estimatedMinutes,lowImpact:item.movementTags.includes('recovery')||item.movementTags.includes('seated'),skills:item.technicalSkillIds,substitution:item.substitution,offIce:true}))} as unknown as GeneratedSession;
}

function replacementBlock(activityKey:string,activity:ReplacementActivity,evaluation:ReplacementEvaluation){
 const prescription=evaluation.prescription;const substitution=evaluation.substitution;
 return {id:activityKey,activityId:activity.activityId,version:activity.version,familyId:activity.familyId,name:activity.name,group:activity.attributeIds[0]||'DEVELOP',developmentAttributeIds:[...activity.developmentAttributeIds],equipment:(substitution?.equipment||activity.equipment).join(', ')||'None',equipmentIds:[...(substitution?.equipment||activity.equipment)],space:(substitution?.space||activity.space).join(', ')||'Adult-confirmed clear area',spaceIds:[...(substitution?.space||activity.space)],sets:prescription.rounds,target:prescription.repsOrTime,restSeconds:prescription.restSeconds,setup:substitution?.setup||activity.setup,startingPosition:activity.startingPosition,steps:[...activity.movementSteps],cue:activity.primaryCues.join(' '),primaryCues:[...activity.primaryCues],commonMistake:activity.commonMistake,easier:activity.easierVersion,harder:activity.harderVersion,safety:activity.safetyConsiderations.join(' '),painStopRule:activity.painStopRule,visualAssetId:activity.visualAssetId,caption:activity.caption,altText:activity.altText,minutes:prescription.estimatedMinutes,lowImpact:activity.movementTags.includes('recovery')||activity.movementTags.includes('seated'),skills:[...activity.technicalSkillIds],substitution:substitution?{...substitution}:null,offIce:true};
}

async function planningHistory(db:D1Database,profileId:string){
 const rows=await db.prepare("SELECT execution_snapshot_json FROM mission_instances WHERE profile_id=? AND content_version=? AND UPPER(REPLACE(status,'-','_'))='COMPLETED' ORDER BY completed_at DESC LIMIT 20").bind(profileId,MISSION_CONTENT_VERSION).all<{execution_snapshot_json:string}>();
 const families=rows.results.flatMap(row=>parseJson<{blocks?:Array<{familyId?:string}>}>(row.execution_snapshot_json,{}).blocks||[]).flatMap(block=>block.familyId?[block.familyId]:[]);
 const counts=new Map<string,number>();for(const familyId of families)counts.set(familyId,(counts.get(familyId)||0)+1);
 return {coverageHistory:[...counts].map(([familyId,count])=>({familyId,count})),varietyHistory:families.slice(0,8)};
}

async function planCurrent(db:D1Database,player:PlayerProjection){
 const fallback=legacySession(player);const catalog=await loadPublishedCatalog(db);const history=await planningHistory(db,player.profile.id);const plan=generateMission({profileContextId:player.profile.id,planKey:fallback.id,durationMinutes:player.profile.missionMinutes,ageBand:player.profile.ageBand,level:({foundation:1,builder:2,performance:3} as Record<string,number>)[player.training.pathId]||1,equipment:player.profile.equipment||[],spaces:player.profile.spaces||[],physicalRestrictions:[],safetyStopped:player.training.safetyStopped===true,workload:{status:'ready',maxActivityMinutes:10},requiredInputs:[],activePriorities:[],coachFocus:null,dueRetest:null,...history,catalog,rewardRuleVersion:'tf-reward-v1'});
 if('orderedActivityVersions' in plan){const missionPlan=plan as unknown as PlannedMission;return {kind:'mission' as const,profileId:player.profile.id,missionId:fallback.id,session:generatedSession(missionPlan),plan:missionPlan};}
 return {kind:'unavailable' as const,profileId:player.profile.id,missionId:fallback.id,unavailable:plan};
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

async function storedCompletionSummary(db:D1Database,row:MissionRow){
 const completion=await db.prepare('SELECT id,rule_version,completed_prescribed_minutes,skipped_prescribed_minutes,total_prescribed_minutes,xp,journey_before_json,journey_after_json FROM mission_completion_ledger WHERE mission_instance_id=?').bind(row.id).first<CompletionRow>();
 if(!completion)return null;
 const attributes=(await db.prepare('SELECT attribute_id,amount_units FROM attribute_progress_ledger WHERE completion_id=? ORDER BY attribute_id').bind(completion.id).all<AttributeCreditRow>()).results;
 const reward=await db.prepare('SELECT reward_id FROM reward_entitlements WHERE source_completion_id=? ORDER BY reward_id LIMIT 1').bind(completion.id).first<{reward_id:string}>();
 return {classification:'CREDITED',ruleVersion:completion.rule_version,completedPrescribedMinutes:completion.completed_prescribed_minutes,skippedPrescribedMinutes:completion.skipped_prescribed_minutes,totalPrescribedMinutes:completion.total_prescribed_minutes,completionMultiplier:completion.completed_prescribed_minutes/completion.total_prescribed_minutes,xp:completion.xp,attributes:Object.fromEntries(attributes.map(item=>[item.attribute_id,item.amount_units/1000])),journeyBefore:parseJson(completion.journey_before_json,{}),journeyAfter:parseJson(completion.journey_after_json,{}),newReward:reward?.reward_id||null};
}

async function completedProjection(db:D1Database,row:MissionRow,activities:ActivityRow[]){
 const completionSummary=await storedCompletionSummary(db,row);return completionSummary?{...projection(row,activities),completionSummary}:projection(row,activities);
}

async function safetyHold(db:D1Database,row:MissionRow,activities:ActivityRow[],player:PlayerProjection){
 const snapshot=parseJson<ExecutionSnapshot>(row.execution_snapshot_json,{blocks:[]} as unknown as ExecutionSnapshot);
 const unfinished=new Set(activities.filter(item=>!['COMPLETED','SKIPPED'].includes(internalStatus(item.status))).map(item=>item.activity_key));
 const references=(snapshot.blocks||[]).filter(block=>unfinished.has(block.id)).flatMap(block=>{
  const value=block as typeof block&{activityId?:string;version?:number};
  return value.activityId&&Number.isInteger(value.version)?[{activityKey:block.id,activityId:value.activityId,version:value.version as number}]:[];
 });
 return findSafetyRetirement(db,references,safetyEligibility(player));
}

async function safeProjection(db:D1Database,row:MissionRow,activities:ActivityRow[],player:PlayerProjection,now=new Date()){
 const projected=projection(row,activities,now);const hold=await safetyHold(db,row,activities,player);return hold?{...projected,safetyHold:hold}:projected;
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
  db.prepare('UPDATE mission_instances SET content_version=?,execution_snapshot_json=?,current_activity_index=?,updated_at=? WHERE id=? AND content_version=?').bind(LEGACY_CONTENT_VERSION,JSON.stringify(executionSnapshot),currentIndex<0?migrated.length:currentIndex,now,row.id,'tf-curriculum-legacy'),
  ...migrated.map(activity=>db.prepare('INSERT OR IGNORE INTO activity_instances(id,mission_instance_id,activity_key,ordinal,status,result_json,rest_remaining_seconds,started_at,completed_at,updated_at,rest_completed_after_set) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND content_version=?)').bind(activity.id,row.id,activity.key,activity.ordinal,activity.status,activity.result?JSON.stringify(activity.result):null,activity.remaining,activity.startedAt,activity.completedAt,now,activity.restCompletedAfterSet,row.id,LEGACY_CONTENT_VERSION)),
  db.prepare('INSERT OR IGNORE INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND content_version=?)').bind(`mission-hydrate:${row.id}`,identity.id,row.profile_id,'MISSION_EXECUTION_HYDRATED',JSON.stringify({missionId:row.mission_key,contentVersion:LEGACY_CONTENT_VERSION}),now,row.id,LEGACY_CONTENT_VERSION),
 ]);
 return {...row,content_version:LEGACY_CONTENT_VERSION,execution_snapshot_json:JSON.stringify(executionSnapshot),current_activity_index:currentIndex<0?migrated.length:currentIndex,updated_at:now};
}

async function loadMission(db:D1Database,identity:AdultIdentity,profileId:string,missionId:string,session:Session){
 let row=await db.prepare(`SELECT ${missionColumns} FROM mission_instances WHERE profile_id=? AND mission_key=?`).bind(profileId,missionId).first<MissionRow>();
 if(!row)return null;
 row=await hydrateLegacyMission(db,identity,row,session);
 return {row,activities:await activityRows(db,row.id)};
}

export async function getCurrentMission(db:D1Database,identity:AdultIdentity){
 const player=await getActivePlayer(db,identity) as unknown as PlayerProjection;const profileId=player.profile.id;const fallback=legacySession(player);
 const active=await db.prepare(`SELECT ${missionColumns} FROM mission_instances WHERE profile_id=? AND UPPER(REPLACE(status,'-','_')) IN ('IN_PROGRESS','PAUSED','INTERRUPTED') ORDER BY started_at LIMIT 1`).bind(profileId).first<MissionRow>();
 if(active){
  const hydrated=await hydrateLegacyMission(db,identity,active,sessionForMission(active.mission_key,fallback));
  const activities=await activityRows(db,hydrated.id);return safeProjection(db,hydrated,activities,player);
 }
 const planned=await planCurrent(db,player);
 if(planned.kind==='unavailable')return {missionId:planned.missionId,profileContextId:profileId,status:'unavailable',revision:0,activities:[],executionSnapshot:null,contentVersion:MISSION_CONTENT_VERSION,unavailable:planned.unavailable};
 const loaded=await loadMission(db,identity,profileId,planned.missionId,planned.session);
 return loaded?safeProjection(db,loaded.row,loaded.activities,player):{missionId:planned.missionId,profileContextId:profileId,status:'not-started',revision:0,activities:[],executionSnapshot:planned.session,contentVersion:MISSION_CONTENT_VERSION};
}

export async function startCurrentMission(db:D1Database,identity:AdultIdentity,operationKey:string,now=new Date()){
 const player=await getActivePlayer(db,identity) as unknown as PlayerProjection;const profileId=player.profile.id;const fallback=legacySession(player);
 if(player.training.safetyStopped)throw canonicalError('SAFETY_STOPPED','Training is paused. Ask a parent or guardian to check in before continuing.',409);
 const challenge=await db.prepare('SELECT status FROM first_challenge_results WHERE profile_id=?').bind(profileId).first<{status:string}>();
 if(challenge?.status!=='completed')throw canonicalError('INVALID_STATE_TRANSITION','Finish the 60-second first challenge before starting this mission.',409);
 const operation=`mission-start:${profileId}`;
 const stored=await readStoredOperation(db,identity.id,operationKey,operation);
 if(stored)return {data:stored,replayed:true};
 const active=await db.prepare(`SELECT ${missionColumns} FROM mission_instances WHERE profile_id=? AND UPPER(REPLACE(status,'-','_')) IN ('IN_PROGRESS','PAUSED','INTERRUPTED') ORDER BY started_at LIMIT 1`).bind(profileId).first<MissionRow>();
 if(active){const hydrated=await hydrateLegacyMission(db,identity,active,sessionForMission(active.mission_key,fallback));const activities=await activityRows(db,hydrated.id);return {data:await safeProjection(db,hydrated,activities,player),replayed:true};}
 const planned=await planCurrent(db,player);if(planned.kind==='unavailable')throw canonicalError(planned.unavailable.code,planned.unavailable.message,409);
 const {missionId,session}=planned;
 const existing=await loadMission(db,identity,profileId,missionId,session);
 if(existing)return {data:projection(existing.row,existing.activities),replayed:true};
 const timestamp=now.toISOString();const id=crypto.randomUUID();const executionSnapshot=snapshotFor(session);const contentVersion=session.contentVersion||MISSION_CONTENT_VERSION;
 const execution=transitionMission(createMissionExecution({missionId,activityKeys:session.blocks.map(block=>block.id),contentVersion}),{type:'START'},timestamp);
 const row:MissionRow={id,profile_id:profileId,mission_key:missionId,status:execution.status,started_at:execution.startedAt,completed_at:null,updated_at:timestamp,revision:execution.revision,current_activity_index:0,content_version:contentVersion,execution_snapshot_json:JSON.stringify(executionSnapshot),paused_at:null,interrupted_at:null,abandoned_at:null};
 const rows:ActivityRow[]=execution.activities.map((activity:{key:string;ordinal:number;status:string;restCompletedAfterSet:number})=>({id:crypto.randomUUID(),mission_instance_id:id,activity_key:activity.key,ordinal:activity.ordinal,status:activity.status,result_json:null,rest_remaining_seconds:0,started_at:null,completed_at:null,updated_at:timestamp,rest_completed_after_set:activity.restCompletedAfterSet}));
 const data=projection(row,rows);
 const preference=await db.prepare('SELECT analytics_allowed FROM privacy_preferences WHERE profile_id=?').bind(profileId).first<{analytics_allowed:number}>();
 try{
  await db.batch([
   db.prepare('INSERT INTO mission_instances(id,profile_id,mission_key,status,started_at,completed_at,updated_at,revision,current_activity_index,content_version,execution_snapshot_json,paused_at,interrupted_at,abandoned_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,profileId,missionId,execution.status,timestamp,null,timestamp,execution.revision,0,contentVersion,JSON.stringify(executionSnapshot),null,null,null),
   ...rows.map(item=>db.prepare('INSERT INTO activity_instances(id,mission_instance_id,activity_key,ordinal,status,result_json,rest_remaining_seconds,started_at,completed_at,updated_at,rest_completed_after_set) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(item.id,id,item.activity_key,item.ordinal,item.status,null,0,null,null,timestamp,0)),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity.id,profileId,'MISSION_STARTED',JSON.stringify({missionId,contentVersion}),timestamp),
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

function legacyProjection(raw:string,snapshot:Session,next:MissionExecution,timestamp:string,safetyStopped=false,journeyAfter?:{pathId:string;week:number;day:number;cycle:number}){
 const state=normalizeTrainingState(parseJson(raw,{}));const sets={...state.sets};const rests={...state.rests};const answers={...state.answers};
 for(const activity of next.activities){
  const block=snapshot.blocks.find(item=>item.id===activity.key);if(!block)continue;const key=`${next.missionId}:${activity.key}`;
  if(['COMPLETED','SKIPPED'].includes(activity.status))for(let index=0;index<block.sets;index++)sets[`${key}:${index}`]=true;
  if(activity.status==='RESTING')rests[key]={until:0,remaining:activity.restRemainingSeconds||0};else if(rests[key])rests[key]={until:0,remaining:0};
  if(activity.key==='read'&&typeof activity.result?.answer==='number')answers[next.missionId]={choice:activity.result.answer,correct:activity.result.correct===true};
 }
 const sessions=[...state.sessions];if(next.status==='COMPLETED'&&!sessions.some(item=>item.id===next.missionId))sessions.push({id:next.missionId,date:timestamp,pathId:snapshot.pathId,week:snapshot.week,day:snapshot.day});
 return {...state,...(journeyAfter||{}),sets,rests,answers,sessions,safetyStopped:safetyStopped||state.safetyStopped};
}

function eventFor(input:MutationInput){return ({'start-activity':'activity_started','complete-activity':'activity_completed','skip-activity':'activity_skipped','complete-mission':'mission_completed','abandon':'mission_abandoned'} as Record<string,string>)[input.action]||null;}

function mutationOperation(profileId:string,input:MutationInput){
 const result=input.result?{completedSets:input.result.completedSets??null,usedEasierVersion:input.result.usedEasierVersion===true,answer:input.result.answer??null}:null;
 return `mission-action:${profileId}:${JSON.stringify({action:input.action,missionId:input.missionId,profileContextId:input.profileContextId,activityKey:input.activityKey??null,result,reason:input.reason??null,queuedAt:input.queuedAt??null,offlineMutationId:input.offlineMutationId??null})}`;
}

async function adoptSafetyReplacement(db:D1Database,identity:AdultIdentity,player:PlayerProjection,input:MutationInput,operationKey:string,operation:string,loaded:{row:MissionRow;activities:ActivityRow[]},now:Date){
 const owner=await db.prepare('SELECT 1 AS allowed FROM training_profiles WHERE id=? AND owner_id=?').bind(player.profile.id,identity.id).first<{allowed:number}>();if(!owner)throw canonicalError('OWNER_PERMISSION_REQUIRED','A parent or guardian who owns this profile must review the replacement.',403);
 if(input.revision!==loaded.row.revision)throw canonicalError('STALE_REVISION','Progress changed on another device. Reload before continuing.',409);
 const snapshot=parseJson<ExecutionSnapshot>(loaded.row.execution_snapshot_json,{blocks:[]} as unknown as ExecutionSnapshot);const prior=snapshot.blocks.find(block=>block.id===input.activityKey) as (ExecutionSnapshot['blocks'][number]&{activityId?:string;version?:number})|undefined;
 if(!prior?.activityId||!Number.isInteger(prior.version))throw canonicalError('REPLACEMENT_UNAVAILABLE','This replacement is no longer available. Ask an adult to review the training plan.',409);
 const resolved=await resolveSafetyRetirement(db,[{activityKey:prior.id,activityId:prior.activityId,version:prior.version as number}],safetyEligibility(player));
 if(!resolved?.replacement)throw canonicalError('REPLACEMENT_UNAVAILABLE','This replacement is no longer available. Ask an adult to review the training plan.',409);
 const target=loaded.activities.find(item=>item.activity_key===input.activityKey);if(!target||['COMPLETED','SKIPPED'].includes(internalStatus(target.status)))throw canonicalError('INVALID_STATE_TRANSITION','Only an unfinished withdrawn activity can be replaced.',409);
 const replacement=resolved.replacement;const nextSnapshot={...snapshot,blocks:snapshot.blocks.map(block=>block.id===input.activityKey?replacementBlock(block.id,replacement.activity,replacement.evaluation):block)};const timestamp=now.toISOString();const nextRevision=loaded.row.revision+1;
 const priorEvidence={status:externalStatus(target.status),result:parseJson(target.result_json,null)};const nextActivities=loaded.activities.map(item=>item.id===target.id?{...item,status:'READY',result_json:null,rest_remaining_seconds:0,rest_completed_after_set:0,started_at:null,completed_at:null,updated_at:timestamp}:item);const nextRow={...loaded.row,revision:nextRevision,execution_snapshot_json:JSON.stringify(nextSnapshot),updated_at:timestamp};const data=projection(nextRow,nextActivities,now);
 const metadata=JSON.stringify({missionId:input.missionId,activityKey:input.activityKey,from:{activityId:prior.activityId,version:prior.version},to:{activityId:replacement.activity.activityId,version:replacement.activity.version},priorEvidence});
 const results=await db.batch([
  db.prepare('UPDATE mission_instances SET revision=?,execution_snapshot_json=?,updated_at=? WHERE id=? AND revision=?').bind(nextRevision,JSON.stringify(nextSnapshot),timestamp,loaded.row.id,loaded.row.revision),
  db.prepare('UPDATE activity_instances SET status=?,result_json=?,rest_remaining_seconds=0,rest_completed_after_set=0,started_at=NULL,completed_at=NULL,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND revision=?)').bind('READY',nextActivities.find(item=>item.id===target.id)?.result_json||null,timestamp,target.id,loaded.row.id,nextRevision),
  db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND revision=?)').bind(crypto.randomUUID(),identity.id,player.profile.id,'MISSION_SAFETY_REPLACEMENT_ADOPTED',metadata,timestamp,loaded.row.id,nextRevision),
  db.prepare('INSERT INTO idempotency_records(account_id,operation_key,operation,response_json,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND revision=?)').bind(identity.id,operationKey,operation,JSON.stringify(data),timestamp,loaded.row.id,nextRevision),
 ]);
 if(!results[0].meta.changes||!results[1].meta.changes)throw canonicalError('STALE_REVISION','Progress changed on another device. Reload before continuing.',409);
 return {data,replayed:false};
}

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
 const player=await getActivePlayer(db,identity) as unknown as PlayerProjection;
 const active={profileId:player.profile.id,player,session:legacySession(player)};
 if(input.profileContextId!==active.profileId)throw canonicalError('PLAYER_CONTEXT_REQUIRED','Return to the goalie this progress belongs to before syncing it.',409);
 const operation=mutationOperation(active.profileId,input);const stored=await readStoredOperation(db,identity.id,operationKey,operation);if(stored)return {data:stored,replayed:true};
 const loaded=await loadMission(db,identity,active.profileId,input.missionId,sessionForMission(input.missionId,active.session));if(!loaded)throw canonicalError('MISSION_NOT_FOUND','Start today’s mission before recording progress.',404);
 if(input.action==='complete-mission'&&internalStatus(loaded.row.status)==='COMPLETED')return {data:await completedProjection(db,loaded.row,loaded.activities),replayed:true};
 if(input.action==='replace-retired-activity')return adoptSafetyReplacement(db,identity,player,input,operationKey,operation,loaded,now);
 const hold=await safetyHold(db,loaded.row,loaded.activities,player);if(hold)throw canonicalError(hold.code,hold.message,409);
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
 const priorState=normalizeTrainingState(parseJson(profile.state,{}));const path=PATHS.find(item=>item.id===priorState.pathId);
 const progression=input.action==='complete-mission'&&loaded.row.content_version===MISSION_CONTENT_VERSION?calculateCompletionPackage({missionInstanceId:loaded.row.id,profileId:active.profileId,snapshot,activities:next.activities,journey:{pathId:priorState.pathId,week:priorState.week,day:priorState.day,cycle:priorState.cycle||0,daysPerWeek:path?.days||0,weeksPerCycle:WEEKS.length}}):null;
 const priorReward=progression?.firstSaveEligible?await db.prepare('SELECT reward_id FROM reward_entitlements WHERE profile_id=? AND reward_id=?').bind(active.profileId,'FIRST_SAVE').first<{reward_id:string}>():null;
 const completionId=progression?crypto.randomUUID():null;const newReward=Boolean(progression?.firstSaveEligible&&!priorReward);
 const completionSummary=progression?{classification:'CREDITED',ruleVersion:progression.ruleVersion,completedPrescribedMinutes:progression.completedPrescribedMinutes,skippedPrescribedMinutes:progression.skippedPrescribedMinutes,totalPrescribedMinutes:progression.totalPrescribedMinutes,completionMultiplier:progression.completionMultiplier,xp:progression.xp,attributes:Object.fromEntries(Object.entries(progression.attributeUnits).map(([id,units])=>[id,(units as number)/1000])),journeyBefore:progression.journeyBefore,journeyAfter:progression.journeyAfter,newReward:newReward?'FIRST_SAVE':null}:input.action==='complete-mission'?{classification:'LEGACY_UNCREDITED',ruleVersion:null,completedPrescribedMinutes:0,skippedPrescribedMinutes:0,totalPrescribedMinutes:0,completionMultiplier:0,xp:0,attributes:{},journeyBefore:{pathId:priorState.pathId,week:priorState.week,day:priorState.day,cycle:priorState.cycle||0},journeyAfter:{pathId:priorState.pathId,week:priorState.week,day:priorState.day,cycle:priorState.cycle||0},newReward:null}:null;
 const legacy=legacyProjection(profile.state,snapshot,next,timestamp,input.action==='safety-stop',progression?.journeyAfter);const nextRows=next.activities;
 const projectedRows=loaded.activities.map((row,index)=>({...row,status:nextRows[index].status,result_json:nextRows[index].result?JSON.stringify(nextRows[index].result):null,rest_remaining_seconds:nextRows[index].restRemainingSeconds||0,rest_completed_after_set:nextRows[index].restCompletedAfterSet||0,started_at:nextRows[index].startedAt||null,completed_at:nextRows[index].completedAt||null,updated_at:timestamp}));
 const projected=projection({...loaded.row,status:next.status,revision:next.revision,current_activity_index:next.currentActivityIndex,completed_at:next.completedAt||null,updated_at:timestamp,paused_at:next.pausedAt||loaded.row.paused_at,interrupted_at:next.interruptedAt||loaded.row.interrupted_at,abandoned_at:next.abandonedAt||loaded.row.abandoned_at},projectedRows);const data=completionSummary?{...projected,completionSummary}:projected;
 const eventName=eventFor(input);const analytics=await db.prepare('SELECT analytics_allowed FROM privacy_preferences WHERE profile_id=?').bind(active.profileId).first<{analytics_allowed:number}>();
 const condition='EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM training_profiles WHERE id=? AND revision=?)';
 const conditionBindings=[loaded.row.id,next.revision,active.profileId,profile.revision+1];
 const activityStatements=nextRows.map((activity,index)=>db.prepare(`UPDATE activity_instances SET status=?,result_json=?,rest_remaining_seconds=?,rest_completed_after_set=?,started_at=?,completed_at=?,updated_at=? WHERE id=? AND ${condition}`).bind(activity.status,activity.result?JSON.stringify(activity.result):null,activity.restRemainingSeconds||0,activity.restCompletedAfterSet||0,activity.startedAt||null,activity.completedAt||null,timestamp,loaded.activities[index].id,loaded.row.id,next.revision,active.profileId,profile.revision+1));
 const progressionStatements=progression&&completionId?[
  db.prepare(`INSERT INTO mission_completion_ledger(id,mission_instance_id,profile_id,rule_version,content_version,completed_prescribed_minutes,skipped_prescribed_minutes,total_prescribed_minutes,completion_multiplier_milli,xp,xp_units,journey_before_json,journey_after_json,source_operation_key,completed_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${condition}`).bind(completionId,loaded.row.id,active.profileId,PROGRESSION_RULE_VERSION,loaded.row.content_version,progression.completedPrescribedMinutes,progression.skippedPrescribedMinutes,progression.totalPrescribedMinutes,Math.round(progression.completionMultiplier*1000),progression.xp,progression.xpUnits,JSON.stringify(progression.journeyBefore),JSON.stringify(progression.journeyAfter),operationKey,timestamp,...conditionBindings),
  db.prepare(`INSERT INTO xp_ledger(id,profile_id,completion_id,logical_source,amount,amount_units,rule_version,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${condition}`).bind(crypto.randomUUID(),active.profileId,completionId,`mission:${loaded.row.id}`,progression.xp,progression.xpUnits,PROGRESSION_RULE_VERSION,timestamp,...conditionBindings),
  ...Object.entries(progression.attributeUnits).map(([attributeId,amountUnits])=>db.prepare(`INSERT INTO attribute_progress_ledger(completion_id,profile_id,attribute_id,amount_units,rule_version,created_at) SELECT ?,?,?,?,?,? WHERE ${condition}`).bind(completionId,active.profileId,attributeId,amountUnits,PROGRESSION_RULE_VERSION,timestamp,...conditionBindings)),
  ...(newReward?[db.prepare(`INSERT INTO reward_entitlements(profile_id,reward_id,source_completion_id,rule_version,awarded_at) SELECT ?,?,?,?,? WHERE ${condition}`).bind(active.profileId,'FIRST_SAVE',completionId,PROGRESSION_RULE_VERSION,timestamp,...conditionBindings)]:[]),
 ]:[];
 try{
  const results=await db.batch([
   db.prepare('UPDATE mission_instances SET status=?,revision=?,current_activity_index=?,completed_at=?,paused_at=?,interrupted_at=?,abandoned_at=?,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM training_profiles WHERE id=? AND revision=?)').bind(next.status,next.revision,next.currentActivityIndex,next.completedAt||null,next.pausedAt||loaded.row.paused_at,next.interruptedAt||loaded.row.interrupted_at,next.abandonedAt||loaded.row.abandoned_at,timestamp,loaded.row.id,loaded.row.revision,active.profileId,profile.revision),
   db.prepare('UPDATE training_profiles SET state=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM mission_instances WHERE id=? AND revision=?)').bind(JSON.stringify(legacy),timestamp,active.profileId,profile.revision,loaded.row.id,next.revision),
   ...progressionStatements,
   ...activityStatements,
   db.prepare(`INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) SELECT ?,?,?,?,?,? WHERE ${condition}`).bind(crypto.randomUUID(),identity.id,active.profileId,`MISSION_${input.action.replaceAll('-','_').toUpperCase()}`,JSON.stringify({missionId:input.missionId,activityKey:input.activityKey||null,revision:next.revision}),timestamp,loaded.row.id,next.revision,active.profileId,profile.revision+1),
   ...(eventName&&analytics?.analytics_allowed===1?[db.prepare(`INSERT OR IGNORE INTO product_events(id,logical_key,event_name,account_context_id,profile_context_id,app_version,build_version,config_version,metadata_json,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${condition}`).bind(crypto.randomUUID(),`${eventName}:${active.profileId}:${input.missionId}:${input.activityKey||'mission'}`,eventName,identity.id,active.profileId,'0.1.0',process.env.SITES_BUILD_ID||process.env.GIT_COMMIT_SHA||'local-unpublished','tf-v1.4',JSON.stringify({missionId:input.missionId,activityKey:input.activityKey||null}),timestamp,loaded.row.id,next.revision,active.profileId,profile.revision+1)]:[]),
   ...(analytics?.analytics_allowed===1?offlineEventStatements(db,identity,active.profileId,input,timestamp,condition,conditionBindings):[]),
   db.prepare(`INSERT INTO idempotency_records(account_id,operation_key,operation,response_json,created_at) SELECT ?,?,?,?,? WHERE ${condition}`).bind(identity.id,operationKey,operation,JSON.stringify(data),timestamp,loaded.row.id,next.revision,active.profileId,profile.revision+1),
  ]);
  if(!results[0].meta.changes||!results[1].meta.changes||progressionStatements.some((_,index)=>index<2&&!results[index+2].meta.changes))throw canonicalError('STALE_REVISION','Progress changed on another device. Reload before continuing.',409);
  return {data,replayed:false};
 }catch(error){const replay=await readStoredOperation(db,identity.id,operationKey,operation);if(replay)return {data:replay,replayed:true};if(input.action==='complete-mission'){const current=await loadMission(db,identity,active.profileId,input.missionId,sessionForMission(input.missionId,active.session));if(current&&internalStatus(current.row.status)==='COMPLETED'&&await storedCompletionSummary(db,current.row))return {data:await completedProjection(db,current.row,current.activities),replayed:true};}throw error;}
}
