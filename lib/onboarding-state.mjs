export const ONBOARDING_STEPS=['welcome','adult-account','parent-permission','create-goalie','gear','training-plan','handoff'];

const blankData=()=>({nickname:'',ageBand:'',catches:'left',experience:'new',equipment:[],plannedDays:[],missionMinutes:25,consentAccepted:false,analyticsAllowed:false});
const RESUMABLE_STEPS=new Set(['create-goalie','gear','training-plan']);

export function initialOnboardingState(operationKey=crypto.randomUUID()){
 return {step:'welcome',data:blankData(),operationKey,profileId:'',submitting:false,error:''};
}

export function restoreOnboardingState(draft){
 if(!draft||typeof draft!=='object'||!RESUMABLE_STEPS.has(draft.step)||typeof draft.operationKey!=='string'||draft.operationKey.length<8||draft.consentAccepted!==true||!draft.data||typeof draft.data!=='object')return initialOnboardingState();
 const base=blankData();
 return {
  ...initialOnboardingState(draft.operationKey),
  step:draft.step,
  data:{
   ...base,
   nickname:typeof draft.data.nickname==='string'?draft.data.nickname.slice(0,24):'',
   ageBand:typeof draft.data.ageBand==='string'?draft.data.ageBand:'',
   catches:draft.data.catches==='right'?'right':'left',
   experience:['new','developing','experienced'].includes(draft.data.experience)?draft.data.experience:'new',
   equipment:Array.isArray(draft.data.equipment)?draft.data.equipment:[],
   plannedDays:Array.isArray(draft.data.plannedDays)?draft.data.plannedDays:[],
   missionMinutes:[15,25,35].includes(draft.data.missionMinutes)?draft.data.missionMinutes:25,
   consentAccepted:true,
   analyticsAllowed:draft.data.analyticsAllowed===true,
  },
 };
}

export function onboardingReducer(state,action){
 switch(action.type){
  case 'RESTORE': return restoreOnboardingState(action.draft);
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
