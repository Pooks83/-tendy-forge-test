import type {AdultIdentity} from './account-identity';
import {canonicalError,CONSENT_VERSION,POLICY_VERSION} from './identity-contract.mjs';

const STEPS=new Set(['create-goalie','gear','training-plan']);
const AGE_BANDS=new Set(['','Under 10','10–12','13–15','16 or older']);
const CATCHES=new Set(['left','right']);
const EXPERIENCE=new Set(['new','developing','experienced']);
const EQUIPMENT=new Set(['tennis-ball','reaction-ball','wall-space','resistance-band','cones']);
const SPACES=new Set(['small-indoor']);
const WEEKDAYS=new Set(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']);
const MISSION_MINUTES=new Set([15,25,35]);

type DraftRow={step:string;draft_json:string;operation_key:string;consent_version:string;policy_version:string};

function invalid():never{throw canonicalError('INVALID_SETUP','Check the setup and try again.',400);}
function normalizedArray(value:unknown,allowed:Set<string>,max:number){
 if(!Array.isArray(value)||value.length>max||value.some(item=>typeof item!=='string'||!allowed.has(item))||new Set(value).size!==value.length)invalid();
 return [...value] as string[];
}

export function normalizeOnboardingDraft(raw:unknown,operationKey:string){
 if(!raw||typeof raw!=='object')invalid();
 const input=raw as Record<string,unknown>;
 if(input.consentAccepted!==true||input.consentVersion!==CONSENT_VERSION||input.policyVersion!==POLICY_VERSION)throw canonicalError('CONSENT_REQUIRED','A parent or guardian must approve the required permission first.',403);
 if(typeof input.step!=='string'||!STEPS.has(input.step)||input.operationKey!==operationKey)invalid();
 if(!input.data||typeof input.data!=='object')invalid();
 const source=input.data as Record<string,unknown>;
 const nickname=typeof source.nickname==='string'?source.nickname.trim():'';
 if(nickname.length>24||typeof source.ageBand!=='string'||!AGE_BANDS.has(source.ageBand)||typeof source.catches!=='string'||!CATCHES.has(source.catches)||typeof source.experience!=='string'||!EXPERIENCE.has(source.experience)||typeof source.missionMinutes!=='number'||!MISSION_MINUTES.has(source.missionMinutes))invalid();
 if(input.step!=='create-goalie'&&(!nickname||source.ageBand===''))invalid();
 return {
  step:input.step,
  operationKey,
  consentAccepted:true,
  consentVersion:CONSENT_VERSION,
  policyVersion:POLICY_VERSION,
  data:{
   nickname,
   ageBand:source.ageBand,
   catches:source.catches,
   experience:source.experience,
   equipment:normalizedArray(source.equipment,EQUIPMENT,EQUIPMENT.size),
   spaces:normalizedArray(source.spaces??[],SPACES,SPACES.size),
   plannedDays:normalizedArray(source.plannedDays,WEEKDAYS,5),
   missionMinutes:source.missionMinutes,
   analyticsAllowed:source.analyticsAllowed===true,
  },
 };
}

export async function readOnboardingDraft(db:D1Database,identity:AdultIdentity){
 const row=await db.prepare('SELECT step,draft_json,operation_key,consent_version,policy_version FROM onboarding_drafts WHERE account_id=?').bind(identity.id).first<DraftRow>();
 if(!row||row.consent_version!==CONSENT_VERSION||row.policy_version!==POLICY_VERSION)return {draft:null};
 return {draft:{step:row.step,operationKey:row.operation_key,consentAccepted:true,consentVersion:row.consent_version,policyVersion:row.policy_version,data:JSON.parse(row.draft_json)}};
}

export async function saveOnboardingDraft(db:D1Database,identity:AdultIdentity,raw:unknown,operationKey:string){
 const draft=normalizeOnboardingDraft(raw,operationKey);
 const now=new Date().toISOString();
 const result=await db.prepare(`INSERT INTO onboarding_drafts(account_id,step,draft_json,operation_key,consent_version,policy_version,permission_accepted_at,updated_at)
SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM idempotency_records WHERE account_id=? AND operation_key=? AND operation='create-goalie')
ON CONFLICT(account_id) DO UPDATE SET step=excluded.step,draft_json=excluded.draft_json,operation_key=excluded.operation_key,consent_version=excluded.consent_version,policy_version=excluded.policy_version,updated_at=excluded.updated_at`).bind(identity.id,draft.step,JSON.stringify(draft.data),operationKey,draft.consentVersion,draft.policyVersion,now,now,identity.id,operationKey).run();
 return {draft:result.meta.changes?draft:null};
}

export async function clearOnboardingDraft(db:D1Database,identity:AdultIdentity){
 await db.prepare('DELETE FROM onboarding_drafts WHERE account_id=?').bind(identity.id).run();
 return {draft:null};
}
