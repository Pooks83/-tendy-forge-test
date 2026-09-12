import {isPublishedActivity,validateActivityVersion} from './training-content.mjs';
import {evaluateActivity} from './activity-eligibility.mjs';

type ContentRow={payload_json:string};
type RetirementRow={family_id:string;retirement_reason:string|null};
type EligibilityContext={ageBand:string;level:number;equipment:string[];spaces:string[];physicalRestrictions:string[];safetyStopped:boolean;workload:{status:string;maxActivityMinutes:number};objective:null;requiredInputs:string[]};

export async function loadPublishedCatalog(db:D1Database){
 const rows=await db.prepare("SELECT payload_json FROM activity_versions WHERE content_status='PUBLISHED' AND retired_at IS NULL ORDER BY activity_id,version").all<ContentRow>();
 return rows.results.flatMap(row=>{try{const value=JSON.parse(row.payload_json);validateActivityVersion(value);return isPublishedActivity(value)?[value]:[];}catch{return [];}});
}

export async function resolveSafetyRetirement(db:D1Database,references:Array<{activityKey:string;activityId:string;version:number}>,context:EligibilityContext){
 for(const reference of references){
  const retired=await db.prepare("SELECT family_id,retirement_reason FROM activity_versions WHERE activity_id=? AND version=? AND retired_at IS NOT NULL AND retirement_reason LIKE 'SAFETY:%'").bind(reference.activityId,reference.version).first<RetirementRow>();
  if(!retired)continue;
  const replacements=await db.prepare("SELECT payload_json FROM activity_versions WHERE family_id=? AND content_status='PUBLISHED' AND retired_at IS NULL AND NOT(activity_id=? AND version=?) ORDER BY version DESC,activity_id LIMIT 1").bind(retired.family_id,reference.activityId,reference.version).all<ContentRow>();
  const replacement=replacements.results.flatMap(row=>{try{const value=JSON.parse(row.payload_json);validateActivityVersion(value);const evaluation=evaluateActivity(value,context);return isPublishedActivity(value)&&evaluation.eligible?[{activity:value,evaluation}]:[];}catch{return [];}})[0]||null;
  return {reference,replacement,hold:{code:'CONTENT_RETIRED_SAFETY',message:'This activity was withdrawn for safety. Stop and ask an adult to review the replacement.',nextAction:replacement?'review-replacement':'adult-content-review',activityKey:reference.activityKey,replacement:replacement?{activityId:replacement.activity.activityId,version:replacement.activity.version,name:replacement.activity.name}:null}};
 }
 return null;
}

export async function findSafetyRetirement(db:D1Database,references:Array<{activityKey:string;activityId:string;version:number}>,context:EligibilityContext){
 return (await resolveSafetyRetirement(db,references,context))?.hold||null;
}
