export const FIRST_CHALLENGE_PROTOCOL='tf-first-ready-v1';

export function resolveFirstValueStatus(row,safetyStopped=false,now=new Date()){
 const protocolVersion=row?.protocol_version||FIRST_CHALLENGE_PROTOCOL;
 if(safetyStopped)return {status:'safety-stopped',protocolVersion,recovery:'adult-required'};
 if(!row)return {status:'not-started',protocolVersion:FIRST_CHALLENGE_PROTOCOL};
 if(row.status==='active'){
  const startedAt=new Date(row.started_at);
  if(Number.isNaN(startedAt.getTime()))throw new Error('Invalid first challenge start time.');
  const remainingSeconds=Math.max(0,60-Math.floor((now.getTime()-startedAt.getTime())/1000));
  return {status:'active',protocolVersion,remainingSeconds,canComplete:remainingSeconds===0};
 }
 if(row.status==='completed'){
  let result;
  try{result=JSON.parse(row.result_json);}catch{throw new Error('Invalid first challenge result.');}
  return {status:'completed',protocolVersion,result};
 }
 throw new Error('Invalid first challenge status.');
}

export function initialFirstValueState(startOperationKey=crypto.randomUUID(),completeOperationKey=crypto.randomUUID(),todayOperationKey=crypto.randomUUID(),missionOperationKey=crypto.randomUUID()){
 return {step:'goalie-welcome',remaining:60,startOperationKey,completeOperationKey,todayOperationKey,missionOperationKey,missionStarted:false,error:'',busy:false};
}

export function resolveFirstTodayState({challengeStatus,missionStatus,safetyStopped=false}){
 if(safetyStopped)return {state:'blocked-adult',action:'adult-review'};
 if(challengeStatus==='active')return {state:'first-challenge',action:'resume-challenge'};
 if(challengeStatus==='completed'&&missionStatus==='in-progress')return {state:'active-resume',action:'resume-mission'};
 if(challengeStatus==='completed')return {state:'mission-ready',action:'start-mission'};
 return {state:'first-challenge',action:'start-challenge'};
}

export function firstValueReducer(state,action){
 switch(action.type){
  case 'WELCOME_CONTINUED': return {...state,step:'first-challenge',error:''};
  case 'CHALLENGE_STARTED': return {...state,step:'challenge-active',remaining:60,busy:false,error:''};
  case 'TICK': return {...state,remaining:Math.max(0,state.remaining-action.seconds)};
  case 'CHALLENGE_COMPLETED': return {...state,step:'first-win',remaining:0,busy:false,error:''};
  case 'SAFETY_STOPPED': return {...state,step:'safety-stopped',busy:false,error:''};
  case 'WIN_CONTINUED': return {...state,step:'first-today',error:''};
  case 'HYDRATE': {
   if(action.status==='safety-stopped')return {...state,step:'safety-stopped',busy:false,error:''};
   if(action.status==='completed')return {...state,step:'first-today',remaining:0,missionStarted:action.missionStatus==='in-progress',busy:false,error:''};
   if(action.status==='active')return {...state,step:'challenge-active',remaining:Math.max(0,Number(action.remainingSeconds)||0),busy:false,error:''};
   return {...state,step:'goalie-welcome',busy:false,error:''};
  }
  case 'BUSY': return {...state,busy:true,error:''};
  case 'FAILED': return {...state,busy:false,error:action.message};
  default: return state;
 }
}
