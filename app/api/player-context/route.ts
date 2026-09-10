import {requireAdultIdentity} from '@/lib/account-identity';
import {canonicalError} from '@/lib/identity-contract.mjs';
import {setActivePlayer} from '@/lib/household-store';
import {validateOperationKey} from '@/lib/idempotency-store';
import {trainingDb} from '@/lib/training-store';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure=(error:unknown)=>{
 if(error&&typeof error==='object'&&'code' in error&&'status' in error){const value=error as {code:string;message:string;status:number};return reply({error:{code:value.code,message:value.message}},value.status);}
 console.error('Player context request failed',error instanceof Error?error.message:'error');
 return reply({error:{code:'INTERNAL_RETRYABLE',message:'Your goalie was not changed. Try again.'}},503);
};

export async function POST(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',400);
  const operationKey=validateOperationKey(request.headers.get('idempotency-key'));
  const text=await request.text();
  if(text.length>1000)throw canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',400);
  let input:unknown;
  try{input=JSON.parse(text);}catch{throw canonicalError('PLAYER_CONTEXT_REQUIRED','Choose your goalie again.',400);}
  const profileId=input&&typeof input==='object'&&'profileId' in input&&typeof input.profileId==='string'?input.profileId:'';
  const result=await setActivePlayer(trainingDb(),identity,profileId,operationKey);
  return reply(result.data);
 }catch(error){return failure(error);}
}
