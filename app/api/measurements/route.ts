import {requireAdultIdentity} from '@/lib/account-identity';
import {canonicalError} from '@/lib/identity-contract.mjs';
import {validateOperationKey} from '@/lib/idempotency-store';
import {getMeasurements,recordMeasurement} from '@/lib/measurement-store';
import {trainingDb} from '@/lib/training-store';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure=(error:unknown)=>{if(error&&typeof error==='object'&&'code' in error&&'status' in error){const v=error as {code:string;message:string;status:number};return reply({error:{code:v.code,message:v.message}},v.status);}return reply({error:{code:'INTERNAL_RETRYABLE',message:'Your measurement was not changed. Try again.'}},503);};
export async function GET(){try{return reply(await getMeasurements(trainingDb(),await requireAdultIdentity()));}catch(error){return failure(error);}}
export async function POST(request:Request){try{const identity=await requireAdultIdentity();if(request.headers.get('origin')!==new URL(request.url).origin)throw canonicalError('FORBIDDEN','Return to Tendie Forge and try again.',403);if(!request.headers.get('content-type')?.includes('application/json'))throw canonicalError('MEASUREMENT_INVALID','Check the result and try again.',415);const key=validateOperationKey(request.headers.get('idempotency-key'));const input=await request.json() as {protocolId:string;kind:string;value:number};const result=await recordMeasurement(trainingDb(),identity,input,key);return reply({measurement:result.measurement,comparison:result.comparison},result.replayed?200:201);}catch(error){return failure(error);}}
