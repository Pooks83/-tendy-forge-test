import {headers} from 'next/headers';
import {canonicalError} from './identity-contract.mjs';

export type AdultIdentity={id:string;email:string};

export async function getAdultIdentity():Promise<AdultIdentity|null>{
 const requestHeaders=await headers();
 const id=requestHeaders.get('oai-authenticated-user-id')?.trim();
 const email=requestHeaders.get('oai-authenticated-user-email')?.trim().toLowerCase();
 return id&&email?{id,email}:null;
}

export async function requireAdultIdentity():Promise<AdultIdentity>{
 const identity=await getAdultIdentity();
 if(!identity)throw canonicalError('UNAUTHENTICATED','Sign in again to continue.',401);
 return identity;
}
