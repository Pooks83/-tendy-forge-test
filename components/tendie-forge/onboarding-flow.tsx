"use client";
import {type ReactNode,useEffect,useReducer,useState} from 'react';
import {ArrowLeft,Check,Shield} from 'lucide-react';
import {CONSENT_VERSION,POLICY_VERSION} from '@/lib/identity-contract.mjs';
import {initialOnboardingState,onboardingReducer,restoreOnboardingState} from '@/lib/onboarding-state.mjs';

type Step='welcome'|'adult-account'|'parent-permission'|'create-goalie'|'gear'|'training-plan'|'handoff';
type LegacyProfile={id:string;nickname:string;ageBand:string;catches?:string|null;experience?:string|null;equipment?:string[];spaces?:string[];plannedDays?:string[];missionMinutes?:number|null};
type Props={initialStep?:Step;initialDraft?:unknown|null;signOutLink:ReactNode;onHandoff:(profileId:string)=>Promise<void>;onCoach?:()=>void;legacyProfile?:LegacyProfile};
const equipment=[['tennis-ball','Tennis ball'],['reaction-ball','Reaction ball'],['wall-space','Safe wall space'],['resistance-band','Resistance band'],['cones','Cones']] as const;
const days=[['monday','Monday'],['tuesday','Tuesday'],['wednesday','Wednesday'],['thursday','Thursday'],['friday','Friday'],['saturday','Saturday'],['sunday','Sunday']] as const;

async function saveGoalie(data:Record<string,unknown>,operationKey:string,legacyProfileId?:string){
 const response=await fetch('/api/onboarding',{method:legacyProfileId?'PATCH':'POST',headers:{'Content-Type':'application/json','Idempotency-Key':operationKey},body:JSON.stringify({...data,...(legacyProfileId?{profileId:legacyProfileId}:{})})});
 const result=await response.json() as {profileId?:string;error?:{message?:string}};
 if(!response.ok||!result.profileId)throw new Error(result.error?.message||'Your setup was not changed. Try again.');
 return result.profileId;
}

async function readDraft(){
 const response=await fetch('/api/onboarding-draft',{cache:'no-store'});
 const result=await response.json() as {draft?:unknown;error?:{message?:string}};
 if(!response.ok)throw new Error(result.error?.message||'We couldn’t restore this setup. Try again.');
 return result.draft;
}

async function writeDraft(step:Step,data:Record<string,unknown>,operationKey:string){
 const response=await fetch('/api/onboarding-draft',{method:'PUT',headers:{'Content-Type':'application/json','Idempotency-Key':operationKey},body:JSON.stringify({step,operationKey,consentAccepted:true,consentVersion:CONSENT_VERSION,policyVersion:POLICY_VERSION,data})});
 const result=await response.json() as {error?:{message?:string}};
 if(!response.ok)throw new Error(result.error?.message||'Your setup progress was not saved. Try again.');
}

async function removeDraft(operationKey:string){
 const response=await fetch('/api/onboarding-draft',{method:'DELETE',headers:{'Idempotency-Key':operationKey}});
 const result=await response.json() as {error?:{message?:string}};
 if(!response.ok)throw new Error(result.error?.message||'Your saved setup was not cleared. Try again.');
}

