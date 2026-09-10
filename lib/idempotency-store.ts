import {canonicalError} from './identity-contract.mjs';

type StoredOperation={operation:string;response_json:string};

export function validateOperationKey(value:string|null):string{
 if(!value||value.length<8||value.length>128||!/^[A-Za-z0-9._:-]+$/.test(value))throw canonicalError('INVALID_SETUP','Try the setup again.',400);
 return value;
}

export async function readStoredOperation(db:D1Database,accountId:string,key:string,operation:string){
 const row=await db.prepare('SELECT operation,response_json FROM idempotency_records WHERE account_id=? AND operation_key=?').bind(accountId,key).first<StoredOperation>();
 if(!row)return null;
 if(row.operation!==operation)throw canonicalError('DUPLICATE_REQUEST','That request was already used. Try again.',409);
 return JSON.parse(row.response_json);
}

export function storeOperationStatement(db:D1Database,accountId:string,key:string,operation:string,response:unknown,createdAt:string){
 return db.prepare('INSERT INTO idempotency_records(account_id,operation_key,operation,response_json,created_at) VALUES(?,?,?,?,?)').bind(accountId,key,operation,JSON.stringify(response),createdAt);
}
