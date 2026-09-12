import {newTrainingState} from './training.mjs';
import {buildPlayerProjection,canonicalError,normalizeOnboardingInput} from './identity-contract.mjs';
import {readStoredOperation,storeOperationStatement} from './idempotency-store';
import {productEventStatement} from './product-event-store';
import type {AdultIdentity} from './account-identity';

type HouseholdRow={id:string;nickname:string;age_band:string;catches:string|null;experience:string|null;equipment_json:string|null;available_spaces_json:string|null;planned_days_json:string|null;mission_minutes:number|null;setup_status:string;active:number};
type PlayerRow={id:string;nickname:string;age_band:string;catches:string|null;experience:string|null;equipment_json:string|null;available_spaces_json:string|null;planned_days_json:string|null;mission_minutes:number|null;setup_status:string;state:string;revision:number};

const parseArray=(value:string|null)=>{try{return value?JSON.parse(value):[];}catch{return [];}};

export async function createGoalieSetup(db:D1Database,identity:AdultIdentity,rawInput:unknown,operationKey:string){
 const input=normalizeOnboardingInput(rawInput);
 if(!input.trainingEligible)throw canonicalError('UNSUPPORTED_AGE','This program is designed for ages 10–15. We can’t assign this training for the age selected.',400);
 const stored=await readStoredOperation(db,identity.id,operationKey,'create-goalie');
 if(stored)return {data:stored,replayed:true};
 const count=await db.prepare('SELECT count(*) AS n FROM training_profiles WHERE owner_id=?').bind(identity.id).first<{n:number}>();
 if((count?.n??0)>=8)throw canonicalError('INVALID_SETUP','This household already has eight goalie profiles.',400);
 const now=new Date().toISOString();
 const profileId=crypto.randomUUID();
 const consentId=crypto.randomUUID();
 const auditId=crypto.randomUUID();
 const response={profileId,setupStatus:'ready' as const};
 const purposes=JSON.stringify(['training','progress','safety']);
 try{
  await db.batch([
   db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,revision,created_at,catches,experience,equipment_json,available_spaces_json,planned_days_json,mission_minutes,setup_status,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM training_profiles WHERE owner_id=?)<8').bind(profileId,identity.id,input.nickname,'',input.ageBand,JSON.stringify(newTrainingState()),0,now,input.catches,input.experience,JSON.stringify(input.equipment),JSON.stringify(input.spaces),JSON.stringify(input.plannedDays),input.missionMinutes,'ready',now,identity.id),
   db.prepare('INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind(identity.id,profileId,'guardian','active',now),
   db.prepare('INSERT INTO consent_records(id,account_id,profile_id,consent_version,purposes_json,policy_version,accepted_at) VALUES(?,?,?,?,?,?,?)').bind(consentId,identity.id,profileId,input.consentVersion,purposes,input.policyVersion,now),
   db.prepare('INSERT INTO privacy_preferences(profile_id,analytics_allowed,notifications_allowed,clips_allowed,updated_at) VALUES(?,?,?,?,?)').bind(profileId,input.optionalPermissions.analytics?1:0,input.optionalPermissions.notifications?1:0,input.optionalPermissions.clips?1:0,now),
   db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET profile_id=excluded.profile_id,updated_at=excluded.updated_at').bind(identity.id,profileId,now),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(auditId,identity.id,profileId,'PLAYER_PROFILE_CREATED',JSON.stringify({consentVersion:input.consentVersion,policyVersion:input.policyVersion}),now),
   ...(input.optionalPermissions.analytics?[
    productEventStatement(db,{eventName:'player_created',logicalKey:`player_created:${profileId}`,accountContextId:identity.id,profileContextId:profileId},now),
    productEventStatement(db,{eventName:'onboarding_completed',logicalKey:`onboarding_completed:${profileId}`,accountContextId:identity.id,profileContextId:profileId},now),
   ]:[]),
   storeOperationStatement(db,identity.id,operationKey,'create-goalie',response,now),
   db.prepare('DELETE FROM onboarding_drafts WHERE account_id=?').bind(identity.id),
  ]);
  return {data:response,replayed:false};
 }catch(error){
 const replay=await readStoredOperation(db,identity.id,operationKey,'create-goalie');
 if(replay)return {data:replay,replayed:true};
  const currentCount=await db.prepare('SELECT count(*) AS n FROM training_profiles WHERE owner_id=?').bind(identity.id).first<{n:number}>();
  if((currentCount?.n??0)>=8)throw canonicalError('INVALID_SETUP','This household already has eight goalie profiles.',400);
  throw error;
 }
}