export function OnboardingFlow({initialStep='welcome',initialDraft,signOutLink,onHandoff,onCoach,legacyProfile}:Props){
 const [state,dispatch]=useReducer(onboardingReducer,undefined,()=>{if(initialDraft)return restoreOnboardingState(initialDraft);const initial=initialOnboardingState();return {...initial,step:initialStep,data:{...initial.data,...(legacyProfile?{nickname:legacyProfile.nickname,ageBand:legacyProfile.ageBand,catches:legacyProfile.catches||'left',experience:legacyProfile.experience||'new',equipment:legacyProfile.equipment||[],spaces:legacyProfile.spaces||[],plannedDays:legacyProfile.plannedDays||[],missionMinutes:legacyProfile.missionMinutes||25}:{})}};});
 const [draftStatus,setDraftStatus]=useState<'loading'|'ready'|'error'>(legacyProfile||initialDraft!==undefined?'ready':'loading');
 const [draftError,setDraftError]=useState('');
 const [savingDraft,setSavingDraft]=useState(false);
 useEffect(()=>{
  if(legacyProfile||initialDraft!==undefined)return;
  let current=true;
  void readDraft().then(draft=>{if(!current)return;if(draft)dispatch({type:'RESTORE',draft});setDraftStatus('ready');}).catch(error=>{if(!current)return;setDraftError(error instanceof Error?error.message:'We couldn’t restore this setup. Try again.');setDraftStatus('error');});
  return()=>{current=false;};
 },[legacyProfile,initialDraft]);
 async function retryDraft(){
  setDraftStatus('loading');setDraftError('');
  try{const draft=await readDraft();if(draft)dispatch({type:'RESTORE',draft});setDraftStatus('ready');}
  catch(error){setDraftError(error instanceof Error?error.message:'We couldn’t restore this setup. Try again.');setDraftStatus('error');}
 }
 const set=(field:string,value:unknown)=>{setDraftError('');dispatch({type:'SET',field,value});};
 const draftData={...state.data};
 async function persistDraft(step:Step){
  setSavingDraft(true);setDraftError('');
  try{await writeDraft(step,draftData,state.operationKey);return true;}
  catch(error){setDraftError(error instanceof Error?error.message:'Your setup progress was not saved. Try again.');return false;}
  finally{setSavingDraft(false);}
 }
 async function advance(step:Step){if(await persistDraft(step))dispatch({type:'NEXT'});}
 async function handleBack(){
  if(state.step==='create-goalie'){setSavingDraft(true);setDraftError('');try{await removeDraft(state.operationKey);dispatch({type:'BACK'});}catch(error){setDraftError(error instanceof Error?error.message:'Your saved setup was not cleared. Try again.');}finally{setSavingDraft(false);}return;}
  if(state.step==='gear'){if(await persistDraft('create-goalie'))dispatch({type:'BACK'});return;}
  if(state.step==='training-plan'){if(await persistDraft('gear'))dispatch({type:'BACK'});return;}
  dispatch({type:'BACK'});
 }
 const back=state.step!=='welcome'&&state.step!=='handoff'?<button type="button" className="tf-link tf-onboarding-back" disabled={savingDraft} onClick={()=>void handleBack()}><ArrowLeft size={17}/>Back</button>:null;
 const accountActions=<div className="tf-access-account-actions">{signOutLink}</div>;
 const toggleEquipment=(id:string)=>set('equipment',state.data.equipment.includes(id)?state.data.equipment.filter((item:string)=>item!==id):[...state.data.equipment,id]);
 const toggleSpace=()=>set('spaces',state.data.spaces.includes('small-indoor')?[]:['small-indoor']);
 const toggleDay=(id:string)=>set('plannedDays',state.data.plannedDays.includes(id)?state.data.plannedDays.filter((item:string)=>item!==id):[...state.data.plannedDays,id]);
 async function submit(){
  dispatch({type:'SUBMIT_STARTED'});
  try{
   const profileId=await saveGoalie({nickname:state.data.nickname,ageBand:state.data.ageBand,catches:state.data.catches,experience:state.data.experience,equipment:state.data.equipment,spaces:state.data.spaces,plannedDays:state.data.plannedDays,missionMinutes:state.data.missionMinutes,consentAccepted:state.data.consentAccepted,consentVersion:CONSENT_VERSION,policyVersion:POLICY_VERSION,optionalPermissions:{analytics:state.data.analyticsAllowed,notifications:false,clips:false}},state.operationKey,legacyProfile?.id);
   dispatch({type:'SUBMIT_SUCCEEDED',profileId,nickname:state.data.nickname.trim()});
  }catch(error){dispatch({type:'SUBMIT_FAILED',message:error instanceof Error?error.message:'Your setup was not changed. Try again.'});}
 }
 if(draftStatus==='loading')return <section className="tf-onboarding" aria-busy="true"><p className="tf-kicker">PARENT SETUP</p><h2>Restoring your setup…</h2><p>Your saved choices stay with your adult account.</p></section>;
 if(draftStatus==='error')return <section className="tf-onboarding" role="alert"><p className="tf-kicker">SETUP PAUSED</p><h2>We couldn’t restore your setup.</h2><p>{draftError}</p><button className="tf-primary" onClick={()=>void retryDraft()}>RETRY</button>{accountActions}</section>;
 return <section className="tf-onboarding" aria-live="polite">
  {back}
  {state.step==='welcome'&&<><p className="tf-kicker">PARENT SETUP</p><h2>Build a private training plan for your goalie.</h2><p>You handle permission and setup once. Your goalie gets one clear next step.</p><button className="tf-primary" onClick={()=>dispatch({type:'NEXT'})}>I’M A PARENT</button>{onCoach&&<button className="tf-link" onClick={onCoach}>I’m a coach</button>}{accountActions}</>}
  {state.step==='adult-account'&&<><p className="tf-kicker">ADULT ACCOUNT</p><h2>Your account manages privacy and setup.</h2><p>We have not collected any information about your child yet.</p><button className="tf-primary" onClick={()=>dispatch({type:'NEXT'})}>CONTINUE</button>{accountActions}</>}
  {state.step==='parent-permission'&&<><p className="tf-kicker">PARENT PERMISSION</p><h2>Choose what you approve.</h2><label className="tf-consent-card"><input type="checkbox" checked={state.data.consentAccepted} onChange={event=>set('consentAccepted',event.target.checked)}/><span><strong>Required permission</strong><small>Create a private goalie profile and save training, progress, and safety information.</small></span></label><label className="tf-consent-card optional"><input type="checkbox" checked={state.data.analyticsAllowed} onChange={event=>set('analyticsAllowed',event.target.checked)}/><span><strong>Optional</strong><small>Share pseudonymous reliability data to help improve Tendie Forge. You can say no and still use training.</small></span></label>{draftError&&<p className="tf-error" role="alert">{draftError}</p>}<button className="tf-primary" disabled={!state.data.consentAccepted||savingDraft} onClick={()=>void advance('create-goalie')}>{savingDraft?'SAVING…':'CREATE GOALIE'}</button>{accountActions}</>}
  {state.step==='create-goalie'&&<form className="tf-form" onSubmit={event=>{event.preventDefault();void advance('gear');}}><p className="tf-kicker">CREATE GOALIE</p><h2>Tell us only what training needs.</h2><label>Player nickname<input required maxLength={24} value={state.data.nickname} onChange={event=>set('nickname',event.target.value)} autoComplete="off"/></label><label>Age band<select required value={state.data.ageBand} onChange={event=>set('ageBand',event.target.value)}><option value="" disabled>Choose an age band</option><option>Under 10</option><option>10–12</option><option>13–15</option><option>16 or older</option></select></label>{state.data.ageBand==='16 or older'&&<div className="tf-error" role="alert">This program is designed for ages 10–15. We can’t assign this training for the age you selected. Choose Back to review the setup.</div>}<label>Catches with<select value={state.data.catches} onChange={event=>set('catches',event.target.value)}><option value="left">Left hand</option><option value="right">Right hand</option></select></label><label>Goalie experience<select value={state.data.experience} onChange={event=>set('experience',event.target.value)}><option value="new">New goalie</option><option value="developing">Developing goalie</option><option value="experienced">Experienced goalie</option></select></label>{draftError&&<p className="tf-error" role="alert">{draftError}</p>}<button className="tf-primary" disabled={savingDraft||!state.data.nickname.trim()||!state.data.ageBand||state.data.ageBand==='16 or older'}>{savingDraft?'SAVING…':'BUILD SETUP'}</button>{accountActions}</form>}
  {state.step==='gear'&&<><p className="tf-kicker">GEAR & SPACE</p><h2>What is available at home?</h2><p>No equipment is required. Leave everything unselected for body-only missions.</p><div className="tf-choice-grid">{equipment.map(([id,label])=><label key={id} className="tf-choice"><input type="checkbox" checked={state.data.equipment.includes(id)} onChange={()=>toggleEquipment(id)}/><span>{label}</span></label>)}</div><h3>Confirm the training space</h3><label className="tf-consent-card"><input type="checkbox" checked={state.data.spaces.includes('small-indoor')} onChange={toggleSpace}/><span><strong>Clear indoor training area</strong><small>A dry, non-slip area with room to move safely and no breakable objects nearby.</small></span></label>{draftError&&<p className="tf-error" role="alert">{draftError}</p>}<button className="tf-primary" disabled={savingDraft||!state.data.spaces.includes('small-indoor')} onClick={()=>void advance('training-plan')}>{savingDraft?'SAVING…':'NEXT'}</button>{accountActions}</>}
  {state.step==='training-plan'&&<><p className="tf-kicker">TRAINING PLAN</p><h2>Choose a plan that fits real life.</h2><fieldset className="tf-choice-group"><legend>Mission length</legend>{[15,25,35].map(minutes=><label key={minutes} className="tf-choice"><input type="radio" name="missionMinutes" checked={state.data.missionMinutes===minutes} onChange={()=>set('missionMinutes',minutes)}/><span>{minutes} minutes</span></label>)}</fieldset><fieldset className="tf-choice-group"><legend>Planned days</legend><div className="tf-day-grid">{days.map(([id,label])=><label key={id} className="tf-choice"><input type="checkbox" checked={state.data.plannedDays.includes(id)} onChange={()=>toggleDay(id)}/><span>{label}</span></label>)}</div></fieldset>{(state.error||draftError)&&<p className="tf-error" role="alert">{state.error||draftError}</p>}<button className="tf-primary" disabled={state.submitting||savingDraft||state.data.plannedDays.length===0} onClick={()=>void submit()}>{state.submitting?'SAVING…':'HAND IT TO YOUR GOALIE'}</button>{accountActions}</>}
  {state.step==='handoff'&&<><span className="tf-handoff-icon"><Shield size={36}/><Check size={20}/></span><p className="tf-kicker">SETUP COMPLETE</p><h2>Hand the phone to {state.data.nickname}.</h2><p>Adult setup is closed. Your goalie will see only their training experience.</p><button className="tf-primary" onClick={()=>void onHandoff(state.profileId)}>I’M {state.data.nickname.toUpperCase()}</button></>}
 </section>;
}
