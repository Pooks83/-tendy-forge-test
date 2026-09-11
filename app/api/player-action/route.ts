import {requireAdultIdentity} from '@/lib/account-identity';
import {getActivePlayer} from '@/lib/household-store';
import {buildPlayerProjection,canonicalError} from '@/lib/identity-contract.mjs';
import {readStoredOperation,storeOperationStatement,validateOperationKey} from '@/lib/idempotency-store';
import {applyAction} from '@/lib/training-actions.mjs';
import {normalizeTrainingState} from '@/lib/training.mjs';
import {trainingDb} from '@/lib/training-store';

export const dynamic='force-dynamic';
type Row={id:string;nickname:string;age_band:string;catches:string;experience:string;equipment_json:string;planned_days_json:string;mission_minutes:number;setup_status:string;state:string;revision:number};
const ALLOWED_ACTIONS=new Set(['stop','set','pause-rest','resume-rest','answer','finish','next']);
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure=(error:unknown)=>{
 if(error&&typeof error==='object'&&'code' in error&&'status' in error){const value=error as {code:string;message:string;status:number};return reply({error:{code:value.code,message:value.message}},value.status);}
 if(error instanceof Error&&/Invalid|Complete|Finish|paused|rest|order|answer|Unknown/i.test(error.message))return reply({error:{code:'INVALID_ACTION',message:error.message}},400);
 console.error('Player action failed',error instanceof Error?error.message:'error');
 return reply({error:{code:'INTERNAL_RETRYABLE',message:'Your progress was not confirmed. Try again.'}},503);
};
const parseArray=(value:string)=>{try{return JSON.parse(value||'[]');}catch{return [];}};

export async function POST(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('INVALID_ACTION','Try that action again.',415);
  const operationKey=validateOperationKey(request.headers.get('idempotency-key'));
  const text=await request.text();
  if(text.length>3000)throw canonicalError('INVALID_ACTION','Try that action again.',413);
  let input:unknown;
  try{input=JSON.parse(text);}catch{throw canonicalError('INVALID_ACTION','Try that action again.',400);}
  if(!input||typeof input!=='object'||'profileId' in input||!('revision' in input)||!Number.isInteger(input.revision)||!('action' in input)||!input.action||typeof input.action!=='object'||!('type' in input.action)||typeof input.action.type!=='string'||!ALLOWED_ACTIONS.has(input.action.type))throw canonicalError('INVALID_ACTION','That player action is not available.',400);
  const db=trainingDb();
  const current=await getActivePlayer(db,identity) as unknown as {profile:{id:string}};
  const profileId=current.profile.id;
  const operation=`player-action:${profileId}`;
  const stored=await readStoredOperation(db,identity.id,operationKey,operation);
  if(stored)return reply(stored);
  const row=await db.prepare('SELECT id,nickname,age_band,catches,experience,equipment_json,planned_days_json,mission_minutes,setup_status,state,revision FROM training_profiles WHERE id=?').bind(profileId).first<Row>();
  if(!row)throw canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',409);
  const state=applyAction(normalizeTrainingState(JSON.parse(row.state)),input.action,{role:'owner',id:identity.id});
  const result=await db.prepare('UPDATE training_profiles SET state=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(state),new Date().toISOString(),profileId,input.revision).run();
  if(!result.meta.changes)throw canonicalError('STALE_REVISION','Progress changed on another device. Reload before continuing.',409);
  const projection=buildPlayerProjection({id:row.id,nickname:row.nickname,ageBand:row.age_band,catches:row.catches,experience:row.experience,equipment:parseArray(row.equipment_json),plannedDays:parseArray(row.planned_days_json),missionMinutes:row.mission_minutes,setupStatus:row.setup_status,revision:row.revision+1},state);
  const now=new Date().toISOString();
  await db.batch([
   db.prepare('INSERT INTO audit_events(id,actor_account_id,profile_id,event_type,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity.id,profileId,'PLAYER_TRAINING_ACTION',JSON.stringify({actionType:input.action.type}),now),
   storeOperationStatement(db,identity.id,operationKey,operation,projection,now),
  ]);
  return reply(projection);
 }catch(error){return failure(error);}
}
