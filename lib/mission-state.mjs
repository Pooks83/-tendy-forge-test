const MISSION_TERMINAL=new Set(['COMPLETED','ABANDONED']);
const SKIP_REASONS=new Set(['safe-substitution','equipment-unavailable','activity-not-appropriate','safety-stop']);

function failure(code,message){
 const error=new Error(message);
 error.name='MissionStateError';
 error.code=code;
 error.status=['SESSION_ALREADY_COMPLETED','INVALID_STATE_TRANSITION'].includes(code)?409:400;
 return error;
}

function validResult(result){
 if(!result||typeof result!=='object'||Array.isArray(result))return false;
 const entries=Object.entries(result);
 if(!entries.length||entries.length>12)return false;
 return entries.every(([key,value])=>{
  if(!/^[a-z][A-Za-z0-9]*$/.test(key))return false;
  if(typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value)&&value>=0&&Number.isInteger(value);
  return typeof value==='string'&&value.length>0&&value.length<=64;
 });
}

function currentActivity(state,activityKey){
 const activity=state.activities[state.currentActivityIndex];
 if(!activity||activity.key!==activityKey)throw failure('INVALID_STATE_TRANSITION','Complete activities in mission order.');
 return activity;
}

function revise(state,changes,at){
 return {...state,...changes,revision:state.revision+1,updatedAt:at};
}

function updateCurrent(state,activity,changes,at){
 const activities=state.activities.map(item=>item.ordinal===activity.ordinal?{...item,...changes,updatedAt:at}:item);
 return revise(state,{activities},at);
}

function nextActivityIndex(activities,start){
 const next=activities.findIndex((activity,index)=>index>=start&&!['COMPLETED','SKIPPED'].includes(activity.status));
 return next<0?activities.length:next;
}

export function createMissionExecution({missionId,activityKeys,contentVersion}){
 if(typeof missionId!=='string'||!missionId||typeof contentVersion!=='string'||!contentVersion||!Array.isArray(activityKeys)||!activityKeys.length||activityKeys.some(key=>typeof key!=='string'||!key)||new Set(activityKeys).size!==activityKeys.length){
  throw failure('INVALID_RESULT','Mission execution needs a stable ID, content version, and unique activities.');
 }
 return {
  missionId,status:'NOT_STARTED',revision:0,currentActivityIndex:0,contentVersion,
  activities:activityKeys.map((key,ordinal)=>({key,ordinal,status:'READY',result:null,restCompletedAfterSet:0})),
 };
}

