function currentActivity(mission){return mission?.activities?.[mission.currentActivityIndex]||null;}

export function resolveMissionActivityControl(mission){
 if(!mission)return {action:'retry',label:'Reload mission'};
 if(mission.status==='completed')return {action:'acknowledge-completion',label:'Mission complete'};
 if(['paused','interrupted'].includes(mission.status))return {action:'resume',label:'Resume mission'};
 const activity=currentActivity(mission);
 if(!activity)return {action:'complete-mission',label:'Finish mission'};
 if(activity.status==='ready')return {action:'start-activity',label:'Start this activity'};
 if(activity.status==='resting')return {action:'end-rest',label:'Resting'};
 const completed=Number(activity.result?.completedSets||0);
 if(completed>=activity.requiredSets)return {action:'complete-activity',label:'Finish activity'};
 if(completed>activity.restCompletedAfterSet&&activity.restSeconds>0)return {action:'start-rest',label:`Start ${activity.restSeconds}-second rest`};
 return {action:'record-result',label:`I finished set ${completed+1}`};
}

function operationPart(value){return String(value??'').replace(/[^A-Za-z0-9._-]/g,'_');}

export function missionMutation(mission,action,details={}){
 const body={action,missionId:mission.missionId,profileContextId:mission.profileContextId,revision:mission.revision};
 if(details.activityKey)body.activityKey=details.activityKey;
 if(action==='record-result')body.result={completedSets:details.completedSets,usedEasierVersion:details.usedEasierVersion===true,...(Number.isInteger(details.answer)?{answer:details.answer}:{})};
 if(details.reason)body.reason=details.reason;
 const operationKey=['mission',mission.profileContextId,mission.missionId,mission.revision,action,details.activityKey,details.completedSets,details.answer,details.reason].map(operationPart).join(':');
 if(operationKey.length>128)throw new Error('Mission request identity is too long. Reload the mission.');
 return {body,operationKey};
}