export async function reconcileLegacySetup(db:D1Database,identity:AdultIdentity,profileId:string,rawInput:unknown,operationKey:string){
 if(!profileId)throw canonicalError('INVALID_SETUP','Choose the goalie to review.',400);
 const input=normalizeOnboardingInput(rawInput);
 if(!input.trainingEligible)throw canonicalError('UNSUPPORTED_AGE','This program is designed for ages 10–15. We can’t assign this training for the age selected.',400);
 const operation=`reconcile-legacy:${profileId}`;
 const stored=await readStoredOperation(db,identity.id,operationKey,operation);
 if(stored)return {data:stored,replayed:true};
 const profile=await db.prepare('SELECT id,nickname,setup_status FROM training_profiles WHERE id=? AND owner_id=?').bind(profileId,identity.id).first<{id:string;nickname:string;setup_status:string}>();
 if(!profile)throw canonicalError('FORBIDDEN','That goalie is not available to this account.',403);
 if(profile.setup_status==='ready')return {data:{profileId,setupStatus:'ready' as const},replayed:true};
 const now=new Date().toISOString();
 const response={profileId,setupStatus:'ready' as const};
 const consentId=`legacy-consent:${profileId}:${input.consentVersion}`;
 const auditId=`legacy-reconcile:${profileId}`;
 try{
  await db.batch([
   db.prepare("UPDATE training_profiles SET nickname=?,age_band=?,catches=?,experience=?,equipment_json=?,available_spaces_json=?,planned_days_json=?,mission_minutes=?,setup_status='ready',updated_at=? WHERE id=? AND owner_id=? AND setup_status='legacy-review-required'").bind(input.nickname,input.ageBand,input.catches,input.experience,JSON.stringify(input.equipment),JSON.stringify(input.spaces),JSON.stringify(input.plannedDays),input.missionMinutes,now,profileId,identity.id),
   db.prepare('INSERT OR IGNORE INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind(identity.id,profileId,'guardian','active',now),
   db.prepare('INSERT INTO consent_records(id,account_id,profile_id,consent_version,purposes_json,policy_version,accepted_at) VALUES(?,?,?,?,?,?,?)').bind(consentId,identity.id,profileId,input.consentVersion,JSON.stringify(['training','progress','safety']),input.policyVersion,now),
   db.prepare('INSERT INTO privacy_preferences(profile_id,analytics_allowed,notifications_allowed,clips_allowed,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET analytics_allowed=excluded.analytics_allowed,notifications_allowed=excluded.notifications_allowed,clips_allowed=excluded.clips_allowed,updated_at=excluded.updated_at').bind(profileId,input.optionalPermissions.analytics?1:0,input.optionalPermissions.notifications?1:0,input.optionalPermissions.clips?1:0,now),
   db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET profile_id=excluded.profile_id,updated_at=excluded.updated_at').bind(identity.id,profileId,now),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(auditId,identity.id,profileId,'LEGACY_SETUP_RECONCILED',JSON.stringify({consentVersion:input.consentVersion,policyVersion:input.policyVersion}),now),
   storeOperationStatement(db,identity.id,operationKey,operation,response,now),
   db.prepare('DELETE FROM onboarding_drafts WHERE account_id=?').bind(identity.id),
  ]);
  return {data:response,replayed:false};
 }catch(error){
  const replay=await readStoredOperation(db,identity.id,operationKey,operation);
  if(replay)return {data:replay,replayed:true};
  const current=await db.prepare('SELECT setup_status FROM training_profiles WHERE id=? AND owner_id=?').bind(profileId,identity.id).first<{setup_status:string}>();
  if(current?.setup_status==='ready')return {data:response,replayed:true};
  throw error;
 }
}

export async function listHousehold(db:D1Database,identity:AdultIdentity){
 const rows=await db.prepare("SELECT p.id,p.nickname,p.age_band,p.catches,p.experience,p.equipment_json,p.available_spaces_json,p.planned_days_json,p.mission_minutes,p.setup_status,CASE WHEN c.profile_id=p.id THEN 1 ELSE 0 END AS active FROM guardian_player g JOIN training_profiles p ON p.id=g.profile_id LEFT JOIN active_player_context c ON c.account_id=g.account_id AND c.profile_id=p.id WHERE g.account_id=? AND g.status='active' ORDER BY p.created_at").bind(identity.id).all<HouseholdRow>();
 return {profiles:rows.results.map(row=>({id:row.id,nickname:row.nickname,ageBand:row.age_band,catches:row.catches,experience:row.experience,equipment:parseArray(row.equipment_json),spaces:parseArray(row.available_spaces_json),plannedDays:parseArray(row.planned_days_json),missionMinutes:row.mission_minutes,setupStatus:row.setup_status,active:Boolean(row.active)}))};
}

async function relationshipStatus(db:D1Database,identity:AdultIdentity,profileId:string){
 const relationship=await db.prepare('SELECT status FROM guardian_player WHERE account_id=? AND profile_id=?').bind(identity.id,profileId).first<{status:string}>();
 if(!relationship)throw canonicalError('FORBIDDEN','That goalie is not available to this account.',403);
 if(relationship.status!=='active')throw canonicalError('RELATIONSHIP_REVOKED','Ask the parent account to restore access.',403);
}

async function playerRow(db:D1Database,profileId:string){
 const row=await db.prepare('SELECT id,nickname,age_band,catches,experience,equipment_json,available_spaces_json,planned_days_json,mission_minutes,setup_status,state,revision FROM training_profiles WHERE id=?').bind(profileId).first<PlayerRow>();
 if(!row)throw canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',409);
 return row;
}

function project(row:PlayerRow){
 if(row.setup_status!=='ready')throw canonicalError('SETUP_REVIEW_REQUIRED','A parent must review this goalie setup before handoff.',409);
 return buildPlayerProjection({id:row.id,nickname:row.nickname,ageBand:row.age_band,catches:row.catches,experience:row.experience,equipment:parseArray(row.equipment_json),spaces:parseArray(row.available_spaces_json),plannedDays:parseArray(row.planned_days_json),missionMinutes:row.mission_minutes,setupStatus:row.setup_status,revision:row.revision},JSON.parse(row.state));
}

export async function setActivePlayer(db:D1Database,identity:AdultIdentity,profileId:string,operationKey:string){
 if(!profileId)throw canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',409);
 await relationshipStatus(db,identity,profileId);
 const operation=`set-player-context:${profileId}`;
 const stored=await readStoredOperation(db,identity.id,operationKey,operation);
 if(stored)return {data:stored,replayed:true};
 const data=project(await playerRow(db,profileId));
 const now=new Date().toISOString();
 try{
  await db.batch([
   db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET profile_id=excluded.profile_id,updated_at=excluded.updated_at').bind(identity.id,profileId,now),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity.id,profileId,'ACTIVE_PLAYER_CHANGED','{}',now),
   storeOperationStatement(db,identity.id,operationKey,operation,data,now),
  ]);
  return {data,replayed:false};
 }catch(error){
  const replay=await readStoredOperation(db,identity.id,operationKey,operation);
  if(replay)return {data:replay,replayed:true};
  throw error;
 }
}

export async function getActivePlayer(db:D1Database,identity:AdultIdentity){
 const context=await db.prepare('SELECT profile_id FROM active_player_context WHERE account_id=?').bind(identity.id).first<{profile_id:string}>();
 if(!context)throw canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',409);
 await relationshipStatus(db,identity,context.profile_id);
 return project(await playerRow(db,context.profile_id));
}

export async function confirmTrainingSpace(db:D1Database,identity:AdultIdentity,raw:unknown,operationKey:string){
 if(!raw||typeof raw!=='object')throw canonicalError('INVALID_SETUP','Confirm the available training space.',400);
 const input=raw as Record<string,unknown>;const profileId=typeof input.profileId==='string'?input.profileId:'';const revision=input.revision;
 if(!profileId||!Number.isInteger(revision)||!Array.isArray(input.spaces)||input.spaces.length!==1||input.spaces[0]!=='small-indoor')throw canonicalError('INVALID_SETUP','Confirm the clear indoor training area.',400);
 const owned=await db.prepare('SELECT revision FROM training_profiles WHERE id=? AND owner_id=?').bind(profileId,identity.id).first<{revision:number}>();if(!owned)throw canonicalError('FORBIDDEN','That goalie is not available to this parent account.',403);
 const operation=`confirm-training-space:${profileId}:${revision}:small-indoor`;const stored=await readStoredOperation(db,identity.id,operationKey,operation);if(stored)return {data:stored,replayed:true};
 const now=new Date().toISOString();const data={profileId,spaces:['small-indoor'],revision:(revision as number)+1};
 try{
  const results=await db.batch([
   db.prepare('UPDATE training_profiles SET available_spaces_json=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?').bind('["small-indoor"]',now,profileId,identity.id,revision),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM training_profiles WHERE id=? AND owner_id=? AND revision=?)').bind(crypto.randomUUID(),identity.id,profileId,'TRAINING_SPACE_CONFIRMED','{"spaces":["small-indoor"]}',now,profileId,identity.id,(revision as number)+1),
   db.prepare('INSERT INTO idempotency_records(account_id,operation_key,operation,response_json,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM training_profiles WHERE id=? AND owner_id=? AND revision=?)').bind(identity.id,operationKey,operation,JSON.stringify(data),now,profileId,identity.id,(revision as number)+1),
  ]);
  if(!results[0].meta.changes)throw canonicalError('STALE_REVISION','Profile settings changed. Reload before confirming the space.',409);
  return {data,replayed:false};
 }catch(error){const replay=await readStoredOperation(db,identity.id,operationKey,operation);if(replay)return {data:replay,replayed:true};throw error;}
}
