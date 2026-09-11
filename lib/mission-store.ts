import type {AdultIdentity} from './account-identity';
import {getActivePlayer} from './household-store';
import {canonicalError} from './identity-contract.mjs';
import {readStoredOperation,storeOperationStatement} from './idempotency-store';
import {productEventStatement} from './product-event-store';
import {buildSession} from './training.mjs';

type PlayerProjection={profile:{id:string};training:{pathId:string;week:number;day:number;cycle?:number;safetyStopped?:boolean}};
type MissionRow={id:string;mission_key:string;status:string;started_at:string;completed_at:string|null};
const project=(row:MissionRow)=>({id:row.id,missionId:row.mission_key,status:row.status,startedAt:row.started_at,...(row.completed_at?{completedAt:row.completed_at}:{})});

async function current(db:D1Database,identity:AdultIdentity){
 const player=await getActivePlayer(db,identity) as unknown as PlayerProjection;
 const missionId=buildSession(player.training.pathId,player.training.week,player.training.day,player.training.cycle||0).id;
 return {player,profileId:player.profile.id,missionId};
}

export async function getCurrentMission(db:D1Database,identity:AdultIdentity){
 const {profileId,missionId}=await current(db,identity);
 const row=await db.prepare('SELECT id,mission_key,status,started_at,completed_at FROM mission_instances WHERE profile_id=? AND mission_key=?').bind(profileId,missionId).first<MissionRow>();
 return row?project(row):{missionId,status:'not-started'};
}

export async function startCurrentMission(db:D1Database,identity:AdultIdentity,operationKey:string,now=new Date()){
 const {player,profileId,missionId}=await current(db,identity);
 if(player.training.safetyStopped)throw canonicalError('SAFETY_STOPPED','Training is paused. Ask a parent or guardian to check in before continuing.',409);
 const challenge=await db.prepare('SELECT status FROM first_challenge_results WHERE profile_id=?').bind(profileId).first<{status:string}>();
 if(challenge?.status!=='completed')throw canonicalError('INVALID_STATE_TRANSITION','Finish the 60-second first challenge before starting this mission.',409);
 const operation=`mission-start:${profileId}:${missionId}`;
 const stored=await readStoredOperation(db,identity.id,operationKey,operation);
 if(stored)return {data:stored,replayed:true};
 const existing=await db.prepare('SELECT id,mission_key,status,started_at,completed_at FROM mission_instances WHERE profile_id=? AND mission_key=?').bind(profileId,missionId).first<MissionRow>();
 if(existing)return {data:project(existing),replayed:true};
 const timestamp=now.toISOString();
 const id=crypto.randomUUID();
 const data={id,missionId,status:'in-progress',startedAt:timestamp};
 const preference=await db.prepare('SELECT analytics_allowed FROM privacy_preferences WHERE profile_id=?').bind(profileId).first<{analytics_allowed:number}>();
 try{
  await db.batch([
   db.prepare('INSERT INTO mission_instances(id,profile_id,mission_key,status,started_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,profileId,missionId,'in-progress',timestamp,timestamp),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity.id,profileId,'MISSION_STARTED',JSON.stringify({missionId}),timestamp),
   ...(preference?.analytics_allowed===1?[productEventStatement(db,{eventName:'mission_started',logicalKey:`mission_started:${profileId}:${missionId}`,accountContextId:identity.id,profileContextId:profileId,metadata:{missionId}},timestamp)]:[]),
   storeOperationStatement(db,identity.id,operationKey,operation,data,timestamp),
  ]);
  return {data,replayed:false};
 }catch(error){
  const replay=await readStoredOperation(db,identity.id,operationKey,operation);
  if(replay)return {data:replay,replayed:true};
  const created=await db.prepare('SELECT id,mission_key,status,started_at,completed_at FROM mission_instances WHERE profile_id=? AND mission_key=?').bind(profileId,missionId).first<MissionRow>();
  if(created)return {data:project(created),replayed:true};
  throw error;
 }
}
