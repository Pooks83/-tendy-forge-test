import {requireAdultIdentity} from '@/lib/account-identity';
import {canonicalError} from '@/lib/identity-contract.mjs';
import {validateOperationKey} from '@/lib/idempotency-store';
import {getCurrentMission,startCurrentMission} from '@/lib/mission-store';
import {trainingDb} from '@/lib/training-store';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure=(error:unknown)=>{
 if(error&&typeof error==='object'&&'code' in error&&'status' in error){const value=error as {code:string;message:string;status:number};return reply({error:{code:value.code,message:value.message}},value.status);}
 console.error('Mission request failed',error instanceof Error?error.message:'error');
 return reply({error:{code:'INTERNAL_RETRYABLE',message:'Your mission was not changed. Try again.'}},503);
};

export async function GET(){
 try{return reply(await getCurrentMission(trainingDb(),await requireAdultIdentity()));}catch(error){return failure(error);}
}

export async function POST(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('INVALID_ACTION','Try that action again.',415);
  const operationKey=validateOperationKey(request.headers.get('idempotency-key'));
  const text=await request.text();
  if(text.length>100)throw canonicalError('INVALID_ACTION','Try that action again.',413);
  let input:unknown;
  try{input=JSON.parse(text);}catch{throw canonicalError('INVALID_ACTION','Try that action again.',400);}
  if(!input||typeof input!=='object'||!('action' in input)||input.action!=='start')throw canonicalError('INVALID_ACTION','That mission action is not available.',400);
  const result=await startCurrentMission(trainingDb(),identity,operationKey);
  return reply(result.data,result.replayed?200:201);
 }catch(error){return failure(error);}
}
