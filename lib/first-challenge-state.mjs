export const FIRST_CHALLENGE_PROTOCOL='tf-first-ready-v1';

export function initialFirstValueState(startOperationKey=crypto.randomUUID(),completeOperationKey=crypto.randomUUID()){
 return {step:'goalie-welcome',remaining:60,startOperationKey,completeOperationKey,error:'',busy:false};
}

export function firstValueReducer(state,action){
 switch(action.type){
  case 'WELCOME_CONTINUED': return {...state,step:'first-challenge',error:''};
  case 'CHALLENGE_STARTED': return {...state,step:'challenge-active',remaining:60,busy:false,error:''};
  case 'TICK': return {...state,remaining:Math.max(0,state.remaining-action.seconds)};
  case 'CHALLENGE_COMPLETED': return {...state,step:'first-win',remaining:0,busy:false,error:''};
  case 'WIN_CONTINUED': return {...state,step:'first-today',error:''};
  case 'HYDRATE': {
   if(action.status==='completed')return {...state,step:'first-today',remaining:0,busy:false,error:''};
   if(action.status==='active')return {...state,step:'challenge-active',remaining:Math.max(0,Number(action.remainingSeconds)||0),busy:false,error:''};
   return {...state,step:'goalie-welcome',busy:false,error:''};
  }
  case 'BUSY': return {...state,busy:true,error:''};
  case 'FAILED': return {...state,busy:false,error:action.message};
  default: return state;
 }
}
