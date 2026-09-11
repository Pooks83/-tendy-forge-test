import {requireAdultIdentity} from '@/lib/account-identity';
import {canonicalError} from '@/lib/identity-contract.mjs';
import {validateOperationKey} from '@/lib/idempotency-store';
import {clearOnboardingDraft,readOnboardingDraft,saveOnboardingDraft} from '@/lib/onboarding-draft-store';
import {trainingDb} from '@/lib/training-store';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure=(error:unknown)=>{
 if(error&&typeof error==='object'&&'code' in error&&'status' in error){const value=error as {code:string;message:string;status:number};return reply({error:{code:value.code,message:value.message}},value.status);}
 console.error('Onboarding draft request failed',error instanceof Error?error.message:'error');
 return reply({error:{code:'INTERNAL_RETRYABLE',message:'Your setup progress was not saved. Try again.'}},503);
};

export async function GET(){
 try{return reply(await readOnboardingDraft(trainingDb(),await requireAdultIdentity()));}catch(error){return failure(error);}
}

export async function PUT(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('INVALID_SETUP','Check the setup and try again.',415);
  const operationKey=validateOperationKey(request.headers.get('idempotency-key'));
  const text=await request.text();
  if(text.length>6000)throw canonicalError('INVALID_SETUP','The setup is too large. Check it and try again.',413);
  let input:unknown;
  try{input=JSON.parse(text);}catch{throw canonicalError('INVALID_SETUP','Check the setup and try again.',400);}
  return reply(await saveOnboardingDraft(trainingDb(),identity,input,operationKey));
 }catch(error){return failure(error);}
}

export async function DELETE(request:Request){
 try{
  const identity=await requireAdultIdentity();
  if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);
  validateOperationKey(request.headers.get('idempotency-key'));
  return reply(await clearOnboardingDraft(trainingDb(),identity));
 }catch(error){return failure(error);}
}
