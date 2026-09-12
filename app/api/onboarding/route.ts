import {requireAdultIdentity} from '@/lib/account-identity';
import {canonicalError} from '@/lib/identity-contract.mjs';
import {confirmTrainingSpace,createGoalieSetup,listHousehold,reconcileLegacySetup} from '@/lib/household-store';
import {validateOperationKey} from '@/lib/idempotency-store';
import {trainingDb} from '@/lib/training-store';

export const dynamic='force-dynamic';

const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const errorReply=(error:unknown)=>{
 const known=error&&typeof error==='object'&&'code' in error&&'status' in error;
 if(known){const value=error as {code:string;message:string;status:number};return reply({error:{code:value.code,message:value.message}},value.status);}
 console.error('Onboarding request failed',error instanceof Error?error.message:'error');
 return reply({error:{code:'INTERNAL_RETRYABLE',message:'Your setup was not changed. Try again.'}},503);
};

export async function GET(){
 try{return reply(await listHousehold(trainingDb(),await requireAdultIdentity()));}catch(error){return errorReply(error);}
}

export async function POST(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('INVALID_SETUP','Check the setup and try again.',415);
  const operationKey=validateOperationKey(request.headers.get('idempotency-key'));
  const text=await request.text();
  if(text.length>12000)throw canonicalError('INVALID_SETUP','The setup is too large. Check it and try again.',413);
  let input:unknown;
  try{input=JSON.parse(text);}catch{throw canonicalError('INVALID_SETUP','Check the setup and try again.',400);}
  const result=await createGoalieSetup(trainingDb(),identity,input,operationKey);
  return reply(result.data,result.replayed?200:201);
 }catch(error){return errorReply(error);}
}

export async function PATCH(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('INVALID_SETUP','Check the setup and try again.',415);
  const operationKey=validateOperationKey(request.headers.get('idempotency-key'));
  const text=await request.text();
  if(text.length>12000)throw canonicalError('INVALID_SETUP','The setup is too large. Check it and try again.',413);
  let input:unknown;
  try{input=JSON.parse(text);}catch{throw canonicalError('INVALID_SETUP','Check the setup and try again.',400);}
  const profileId=input&&typeof input==='object'&&'profileId' in input&&typeof input.profileId==='string'?input.profileId:'';
  const result=await reconcileLegacySetup(trainingDb(),identity,profileId,input,operationKey);
  return reply(result.data,result.replayed?200:201);
 }catch(error){return errorReply(error);}
}

export async function PUT(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('INVALID_SETUP','Confirm the available training space.',415);
  const operationKey=validateOperationKey(request.headers.get('idempotency-key'));const text=await request.text();if(text.length>1000)throw canonicalError('INVALID_SETUP','Confirm the available training space.',413);
  let input:unknown;try{input=JSON.parse(text);}catch{throw canonicalError('INVALID_SETUP','Confirm the available training space.',400);}
  const result=await confirmTrainingSpace(trainingDb(),identity,input,operationKey);return reply(result.data,result.replayed?200:201);
 }catch(error){return errorReply(error);}
}
