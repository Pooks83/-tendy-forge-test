import type {AdultIdentity} from './account-identity';
import {canonicalError} from './identity-contract.mjs';
import {FIRST_CHALLENGE_PROTOCOL,resolveFirstValueStatus} from './first-challenge-state.mjs';
import {getActivePlayer} from './household-store';
import {readStoredOperation,storeOperationStatement} from './idempotency-store';
import {buildSession} from './training.mjs';

type ChallengeRow={protocol_version:string;status:string;started_at:string;completed_at:string|null;result_json:string};

async function context(db:D1Database,identity:AdultIdentity){
 const player=await getActivePlayer(db,identity) as unknown as {profile:{id:string};training:{pathId:string;week:number;day:number;cycle?:number;safetyStopped?:boolean}};
 return {profileId:player.profile.id,safetyStopped:player.training.safetyStopped===true,missionId:buildSession(player.training.pathId,player.training.week,player.training.day,player.training.cycle||0).id};
}

async function rowFor(db:D1Database,profileId:string){
 return db.prepare('SELECT protocol_version,status,started_at,completed_at,result_json FROM first_challenge_results WHERE profile_id=?').bind(profileId).first<ChallengeRow>();
}

async function responseFor(db:D1Database,row:ChallengeRow|null,safetyStopped:boolean,profileId:string,missionId:string,now=new Date()){
 const response=resolveFirstValueStatus(row,safetyStopped,now);
 if(response.status!=='completed')return response;
 const mission=await db.prepare('SELECT status FROM mission_instances WHERE profile_id=? AND mission_key=?').bind(profileId,missionId).first<{status:string}>();
 return {...response,missionId,missionStatus:mission?.status||'not-started'};
}

export async function getFirstChallenge(db:D1Database,identity:AdultIdentity){
 const {profileId,safetyStopped,missionId}=await context(db,identity);
 const row=await rowFor(db,profileId);
 return responseFor(db,row,safetyStopped,profileId,missionId);
}

export async function startFirstChallenge(db:D1Database,identity:AdultIdentity,operationKey:string,now=new Date()){
 const {profileId,safetyStopped,missionId}=await context(db,identity);
 if(safetyStopped)throw canonicalError('SAFETY_STOPPED','Training is paused. Ask a parent or guardian to check in before continuing.',409);
 const operation=`first-challenge-start:${profileId}`;
 const stored=await readStoredOperation(db,identity.id,operationKey,operation);
 if(stored)return {data:stored,replayed:true};
 const existing=await rowFor(db,profileId);
 if(existing)return {data:await responseFor(db,existing,false,profileId,missionId,now),replayed:true};
 const timestamp=now.toISOString();
 const data={status:'active',protocolVersion:FIRST_CHALLENGE_PROTOCOL,remainingSeconds:60,canComplete:false};
 try{
  await db.batch([
   db.prepare('INSERT INTO first_challenge_results(profile_id,protocol_version,status,started_at,result_json,updated_at) VALUES(?,?,?,?,?,?)').bind(profileId,FIRST_CHALLENGE_PROTOCOL,'active',timestamp,'{}',timestamp),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(`first-challenge-start:${profileId}`,identity.id,profileId,'FIRST_CHALLENGE_STARTED',JSON.stringify({protocolVersion:FIRST_CHALLENGE_PROTOCOL}),timestamp),
   storeOperationStatement(db,identity.id,operationKey,operation,data,timestamp),
  ]);
  return {data,replayed:false};
 }catch(error){
  const current=await rowFor(db,profileId);
  if(current)return {data:await responseFor(db,current,false,profileId,missionId,now),replayed:true};
  throw error;
 }
}

export async function completeFirstChallenge(db:D1Database,identity:AdultIdentity,operationKey:string,now=new Date()){
 const {profileId,safetyStopped,missionId}=await context(db,identity);
 const operation=`first-challenge-complete:${profileId}`;
 const stored=await readStoredOperation(db,identity.id,operationKey,operation);
 if(stored)return {data:stored,replayed:true};
 const existing=await rowFor(db,profileId);
 if(!existing)throw canonicalError('CHALLENGE_NOT_STARTED','Start the challenge first.',409);
 if(existing.status==='completed')return {data:await responseFor(db,existing,false,profileId,missionId,now),replayed:true};
 if(safetyStopped)throw canonicalError('SAFETY_STOPPED','Training is paused. Ask a parent or guardian to check in before continuing.',409);
 if(now.getTime()-new Date(existing.started_at).getTime()<60_000)throw canonicalError('CHALLENGE_IN_PROGRESS','Keep going until the 60-second timer finishes.',409);
 const timestamp=now.toISOString();
 const result={completedSeconds:60,claim:'completed'};
 const data={status:'completed',protocolVersion:FIRST_CHALLENGE_PROTOCOL,result,missionId,missionStatus:'not-started'};
 try{
  await db.batch([
   db.prepare("UPDATE first_challenge_results SET status='completed',completed_at=?,result_json=?,updated_at=? WHERE profile_id=? AND status='active'").bind(timestamp,JSON.stringify(result),timestamp,profileId),
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(`first-challenge-complete:${profileId}`,identity.id,profileId,'FIRST_CHALLENGE_COMPLETED',JSON.stringify({protocolVersion:FIRST_CHALLENGE_PROTOCOL}),timestamp),
   storeOperationStatement(db,identity.id,operationKey,operation,data,timestamp),
  ]);
  return {data,replayed:false};
 }catch(error){
  const current=await rowFor(db,profileId);
  if(current?.status==='completed')return {data:await responseFor(db,current,false,profileId,missionId,now),replayed:true};
  throw error;
 }
}
