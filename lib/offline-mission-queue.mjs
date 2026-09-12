import {missionMutation} from './mission-client.mjs';
import {transitionMission} from './mission-state.mjs';

export const OFFLINE_MISSION_QUEUE_KEY='tendie-forge:mission-queue:v1';
const ITEM_KEYS=new Set(['id','operationKey','profileContextId','missionId','createdAt','priority','body']);
const BODY_KEYS=new Set(['action','missionId','profileContextId','revision','activityKey','result','reason','queuedAt','offlineMutationId']);
const RESULT_KEYS=new Set(['completedSets','usedEasierVersion','answer']);
const ACTIONS=new Set(['start-activity','record-result','start-rest','end-rest','complete-activity','skip-activity','pause','interrupt','safety-stop','resume','abandon','complete-mission']);
const terminal=new Set(['completed','abandoned']);

function exactKeys(value,allowed){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.has(key));}
function validItem(item){
 if(!exactKeys(item,ITEM_KEYS)||typeof item.id!=='string'||item.id!==item.operationKey||typeof item.operationKey!=='string'||typeof item.profileContextId!=='string'||typeof item.missionId!=='string'||typeof item.createdAt!=='string'||![0,1].includes(item.priority)||!exactKeys(item.body,BODY_KEYS))return false;
 const body=item.body;
 if(!ACTIONS.has(body.action)||body.profileContextId!==item.profileContextId||body.missionId!==item.missionId||!Number.isInteger(body.revision)||body.offlineMutationId!==item.id||body.queuedAt!==item.createdAt)return false;
 if(body.result!==undefined&&(!exactKeys(body.result,RESULT_KEYS)||!Number.isInteger(body.result.completedSets)||body.result.completedSets<1||typeof body.result.usedEasierVersion!=='boolean'||(body.result.answer!==undefined&&!Number.isInteger(body.result.answer))))return false;
 return true;
}

export function createOfflineMutation(mission,action,details={},createdAt=new Date().toISOString()){
 const mutation=missionMutation(mission,action,details);const id=mutation.operationKey;
 return {id,operationKey:id,profileContextId:mission.profileContextId,missionId:mission.missionId,createdAt,priority:action==='safety-stop'?0:1,body:{...mutation.body,queuedAt:createdAt,offlineMutationId:id}};
}

export function enqueueOfflineMutation(queue,item){return queue.some(existing=>existing.operationKey===item.operationKey)?queue:[...queue,item];}
export function serializeOfflineQueue(queue){return JSON.stringify(queue.filter(validItem));}
export function restoreOfflineQueue(raw){try{const value=JSON.parse(raw||'[]');return Array.isArray(value)&&value.every(validItem)?value:[];}catch{return [];}}

export function nextOfflineMutation(queue,profileContextId){
 return queue.filter(item=>item.profileContextId===profileContextId).sort((a,b)=>a.priority-b.priority||a.createdAt.localeCompare(b.createdAt))[0]||null;
}

function transitionAction(item,mission){
 const body=item.body;const activity=mission.activities[mission.currentActivityIndex];
 switch(body.action){
  case 'start-activity':return {type:'START_ACTIVITY',activityKey:body.activityKey};
  case 'record-result':return {type:'RECORD_RESULT',activityKey:body.activityKey,result:body.result};
  case 'start-rest':return {type:'START_REST',activityKey:body.activityKey,remainingSeconds:activity?.restSeconds||0};
  case 'end-rest':return {type:'END_REST',activityKey:body.activityKey};
  case 'complete-activity':return {type:'COMPLETE_ACTIVITY',activityKey:body.activityKey};
  case 'skip-activity':return {type:'SKIP_ACTIVITY',activityKey:body.activityKey,reason:body.reason};
  case 'pause':return {type:'PAUSE'};case 'interrupt':return {type:'INTERRUPT',reason:body.reason};case 'safety-stop':return {type:'SAFETY_STOP'};case 'resume':return {type:'RESUME'};case 'abandon':return {type:'ABANDON',reason:body.reason};case 'complete-mission':return {type:'COMPLETE_MISSION'};
  default:throw new Error('Unsupported offline mission action.');
 }
}

