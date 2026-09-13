export const PROGRESSION_RULE_VERSION='tf-progression-v1';
export const CANONICAL_DEVELOPMENT_ATTRIBUTES=Object.freeze(['TRACKING','HANDS','BALANCE','EXPLOSIVENESS','STRENGTH','MOBILITY','CONDITIONING','MINDSET']);
const ATTRIBUTE_SET=new Set(CANONICAL_DEVELOPMENT_ATTRIBUTES);
const terminal=new Set(['COMPLETED','SKIPPED']);

const failure=(code,message)=>Object.assign(new Error(message),{code});

function normalizedStatus(value){return String(value||'').toUpperCase().replaceAll('-','_');}

function validateJourney(value){
 if(!value||typeof value.pathId!=='string'||!value.pathId||!Number.isInteger(value.week)||value.week<0||!Number.isInteger(value.day)||value.day<0||!Number.isInteger(value.cycle)||value.cycle<0||!Number.isInteger(value.daysPerWeek)||value.daysPerWeek<1||!Number.isInteger(value.weeksPerCycle)||value.weeksPerCycle<1||value.day>=value.daysPerWeek||value.week>=value.weeksPerCycle)throw failure('PROGRESSION_CONFIG_REQUIRED','The Journey configuration is incomplete. Ask an adult to review the training plan.');
}

function nextJourney(value){
 const before={pathId:value.pathId,week:value.week,day:value.day,cycle:value.cycle};
 if(value.day+1<value.daysPerWeek)return {...before,day:value.day+1};
 if(value.week+1<value.weeksPerCycle)return {...before,week:value.week+1,day:0};
 return {...before,week:0,day:0,cycle:value.cycle+1};
}

function attributeIds(block){
 const values=block?.developmentAttributeIds;
 if(!Array.isArray(values)||!values.length||values.some(value=>typeof value!=='string'||!ATTRIBUTE_SET.has(value))||new Set(values).size!==values.length)throw failure('PROGRESSION_CONFIG_REQUIRED','This mission is missing reviewed development attributes. Ask an adult to review the training plan.');
 return [...values].sort();
}

export function calculateCompletionPackage({missionInstanceId,profileId,snapshot,activities,journey}){
 if(typeof missionInstanceId!=='string'||!missionInstanceId||typeof profileId!=='string'||!profileId||!snapshot||!Array.isArray(snapshot.blocks)||!snapshot.blocks.length||!Array.isArray(activities)||activities.length!==snapshot.blocks.length)throw failure('PROGRESSION_CONFIG_REQUIRED','The mission progression configuration is incomplete. Ask an adult to review the training plan.');
 validateJourney(journey);
 const byKey=new Map(activities.map(activity=>[activity?.key,activity]));
 let completedPrescribedMinutes=0;let skippedPrescribedMinutes=0;const attributeUnits={};
 for(const block of snapshot.blocks){
  if(!block||typeof block.id!=='string'||!block.id||!Number.isInteger(block.minutes)||block.minutes<1)throw failure('PROGRESSION_CONFIG_REQUIRED','The mission progression configuration is incomplete. Ask an adult to review the training plan.');
  const activity=byKey.get(block.id);const status=normalizedStatus(activity?.status);
  if(!terminal.has(status))throw failure('MISSION_NOT_READY','Finish or safely substitute every activity before completing the mission.');
  if(status==='SKIPPED'){skippedPrescribedMinutes+=block.minutes;continue;}
  const ids=attributeIds(block);completedPrescribedMinutes+=block.minutes;
  const units=block.minutes*1000;const base=Math.floor(units/ids.length);let remainder=units-base*ids.length;
  for(const id of ids){attributeUnits[id]=(attributeUnits[id]||0)+base+(remainder>0?1:0);if(remainder>0)remainder--;}
 }
 const totalPrescribedMinutes=completedPrescribedMinutes+skippedPrescribedMinutes;
 const journeyBefore={pathId:journey.pathId,week:journey.week,day:journey.day,cycle:journey.cycle};
 return {
  ruleVersion:PROGRESSION_RULE_VERSION,missionInstanceId,profileId,
  completedPrescribedMinutes,skippedPrescribedMinutes,totalPrescribedMinutes,
  completionMultiplier:completedPrescribedMinutes/totalPrescribedMinutes,
  xp:completedPrescribedMinutes,xpUnits:completedPrescribedMinutes*1000,attributeUnits,
  journeyBefore,journeyAfter:nextJourney(journey),firstSaveEligible:completedPrescribedMinutes>0,
 };
}
