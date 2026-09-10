import {newTrainingState} from './training.mjs';
import {canonicalError,normalizeOnboardingInput} from './identity-contract.mjs';
import {readStoredOperation,storeOperationStatement} from './idempotency-store';
import type {AdultIdentity} from './account-identity';

type HouseholdRow={id:string;nickname:string;age_band:string;catches:string|null;experience:string|null;equipment_json:string|null;planned_days_json:string|null;mission_minutes:number|null;setup_status:string;active:number};

const parseArray=(value:string|null)=>{try{return value?JSON.parse(value):[];}catch{return [];}};

export async function createGoalieSetup(db:D1Database,identity:AdultIdentity,rawInput:unknown,operationKey:string){
 const input=normalizeOnboardingInput(rawInput);
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
   db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,revision,created_at,catches,experience,equipment_json,planned_days_json,mission_minutes,setup_status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(profileId,identity.id,input.nickname,'',input.ageBand,JSON.stringify(newTrainingState()),0,now,input.catches,input.experience,JSON.stringify(input.equipment),JSON.stringify(input.plannedDays),input.missionMinutes,'ready',now),
   db.prepare('INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind(identity.id,profileId,'guardian','active',now),
   db.prepare('INSERT INTO consent_records(id,account_id,profile_id,consent_version,purposes_json,policy_version,accepted_at) VALUES(?,?,?,?,?,?,?)').bind(consentId,identity.id,profileId,input.consentVersion,purposes,input.policyVersion,now),
   db.prepare('INSERT INTO privacy_preferences(profile_id,analytics_allowed,notifications_allowed,clips_allowed,updated_at) VALUES(?,?,?,?,?)').bind(profileId,input.optionalPermissions.analytics?1:0,input.optionalPermissions.notifications?1:0,input.optionalPermissions.clips?1:0,now),
   db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET profile_id=excluded.profile_id,updated_at=excluded.updated_at').bind(identity.id,profileId,now),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(auditId,identity.id,profileId,'PLAYER_PROFILE_CREATED',JSON.stringify({consentVersion:input.consentVersion,policyVersion:input.policyVersion}),now),
   storeOperationStatement(db,identity.id,operationKey,'create-goalie',response,now),
  ]);
  return {data:response,replayed:false};
 }catch(error){
  const replay=await readStoredOperation(db,identity.id,operationKey,'create-goalie');
  if(replay)return {data:replay,replayed:true};
  throw error;
 }
}

export async function listHousehold(db:D1Database,identity:AdultIdentity){
 const rows=await db.prepare("SELECT p.id,p.nickname,p.age_band,p.catches,p.experience,p.equipment_json,p.planned_days_json,p.mission_minutes,p.setup_status,CASE WHEN c.profile_id=p.id THEN 1 ELSE 0 END AS active FROM guardian_player g JOIN training_profiles p ON p.id=g.profile_id LEFT JOIN active_player_context c ON c.account_id=g.account_id WHERE g.account_id=? AND g.status='active' ORDER BY p.created_at").bind(identity.id).all<HouseholdRow>();
 return {profiles:rows.results.map(row=>({id:row.id,nickname:row.nickname,ageBand:row.age_band,catches:row.catches,experience:row.experience,equipment:parseArray(row.equipment_json),plannedDays:parseArray(row.planned_days_json),missionMinutes:row.mission_minutes,setupStatus:row.setup_status,active:Boolean(row.active)}))};
}