export function transitionMission(state,action,at=new Date().toISOString()){
 if(!state||!action||typeof action.type!=='string')throw failure('INVALID_STATE_TRANSITION','That mission action is not available.');
 if(state.status==='COMPLETED'&&action.type==='COMPLETE_MISSION')return state;
 if(MISSION_TERMINAL.has(state.status))throw failure('SESSION_ALREADY_COMPLETED','This mission is already closed.');

 switch(action.type){
  case 'START':
   if(state.status!=='NOT_STARTED')throw failure('INVALID_STATE_TRANSITION','This mission has already started.');
   return revise(state,{status:'IN_PROGRESS',startedAt:at},at);
  case 'START_ACTIVITY': {
   if(state.status!=='IN_PROGRESS')throw failure('INVALID_STATE_TRANSITION','Resume the mission before starting an activity.');
   const activity=currentActivity(state,action.activityKey);
   if(activity.status==='IN_PROGRESS')return state;
   if(activity.status!=='READY')throw failure('INVALID_STATE_TRANSITION','That activity cannot be started now.');
   return updateCurrent(state,activity,{status:'IN_PROGRESS',startedAt:activity.startedAt||at},at);
  }
  case 'RECORD_RESULT': {
   if(state.status!=='IN_PROGRESS')throw failure('INVALID_STATE_TRANSITION','Resume the mission before saving a result.');
   const activity=currentActivity(state,action.activityKey);
   if(activity.status!=='IN_PROGRESS'||!validResult(action.result))throw failure('INVALID_RESULT','Enter a valid activity result before continuing.');
   return updateCurrent(state,activity,{result:{...action.result}},at);
  }
  case 'START_REST': {
   if(state.status!=='IN_PROGRESS')throw failure('INVALID_STATE_TRANSITION','Resume the mission before starting rest.');
   const activity=currentActivity(state,action.activityKey);
   if(activity.status!=='IN_PROGRESS'||!Number.isInteger(action.remainingSeconds)||action.remainingSeconds<0||action.remainingSeconds>3600)throw failure('INVALID_RESULT','Choose a valid rest time.');
   return updateCurrent(state,activity,{status:'RESTING',restRemainingSeconds:action.remainingSeconds},at);
  }
  case 'END_REST': {
   if(state.status!=='IN_PROGRESS')throw failure('INVALID_STATE_TRANSITION','Resume the mission before ending rest.');
   const activity=currentActivity(state,action.activityKey);
   if(activity.status!=='RESTING')throw failure('INVALID_STATE_TRANSITION','That activity is not resting.');
   return updateCurrent(state,activity,{status:'IN_PROGRESS',restRemainingSeconds:0,restCompletedAfterSet:typeof activity.result?.completedSets==='number'?activity.result.completedSets:activity.restCompletedAfterSet||0},at);
  }
  case 'COMPLETE_ACTIVITY': {
   if(state.status!=='IN_PROGRESS')throw failure('INVALID_STATE_TRANSITION','Resume the mission before completing an activity.');
   const activity=currentActivity(state,action.activityKey);
   if(activity.status!=='IN_PROGRESS'||!validResult(activity.result))throw failure('INVALID_RESULT','Save the activity result before completing it.');
   const activities=state.activities.map(item=>item.ordinal===activity.ordinal?{...item,status:'COMPLETED',completedAt:at,updatedAt:at}:item);
   return revise(state,{activities,currentActivityIndex:nextActivityIndex(activities,activity.ordinal+1)},at);
  }
  case 'SKIP_ACTIVITY': {
   if(state.status!=='IN_PROGRESS')throw failure('INVALID_STATE_TRANSITION','Resume the mission before substituting an activity.');
   const activity=currentActivity(state,action.activityKey);
   if(!['READY','IN_PROGRESS'].includes(activity.status)||!SKIP_REASONS.has(action.reason))throw failure('INVALID_RESULT','Choose a supported reason for the substitution.');
   const activities=state.activities.map(item=>item.ordinal===activity.ordinal?{...item,status:'SKIPPED',result:{reason:action.reason},completedAt:at,updatedAt:at}:item);
   return revise(state,{activities,currentActivityIndex:nextActivityIndex(activities,activity.ordinal+1)},at);
  }
  case 'PAUSE':
   if(state.status!=='IN_PROGRESS')throw failure('INVALID_STATE_TRANSITION','Only an active mission can be paused.');
   return revise(state,{status:'PAUSED',pausedAt:at},at);
  case 'INTERRUPT':
   if(!['IN_PROGRESS','PAUSED'].includes(state.status))throw failure('INVALID_STATE_TRANSITION','That mission cannot be interrupted now.');
   return revise(state,{status:'INTERRUPTED',interruptedAt:at,interruptionReason:typeof action.reason==='string'?action.reason:'unknown'},at);
  case 'SAFETY_STOP':
   if(state.status==='INTERRUPTED'&&state.interruptionReason==='safety-stop')return state;
   if(!['IN_PROGRESS','PAUSED','INTERRUPTED'].includes(state.status))throw failure('INVALID_STATE_TRANSITION','That mission cannot be stopped now.');
   return revise(state,{status:'INTERRUPTED',interruptedAt:at,interruptionReason:'safety-stop'},at);
  case 'RESUME':
   if(!['PAUSED','INTERRUPTED'].includes(state.status))throw failure('INVALID_STATE_TRANSITION','That mission is not paused.');
   return revise(state,{status:'IN_PROGRESS',resumedAt:at},at);
  case 'ABANDON':
   if(!['IN_PROGRESS','PAUSED','INTERRUPTED'].includes(state.status))throw failure('INVALID_STATE_TRANSITION','That mission cannot be ended now.');
   return revise(state,{status:'ABANDONED',abandonedAt:at,abandonReason:typeof action.reason==='string'?action.reason:'adult-ended'},at);
  case 'COMPLETE_MISSION':
   if(state.status!=='IN_PROGRESS'||state.activities.some(activity=>!['COMPLETED','SKIPPED'].includes(activity.status)))throw failure('INVALID_STATE_TRANSITION','Complete or safely substitute every activity first.');
   return revise(state,{status:'COMPLETED',completedAt:at,currentActivityIndex:state.activities.length},at);
  default:
   throw failure('INVALID_STATE_TRANSITION','That mission action is not available.');
 }
}

export function resolveTodayExecution({mission=null,safetyStopped=false,offlinePending=false,loading=false,error=false}={}){
 if(loading)return {state:'loading',action:null};
 if(error)return {state:'recoverable-error',action:'retry'};
 if(safetyStopped)return {state:'blocked-adult',action:'return-to-adult'};
 if(offlinePending)return {state:'offline-cached',action:'continue-offline'};
 if(!mission||mission.status==='NOT_STARTED')return {state:'mission-ready',action:'start-mission'};
 if(mission.status==='COMPLETED')return {state:'mission-complete',action:'acknowledge-completion'};
 if(mission.status==='ABANDONED')return {state:'blocked-adult',action:'return-to-adult'};
 const activity=mission.activities?.[mission.currentActivityIndex];
 if(activity?.status==='RESTING')return {state:'rest-recovery',action:'resume-rest'};
 if(['IN_PROGRESS','PAUSED','INTERRUPTED'].includes(mission.status))return {state:'active-resume',action:'resume-mission'};
 return {state:'recoverable-error',action:'retry'};
}
