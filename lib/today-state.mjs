export function resolveTodayMissionAction({missionInProgress=false,completedActivities=0}){
 if(completedActivities>0)return {action:'resume-mission',label:'Continue training'};
 if(missionInProgress)return {action:'resume-mission',label:'Resume mission'};
 return {action:'start-mission',label:'Start today’s training'};
}
