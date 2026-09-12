export function resolveTodayMissionAction({status,missionInProgress=false,completedActivities=0,safetyHold=false}){
 if(status==='unavailable'||safetyHold)return {action:'adult-review',label:'Go to parent area'};
 if(completedActivities>0)return {action:'resume-mission',label:'Continue training'};
 if(missionInProgress)return {action:'resume-mission',label:'Resume mission'};
 return {action:'start-mission',label:'Start today’s training'};
}
