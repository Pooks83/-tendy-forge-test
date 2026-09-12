import {isPublishedActivity} from './training-content.mjs';

const REASONS={
 SAFETY_STOPPED:'Training is paused until an adult checks in.',
 WORKLOAD_BLOCKED:'Recovery or workload rules do not allow this activity now.',
 NOT_PUBLISHED:'This activity version is not approved for assignment.',
 AGE_BLOCKED:'This activity is not approved for the player age band.',
 LEVEL_BLOCKED:'This activity has no approved prescription for the player level.',
 PHYSICAL_RESTRICTION:'A recorded physical restriction blocks this activity.',
 EQUIPMENT_MISSING:'Required equipment is not available and no approved substitution fits.',
 SPACE_MISSING:'Required space is not available and no approved substitution fits.',
 INPUT_MISSING:'A required reviewed input is not available.',
 OBJECTIVE_MISMATCH:'This activity does not support the mission objective.',
};
const ORDER=['SAFETY_STOPPED','WORKLOAD_BLOCKED','NOT_PUBLISHED','AGE_BLOCKED','LEVEL_BLOCKED','PHYSICAL_RESTRICTION','EQUIPMENT_MISSING','SPACE_MISSING','INPUT_MISSING','OBJECTIVE_MISMATCH'];
const missing=(required,available)=>[...(required||[])].filter(item=>!new Set(available||[]).has(item));
const covers=(declared,required)=>required.every(item=>(declared||[]).includes(item));
const reason=code=>({code,message:REASONS[code]});

function matchingSubstitution(activity,context,missingEquipment,missingSpace){
 return [...(activity.substitutions||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id))).find(item=>
  covers(item.whenEquipmentMissing,missingEquipment)&&covers(item.whenSpaceMissing,missingSpace)&&missing(item.equipment,context.equipment).length===0&&missing(item.space,context.spaces).length===0
 )||null;
}

export function evaluateActivity(activity,context){
 const codes=[];const add=code=>{if(!codes.includes(code))codes.push(code);};
 if(context?.safetyStopped===true)add('SAFETY_STOPPED');
 if(!context?.workload||context.workload.status!=='ready')add('WORKLOAD_BLOCKED');
 if(!isPublishedActivity(activity))add('NOT_PUBLISHED');
 if(!activity?.eligibility?.ageBands?.includes(context?.ageBand))add('AGE_BLOCKED');
 const prescription=activity?.eligibility?.levels?.includes(context?.level)?activity?.prescriptions?.[context.level]:null;
 if(!prescription)add('LEVEL_BLOCKED');
 if(prescription&&Number.isFinite(context?.workload?.maxActivityMinutes)&&prescription.estimatedMinutes>context.workload.maxActivityMinutes)add('WORKLOAD_BLOCKED');
 if((activity?.movementTags||[]).some(tag=>(context?.physicalRestrictions||[]).includes(tag)))add('PHYSICAL_RESTRICTION');
 const missingEquipment=missing(activity?.equipment,context?.equipment);const missingSpace=missing(activity?.space,context?.spaces);
 const substitution=missingEquipment.length||missingSpace.length?matchingSubstitution(activity,context||{},missingEquipment,missingSpace):null;
 if(missingEquipment.length&&!substitution)add('EQUIPMENT_MISSING');
 if(missingSpace.length&&!substitution)add('SPACE_MISSING');
 if(missing(activity?.requiredInputs,context?.requiredInputs).length)add('INPUT_MISSING');
 const objectiveSkills=context?.objective?.technicalSkillIds;
 if(Array.isArray(objectiveSkills)&&objectiveSkills.length&&!objectiveSkills.some(id=>(activity?.technicalSkillIds||[]).includes(id)))add('OBJECTIVE_MISMATCH');
 const reasons=ORDER.filter(code=>codes.includes(code)).map(reason);
 return {eligible:reasons.length===0,prescription:prescription||null,substitution:reasons.length===0?substitution:null,reasons};
}

export function eligibleActivities(catalog,context){
 const evaluated=[...(catalog||[])].sort((a,b)=>`${a.activityId}:${a.version}`.localeCompare(`${b.activityId}:${b.version}`)).map(activity=>({activity,...evaluateActivity(activity,context)}));
 return {eligible:evaluated.filter(item=>item.eligible),excluded:evaluated.filter(item=>!item.eligible)};
}
