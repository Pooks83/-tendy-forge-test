import type {AdultIdentity} from './account-identity';
import {readStoredOperation,storeOperationStatement} from './idempotency-store';

export const PRODUCT_EVENT_APP_VERSION='0.1.0';
export const PRODUCT_EVENT_CONFIG_VERSION='tf-v1.4';
const buildVersion=()=>process.env.SITES_BUILD_ID||process.env.GIT_COMMIT_SHA||'local-unpublished';

type EventInput={eventName:string;logicalKey:string;accountContextId?:string|null;profileContextId?:string|null;metadata?:Record<string,string|number|boolean|null>};

export function productEventStatement(db:D1Database,input:EventInput,now:string,id=crypto.randomUUID()){
 return db.prepare('INSERT OR IGNORE INTO product_events(id,logical_key,event_name,account_context_id,profile_context_id,app_version,build_version,config_version,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,input.logicalKey,input.eventName,input.accountContextId??null,input.profileContextId??null,PRODUCT_EVENT_APP_VERSION,buildVersion(),PRODUCT_EVENT_CONFIG_VERSION,JSON.stringify(input.metadata??{}),now);
}

export async function recordPlayerProductEvent(db:D1Database,identity:AdultIdentity,profileId:string,eventName:string,missionId:string,analyticsAllowed:boolean,operationKey:string){
 const operation=`player-event:${profileId}:${eventName}:${missionId}`;
 const stored=await readStoredOperation(db,identity.id,operationKey,operation);
 if(stored)return {data:stored,replayed:true};
 const data={recorded:analyticsAllowed,eventName};
 const now=new Date().toISOString();
 if(!analyticsAllowed){
  await storeOperationStatement(db,identity.id,operationKey,operation,data,now).run();
  return {data,replayed:true};
 }
 const logicalKey=`${eventName}:${profileId}:${missionId}`;
 const existing=await db.prepare('SELECT id FROM product_events WHERE logical_key=?').bind(logicalKey).first<{id:string}>();
 await db.batch([
  productEventStatement(db,{eventName,logicalKey,accountContextId:identity.id,profileContextId:profileId,metadata:{missionId}},now),
  storeOperationStatement(db,identity.id,operationKey,operation,data,now),
 ]);
 return {data,replayed:Boolean(existing)};
}
