export const ONBOARDING_STEPS=['welcome','adult-account','parent-permission','create-goalie','gear','training-plan','handoff'];

const blankData=()=>({nickname:'',ageBand:'',catches:'left',experience:'new',equipment:[],plannedDays:[],missionMinutes:25,consentAccepted:false,analyticsAllowed:false});

export function initialOnboardingState(operationKey=crypto.randomUUID()){
 return {step:'welcome',data:blankData(),operationKey,profileId:'',submitting:false,error:''};
}

export function onboardingReducer(state,action){
 switch(action.type){
  case 'SET': return {...state,data:{...state.data,[action.field]:action.value},error:''};
  case 'NEXT': {
   const index=ONBOARDING_STEPS.indexOf(state.step);
   return index>=0&&index<ONBOARDING_STEPS.indexOf('training-plan')?{...state,step:ONBOARDING_STEPS[index+1],error:''}:state;
  }
  case 'BACK': {
   const index=ONBOARDING_STEPS.indexOf(state.step);
   return index>0?{...state,step:ONBOARDING_STEPS[index-1],error:''}:state;
  }
  case 'SUBMIT_STARTED': return {...state,submitting:true,error:''};
  case 'SUBMIT_FAILED': return {...state,submitting:false,error:action.message};
  case 'SUBMIT_SUCCEEDED': return {...state,step:'handoff',profileId:action.profileId,submitting:false,error:'',data:{...state.data,nickname:action.nickname}};
  case 'RESET': return initialOnboardingState(action.operationKey);
  default: return state;
 }
}