export function applyOfflineMutation(mission,item){
 if(item.profileContextId!==mission.profileContextId||item.missionId!==mission.missionId)throw new Error('Return to the goalie this progress belongs to.');
 const before={...mission,status:mission.status.toUpperCase().replaceAll('-','_'),activities:mission.activities.map(activity=>({...activity,status:activity.status.toUpperCase().replaceAll('-','_'),result:activity.result?{...activity.result}:null}))};
 const next=transitionMission(before,transitionAction(item,mission),item.createdAt);
 return {...mission,...next,status:next.status.toLowerCase().replaceAll('_','-'),activities:next.activities.map((activity,index)=>({...mission.activities[index],...activity,status:activity.status.toLowerCase().replaceAll('_','-')})),pendingSync:true};
}

export function projectOfflineQueue(mission,queue){
 return queue.filter(item=>item.profileContextId===mission.profileContextId&&item.missionId===mission.missionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).reduce((current,item)=>applyOfflineMutation(current,item),mission);
}

export function classifyOfflineConflict(item,authoritative){
 if(item.profileContextId!==authoritative.profileContextId||item.missionId!==authoritative.missionId)return 'adult-review';
 const body=item.body;const activity=authoritative.activities.find(candidate=>candidate.key===body.activityKey);
 if(body.action==='complete-mission'&&authoritative.status==='completed')return 'already-applied';
 if(body.action==='abandon'&&authoritative.status==='abandoned')return 'already-applied';
 if(body.action==='safety-stop'&&authoritative.status==='interrupted')return 'already-applied';
 if(body.action==='pause'&&['paused','interrupted'].includes(authoritative.status))return 'already-applied';
 if(body.action==='resume'&&authoritative.status==='in-progress')return 'already-applied';
 if(body.action==='start-activity'&&activity&&activity.status!=='ready')return 'already-applied';
 if(body.action==='record-result'&&activity&&Number(activity.result?.completedSets||0)>=Number(body.result?.completedSets||0))return 'already-applied';
 if(body.action==='start-rest'&&activity?.status==='resting')return 'already-applied';
 if(body.action==='end-rest'&&activity&&activity.status!=='resting')return 'already-applied';
 if(body.action==='complete-activity'&&activity&&['completed','skipped'].includes(activity.status))return 'already-applied';
 if(body.action==='skip-activity'&&activity?.status==='skipped')return 'already-applied';
 if(terminal.has(authoritative.status))return 'adult-review';
 return 'safe-retry';
}

export function rebaseOfflineMutation(item,authoritative){
 if(classifyOfflineConflict(item,authoritative)!=='safe-retry')return item;
 return {...item,body:{...item.body,revision:authoritative.revision}};
}

export async function reconcileOfflineQueue({queue,profileContextId,send,fetchAuthoritative}){
 let remaining=[...queue];let latest=null;
 while(true){
  const item=nextOfflineMutation(remaining,profileContextId);if(!item)break;
  try{latest=await send(item);remaining=remaining.filter(candidate=>candidate.operationKey!==item.operationKey);continue;}catch(error){
   if(error?.code!=='STALE_REVISION')return {queue:remaining,mission:latest,status:error?.retryable?'pending':'adult-review',error};
   const authoritative=await fetchAuthoritative();latest=authoritative;const classification=classifyOfflineConflict(item,authoritative);
   if(classification==='already-applied'){remaining=remaining.filter(candidate=>candidate.operationKey!==item.operationKey);continue;}
   if(classification==='adult-review')return {queue:remaining,mission:latest,status:'adult-review',error};
   const rebased=rebaseOfflineMutation(item,authoritative);
   try{latest=await send(rebased);remaining=remaining.filter(candidate=>candidate.operationKey!==item.operationKey);}catch(retryError){return {queue:remaining,mission:latest,status:retryError?.retryable?'pending':'adult-review',error:retryError};}
  }
 }
 return {queue:remaining,mission:latest,status:remaining.length?'other-profile':'synced'};
}
