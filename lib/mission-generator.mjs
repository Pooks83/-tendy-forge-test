import {eligibleActivities} from './activity-eligibility.mjs';

export const GENERATOR_VERSION='tf-mission-generator-v1';
const COUNTS=new Map([[15,3],[25,4],[35,5]]);
const unavailable=(code,message,nextAction,dominantRule)=>({kind:'unavailable',code,audience:'player',message,nextAction,explanation:{dominantRule}});
const identity=item=>`${item.activityId}:${item.version}`;

function planningEligibility(context){
 return {ageBand:context.ageBand,level:context.level,equipment:context.equipment,spaces:context.spaces,physicalRestrictions:context.physicalRestrictions,safetyStopped:context.safetyStopped,workload:context.workload,objective:null,requiredInputs:context.requiredInputs};
}

function ranked(items,context){
 const coverage=new Map((context.coverageHistory||[]).map(item=>[item.familyId,Number(item.count)||0]));
 const recent=new Map((context.varietyHistory||[]).map((id,index)=>[id,index]));
 return [...items].sort((a,b)=>(coverage.get(a.activity.familyId)||0)-(coverage.get(b.activity.familyId)||0)||(recent.has(a.activity.familyId)?1:0)-(recent.has(b.activity.familyId)?1:0)||identity(a.activity).localeCompare(identity(b.activity)));
}

function projected(item,reason){
 const activity=item.activity;return {activityId:activity.activityId,version:activity.version,familyId:activity.familyId,name:activity.name,developmentPurpose:activity.developmentPurpose,technicalSkillIds:[...activity.technicalSkillIds],attributeIds:[...activity.attributeIds],movementTags:[...activity.movementTags],prescription:{...item.prescription},equipment:[...(item.substitution?.equipment||activity.equipment)],space:[...(item.substitution?.space||activity.space)],setup:item.substitution?.setup||activity.setup,startingPosition:activity.startingPosition,movementSteps:[...activity.movementSteps],primaryCues:[...activity.primaryCues],commonMistake:activity.commonMistake,easierVersion:activity.easierVersion,harderVersion:activity.harderVersion,safetyConsiderations:[...activity.safetyConsiderations],painStopRule:activity.painStopRule,visualAssetId:activity.visualAssetId,caption:activity.caption,altText:activity.altText,substitution:item.substitution?{...item.substitution}:null,selectionReason:reason};
}

export function generateMission(context){
 const count=COUNTS.get(context?.durationMinutes);if(!count)throw new Error('Mission duration must be 15, 25, or 35 minutes.');
 const priorities=(context.activePriorities||[]).filter(item=>item?.status==='ACTIVE');if(priorities.length>1)throw new Error('Mission generation accepts only one active priority.');
 if(context.safetyStopped===true)return unavailable('SAFETY_STOPPED','Training is paused. Ask an adult to check in.','adult-check-in','SAFETY_RESTRICTION');
 if(!context.workload||context.workload.status!=='ready')return unavailable('RECOVERY_DAY','Today is for recovery. Follow the adult recovery plan.','rest-recovery','RECOVERY_WORKLOAD');
 const evaluated=eligibleActivities(context.catalog||[],planningEligibility(context));
 const excludedCounts={};for(const item of evaluated.excluded)for(const itemReason of item.reasons)excludedCounts[itemReason.code]=(excludedCounts[itemReason.code]||0)+1;
 if(evaluated.eligible.length<count){
  const unreviewed=(context.catalog||[]).length===0||(context.catalog||[]).some(item=>item.contentStatus!=='PUBLISHED');
  return unavailable(unreviewed?'CONTENT_REVIEW_REQUIRED':'NO_SAFE_MISSION',unreviewed?'An adult needs to review your training plan.':'No safe mission is available for the current setup.',unreviewed?'adult-content-review':'adult-plan-review',unreviewed?'CONTENT_PUBLICATION':'ELIGIBILITY');
 }
 const activePriority=priorities[0]||null;const coachFocus=context.coachFocus?.confirmed===true?context.coachFocus:null;
 const selected=[];const selectedIds=new Set();const add=(item,reason)=>{if(item&&!selectedIds.has(identity(item.activity))){selected.push({item,reason});selectedIds.add(identity(item.activity));}};
 const mapped=(mapping)=>ranked(evaluated.eligible.filter(item=>(mapping?.interventionFamilyIds||[]).includes(item.activity.familyId)),context);
 if(coachFocus){const options=mapped(coachFocus);if(!options.length)return unavailable('COACH_FOCUS_CONTENT_UNAVAILABLE','An adult needs to review the confirmed coach focus.','adult-plan-review','COACH_FOCUS');add(options[0],'COACH_FOCUS');}
 if(activePriority){
  const options=mapped(activePriority);if(!options.length)return unavailable('PRIORITY_CONTENT_UNAVAILABLE','An adult needs to review the active development priority.','adult-plan-review','ACTIVE_PRIORITY');
  const target=context.durationMinutes===25?2:Math.max(1,Math.round(count/2));for(const item of options.slice(0,target))add(item,'ACTIVE_PRIORITY');
 }
 if(context.dueRetest){const option=ranked(evaluated.eligible.filter(item=>(context.dueRetest.interventionFamilyIds||[]).includes(item.activity.familyId)),context)[0];if(option)add(option,'DUE_RETEST');}
 for(const item of ranked(evaluated.eligible,context)){if(selected.length>=count)break;add(item,'COVERAGE');}
 if(selected.length<count)return unavailable('NO_SAFE_MISSION','No safe mission is available for the current setup.','adult-plan-review','ELIGIBILITY');
 const ordered=selected.slice(0,count).map(({item,reason})=>projected(item,reason));const priorityIds=activePriority?[activePriority.id]:[];
 const source=coachFocus?'COACH_FOCUS':activePriority?'ACTIVE_PRIORITY':context.dueRetest?'DUE_RETEST':'FOUNDATION';const meaningful=ordered.reduce((sum,item)=>sum+item.prescription.estimatedMinutes,0);const priorityMinutes=activePriority?ordered.filter(item=>(activePriority.interventionFamilyIds||[]).includes(item.familyId)).reduce((sum,item)=>sum+item.prescription.estimatedMinutes,0):0;
 const equipment=[...new Set(ordered.flatMap(item=>item.equipment))].sort();const substitutions=ordered.filter(item=>item.substitution).map(item=>({activityId:item.activityId,...item.substitution}));
 return {kind:'mission',missionId:context.planKey,version:GENERATOR_VERSION,source,objective:coachFocus?{id:coachFocus.id,technicalSkillIds:[...(coachFocus.technicalSkillIds||[])]}:activePriority?{id:activePriority.id,childCue:activePriority.childCue,shortExplanation:activePriority.shortExplanation,technicalSkillIds:[...(activePriority.technicalSkillIds||[])]}:{id:'foundation-coverage',technicalSkillIds:[]},priorityIds,orderedActivityVersions:ordered,durationMinutes:context.durationMinutes,equipment,substitutions,workload:{plannedActivityMinutes:meaningful,status:'ready'},completionRules:{requiredActivityCount:count,optionalExtrasMultiplierCap:1},rewardRuleVersion:context.rewardRuleVersion,explanation:{dominantRule:source,durationMinutes:context.durationMinutes,activityCount:count,selected:ordered.map(item=>({activityId:item.activityId,version:item.version,reason:item.selectionReason})),excludedCounts,priorityAllocation:activePriority?{priorityId:activePriority.id,minutes:priorityMinutes,meaningfulMinutes:meaningful,ratio:meaningful?priorityMinutes/meaningful:0}:null}};
}
