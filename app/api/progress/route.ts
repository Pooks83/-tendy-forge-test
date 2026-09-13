import {requireAdultIdentity} from '@/lib/account-identity';
import {getProgressProjection} from '@/lib/progression-store';
import {trainingDb} from '@/lib/training-store';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
 try{return reply(await getProgressProjection(trainingDb(),await requireAdultIdentity()));}
 catch(error){
  if(error&&typeof error==='object'&&'code' in error&&'status' in error){const value=error as {code:string;message:string;status:number};return reply({error:{code:value.code,message:value.message}},value.status);}
  console.error('Progress request failed',error instanceof Error?error.message:'error');
  return reply({error:{code:'INTERNAL_RETRYABLE',message:'Your progress could not be loaded. Try again.'}},503);
 }
}
