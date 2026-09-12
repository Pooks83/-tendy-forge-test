export const CONSENT_VERSION='tf-parent-consent-v1.4';
export const POLICY_VERSION='tf-privacy-v1.4';

const AGE_BANDS=new Set(['Under 10','10–12','13–15','16 or older']);
const CATCHES=new Set(['left','right']);
const EXPERIENCE=new Set(['new','developing','experienced']);
const EQUIPMENT=new Set(['tennis-ball','reaction-ball','wall-space','resistance-band','cones']);
const WEEKDAYS=new Set(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']);
const MISSION_MINUTES=new Set([15,25,35]);

export function canonicalError(code,message,status=400){
 const error=new Error(message);
 error.name='CanonicalError';
 error.code=code;
 error.status=status;
 return error;
}

function invalid(message){throw canonicalError('INVALID_SETUP',message,400);}

export function normalizeOnboardingInput(input){
 if(!input||typeof input!=='object')invalid('Check the setup and try again.');
 if(input.consentAccepted!==true||input.consentVersion!==CONSENT_VERSION){
  throw canonicalError('CONSENT_REQUIRED','A parent or guardian must approve the required permission first.',403);
 }
 if(input.policyVersion!==POLICY_VERSION)throw canonicalError('CONSENT_REQUIRED','Review the current privacy information before continuing.',403);
 const nickname=typeof input.nickname==='string'?input.nickname.trim():'';
 if(!nickname||nickname.length>24)invalid('Enter a nickname using 24 characters or fewer.');
 if(!AGE_BANDS.has(input.ageBand))invalid('Choose an age band.');
 if(!CATCHES.has(input.catches))invalid('Choose which hand catches.');
 if(!EXPERIENCE.has(input.experience))invalid('Choose a goalie experience level.');
 if(!Array.isArray(input.equipment)||input.equipment.some(item=>!EQUIPMENT.has(item))||new Set(input.equipment).size!==input.equipment.length)invalid('Check the available equipment.');
 if(!Array.isArray(input.plannedDays)||input.plannedDays.length<1||input.plannedDays.length>5||input.plannedDays.some(day=>!WEEKDAYS.has(day))||new Set(input.plannedDays).size!==input.plannedDays.length)invalid('Choose one to five different training days.');
 if(!MISSION_MINUTES.has(input.missionMinutes))invalid('Choose a 15, 25, or 35 minute mission.');
 const permissions=input.optionalPermissions&&typeof input.optionalPermissions==='object'?input.optionalPermissions:{};
 return {
  nickname,
  ageBand:input.ageBand,
  trainingEligible:input.ageBand!=='16 or older',
  catches:input.catches,
  experience:input.experience,
  equipment:[...input.equipment],
  plannedDays:[...input.plannedDays],
  missionMinutes:input.missionMinutes,
  consentVersion:CONSENT_VERSION,
  policyVersion:POLICY_VERSION,
  optionalPermissions:{analytics:permissions.analytics===true,notifications:permissions.notifications===true,clips:permissions.clips===true},
 };
}

const cleanRecord=(value,pick)=>Object.fromEntries(pick.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));

export function buildPlayerProjection(profile,state){
 const sessions=Array.isArray(state?.sessions)?state.sessions.map(item=>cleanRecord(item,['id','date','pathId','week','day'])):[];
 const rests=Object.fromEntries(Object.entries(state?.rests||{}).map(([key,value])=>[key,cleanRecord(value,['until','remaining','paused'])]));
 const answers=Object.fromEntries(Object.entries(state?.answers||{}).map(([key,value])=>[key,cleanRecord(value,['choice','correct'])]));
 return {
  profile:cleanRecord(profile,['id','nickname','ageBand','catches','experience','equipment','spaces','plannedDays','missionMinutes','setupStatus','revision']),
  training:{
   ...cleanRecord(state,['version','pathId','week','day','cycle']),
   sets:Object.fromEntries(Object.entries(state?.sets||{}).filter(([,value])=>typeof value==='boolean')),
   rests,
   sessions,
   answers,
   safetyStopped:state?.safetyStopped===true,
  },
 };
}
