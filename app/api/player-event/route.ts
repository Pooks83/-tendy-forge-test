import {requireAdultIdentity} from '@/lib/account-identity';
import {getActivePlayer} from '@/lib/household-store';
import {canonicalError} from '@/lib/identity-contract.mjs';
import {validateOperationKey} from '@/lib/idempotency-store';
import {recordPlayerProductEvent} from '@/lib/product-event-store';
import {buildSession} from '@/lib/training.mjs';
import {trainingDb} from '@/lib/training-store';

export const dynamic='force-dynamic';
const EVENTS=new Set(['today_viewed','mission_started']);
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure=(error:unknown)=>{
 if(error&&typeof error==='object'&&'code' in error&&'status' in error){const value=error as {code:string;message:string;status:number};return reply({error:{code:value.code,message:value.message}},value.status);}
 console.error('Player event request failed',error instanceof Error?error.message:'error');
 return reply({error:{code:'INTERNAL_RETRYABLE',message:'Your next step was not confirmed. Try again.'}},503);
};

export async function POST(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('INVALID_ACTION','Try that action again.',415);
  const operationKey=validateOperationKey(request.headers.get('idempotency-key'));
  const text=await request.text();
  if(text.length>200)throw canonicalError('INVALID_ACTION','Try that action again.',413);
  let input:unknown;
  try{input=JSON.parse(text);}catch{throw canonicalError('INVALID_ACTION','Try that action again.',400);}
  const eventName=input&&typeof input==='object'&&'eventName' in input&&typeof input.eventName==='string'?input.eventName:'';
  if(!EVENTS.has(eventName))throw canonicalError('INVALID_ACTION','That player event is not available.',400);
  const db=trainingDb();
  const player=await getActivePlayer(db,identity) as unknown as {profile:{id:string};training:{pathId:string;week:number;day:number;cycle?:number}};
  const missionId=buildSession(player.training.pathId,player.training.week,player.training.day,player.training.cycle||0).id;
  const preference=await db.prepare('SELECT analytics_allowed FROM privacy_preferences WHERE profile_id=?').bind(player.profile.id).first<{analytics_allowed:number}>();
  const result=await recordPlayerProductEvent(db,identity,player.profile.id,eventName,missionId,preference?.analytics_allowed===1,operationKey);
  return reply(result.data,result.replayed?200:201);
 }catch(error){return failure(error);}
}
