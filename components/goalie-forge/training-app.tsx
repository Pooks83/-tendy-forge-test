"use client";
import {type ReactNode,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Home,Dumbbell,TrendingUp,User,Shield,ArrowRight,Check,Play,Pause,Trophy,Clock,ChevronRight,AlertTriangle,Lock} from 'lucide-react';
import {toast} from 'sonner';
import {Toaster} from '@/components/ui/sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Progress} from '@/components/ui/progress';
import {PATHS,GROUPS,WEEKS,SKILLS,EVALUATION_SECTIONS,newTrainingState,buildSession,isDrillDone,canAdvance} from '@/lib/training.mjs';
import {applyAction} from '@/lib/training-actions.mjs';
import {parseTrainingLocation,trainingLocation,resolveTrainingDrill} from '@/lib/training-navigation.mjs';
import {readTrainingResponse} from '@/lib/training-request.mjs';
import {activeAdultProfileId,buildPlayerViewState,loadInitialAccess} from '@/lib/access-loader.mjs';
import {completeContextSwitch,contextSwitchOperationKey} from '@/lib/context-switch.mjs';
import {resolveTodayMissionAction} from '@/lib/today-state.mjs';
import {missionMutation,resolveMissionActivityControl} from '@/lib/mission-client.mjs';
import {sendMissionMutation} from '@/lib/mission-request.mjs';
import {OFFLINE_MISSION_QUEUE_KEY,applyOfflineMutation,createOfflineMutation,enqueueOfflineMutation,hasPendingSafetyStop,projectOfflineQueue,reconcileOfflineQueue,restoreOfflineQueue,serializeOfflineQueue} from '@/lib/offline-mission-queue.mjs';
import {DrillMap} from './drill-map';
import {OnboardingFlow} from '@/components/tendie-forge/onboarding-flow';
import {PlayerFirstValueFlow} from '@/components/tendie-forge/player-first-value';
type TrainingState=ReturnType<typeof newTrainingState>;
type Profile={id:string;nickname:string;team:string;ageBand:string;role:'owner'|'coach'|'player';active?:boolean;revision:number;state:TrainingState;grants:string[];catches?:string|null;experience?:string|null;equipment?:string[];spaces?:string[];plannedDays?:string[];missionMinutes?:number|null;setupStatus?:string};
type PlayerProjection={profile:{id:string;nickname:string;ageBand:string;catches:string;experience:string;equipment:string[];spaces:string[];plannedDays:string[];missionMinutes:number;setupStatus:string;revision:number};training:TrainingState};
type MissionActivity={key:string;ordinal:number;status:string;result:{completedSets?:number;answer?:number;correct?:boolean;usedEasierVersion?:boolean}|null;requiredSets:number;restSeconds:number;restRemainingSeconds:number;restCompletedAfterSet:number};
type Substitution={id?:string;equipment?:string[];space?:string[];setup?:string};
type Drill=ReturnType<typeof buildSession>['blocks'][number]&{activityId?:string;version?:number;substitution?:Substitution|null};
type MissionSnapshot=Omit<ReturnType<typeof buildSession>,'blocks'>&{blocks:Drill[];reading?:{question:string;options:string[];answer:number;explanation:string};generatorExplanation?:Record<string,unknown>};
type MissionProjection={id?:string;missionId:string;profileContextId:string;status:string;revision:number;currentActivityIndex:number;activities:MissionActivity[];executionSnapshot:MissionSnapshot|null;pendingSync?:boolean;unavailable?:{code:string;message:string;nextAction:string};safetyHold?:{code:string;message:string;nextAction:string;activityKey:string;replacement:{activityId:string;version:number;name:string}|null}};
type OfflineMutation=ReturnType<typeof createOfflineMutation>;
type OfflineStatus='pending'|'syncing'|'synced'|'other-profile'|'adult-review'|'';
type Action={type:string;drillId?:string;setIndex?:number;answer?:number;usedEasierVersion?:boolean;skillId?:number;passed?:boolean;note?:string;ratings?:number[];cause?:string;reason?:string};
const NAV=[['Home',Home],['Train',Dumbbell],['Progress',TrendingUp],['Profile',User]] as const;
const PLAYER_NAV=[['Today',Home],['Journey',Dumbbell],['Progress',TrendingUp],['Profile',User]] as const;
const RUBRICS:Record<string,string>={Move:'Small side jumps or steps end balanced for 2 seconds, without pain or knee collapse.',See:'Eyes follow 8 of 10 gentle soft-ball throws all the way into the hands, allowing an easier version.',React:'Responds to the actual ball direction, not a fake, on 4 of 5 gentle attempts.',Recover:'Looks first, steps to the soft ball, then resets under control on 5 of 6 attempts.',Think:'Explains the useful response and why in 3 different reading situations.',Compete:'Uses a reset after a mistake and applies one specific coaching cue on the next attempt.'};
async function request<T={id:string;state:TrainingState;revision:number}>(body:unknown):Promise<T> {
 const response=await fetch('/api/training',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return await readTrainingResponse(response) as T;
}
async function requestPlayerAction(body:unknown,operationKey:string):Promise<PlayerProjection>{
 const response=await fetch('/api/player-action',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':operationKey},body:JSON.stringify(body)});
 return await readTrainingResponse(response) as PlayerProjection;
}
async function setPlayerContext(profileId:string,operationKey:string){
 const response=await fetch('/api/player-context',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':operationKey},body:JSON.stringify({profileId})});
 return await readTrainingResponse(response) as PlayerProjection;
}
async function startPlayerMission(operationKey:string):Promise<MissionProjection>{
 const response=await fetch('/api/mission',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':operationKey},body:JSON.stringify({action:'start'})});
 return await readTrainingResponse(response) as MissionProjection;
}
async function fetchMissionProjection():Promise<MissionProjection>{
 const response=await fetch('/api/mission',{cache:'no-store'});
 return await readTrainingResponse(response) as MissionProjection;
}
async function requestMissionMutation(current:MissionProjection,action:string,details:Record<string,unknown>={}):Promise<MissionProjection>{
 const mutation=missionMutation(current,action,details);
 return await sendMissionMutation(fetch,mutation) as MissionProjection;
}
async function fetchTrainingProfiles():Promise<{mode:'guest'|'signed-in';profiles:Profile[]}> {
 const response=await fetch('/api/training',{cache:'no-store'});
 if(response.status===401)return {mode:'guest',profiles:[]};
 const data=await readTrainingResponse(response) as {profiles:Profile[]};
 return {mode:'signed-in',profiles:data.profiles};
}
async function fetchPlayerProjection():Promise<PlayerProjection|null>{
 const response=await fetch('/api/player',{cache:'no-store'});
 if(response.status===409||response.status===403)return null;
 return await readTrainingResponse(response) as PlayerProjection;
}
async function confirmProfileTrainingSpace(profile:Profile){
 const operationKey=`confirm-space:${profile.id}:${profile.revision}`;const response=await fetch('/api/onboarding',{method:'PUT',headers:{'Content-Type':'application/json','Idempotency-Key':operationKey},body:JSON.stringify({profileId:profile.id,revision:profile.revision,spaces:['small-indoor']})});return await readTrainingResponse(response) as {revision:number;spaces:string[]};
}
function Brand({onHome}:{onHome?:()=>void}) {
 const content=<><span className="tf-brand-mark"><Shield size={23}/></span><span className="tf-brand-copy">GOALIE <b>FORGE</b><small>ST. CLAIR SHORES SAINTS</small></span></>;
 return onHome?<button type="button" onClick={onHome} className="tf-brand" aria-label="Go to training home">{content}</button>:<div className="tf-brand">{content}</div>;
}
type AccessShellProps={mode:'loading'|'signed-in'|'guest'|'error';error:string;signInLink:ReactNode;signOutLink:ReactNode;onPreview:()=>void;onReload:()=>void;onCreated:(id:string)=>Promise<void>;onboardingDraft?:unknown|null};
export function AccessShell({mode,error,signInLink,signOutLink,onPreview,onReload,onCreated,onboardingDraft}:AccessShellProps) {
 return <main className="tf-app tf-access-app">
  <header className="tf-header tf-access-header"><Brand/><span className="tf-office">At home · Off ice</span></header>
  <section className="tf-access-main" aria-labelledby="access-title">
   <p className="tf-kicker">SCS SAINTS GOALIE DEVELOPMENT</p><h1 id="access-title">Your next save starts here.</h1>
   {mode==='loading'&&<p role="status">Loading your training…</p>}
   {mode==='error'&&<><div className="tf-error" role="alert"><p>{error||'Training could not be loaded.'}</p><button className="tf-secondary" onClick={onReload}>Try again</button></div><div className="tf-access-account-actions">{signOutLink}</div></>}
   {mode==='guest'&&<><p>Sign in with an adult account to manage private player progress.</p><div className="tf-access-actions">{signInLink}<button className="tf-secondary" onClick={onPreview}>Explore a sample session</button></div><p className="tf-fine">No child email, photos, public profile, rankings, or direct messages.</p></>}
   {mode==='signed-in'&&<EmptyAccount onCreated={onCreated} signOutLink={signOutLink} onboardingDraft={onboardingDraft}/>}
  </section>
  <footer className="tf-footer">SCS Saints Goalie Forge · At-home, off-ice development · Adult managed</footer>
 </main>;
}
export function MissionUnavailableState({message,onAdult}:{message:string;onAdult:()=>void}){
 return <section className="tf-error" role="status"><AlertTriangle/><h2>Training plan needs an adult.</h2><p>{message}</p><button className="tf-secondary" onClick={onAdult}>Go to parent area</button></section>;
}
export function MissionSafetyHold({message,replacement,onAdult}:{message:string;replacement:{activityId:string;version:number;name:string}|null;onAdult:()=>void}){
 return <section className="tf-error" role="alert"><AlertTriangle/><h2>Stop this activity.</h2><p>{message}</p>{replacement&&<p><strong>Reviewed replacement:</strong> {replacement.name}</p>}<button className="tf-secondary" onClick={onAdult}>Go to parent area</button></section>;
}
export function MissionSubstitutionNotice({substitution}:{substitution:Substitution}){
 return <section className="tf-notice" role="status"><strong>Safe setup change</strong><p>{substitution.setup||'Use the listed equipment and space for this approved version.'}</p></section>;
}
export function TrainingApp({signInLink,signOutLink}:{signInLink:ReactNode;signOutLink:ReactNode}){
 const [tab,setTab]=useState('Home');const [profiles,setProfiles]=useState<Profile[]>([]);const [active,setActive]=useState('');
 const [player,setPlayer]=useState<PlayerProjection|null>(null);const [showFirstValue,setShowFirstValue]=useState(false);const [resumeFirstValue,setResumeFirstValue]=useState(false);
 const [mission,setMission]=useState<MissionProjection|null>(null);
 const [offlineQueue,setOfflineQueue]=useState<OfflineMutation[]>([]);const [offlineStatus,setOfflineStatus]=useState<OfflineStatus>('');
 const [mode,setMode]=useState<'loading'|'signed-in'|'guest'|'error'>('loading');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState(false);const [sample,setSample]=useState(newTrainingState);const [selected,setSelected]=useState<string|null>(null);
 const [celebration,setCelebration]=useState('');const busyRef=useRef(false);const syncRef=useRef(false);const dialogRef=useRef<HTMLDivElement>(null);const contextKeysRef=useRef(new Map<string,string>());const queueRef=useRef<OfflineMutation[]>([]);const missionRef=useRef<MissionProjection|null>(null);
 const adultProfile=profiles.find(p=>p.id===active)||profiles[0];
 const profile:Profile|undefined=player?{...player.profile,team:'',role:'player',state:player.training,grants:[]}:adultProfile;
 const playerMode=Boolean(player);
 const baseState=preview?sample:player?buildPlayerViewState(player.training,newTrainingState()) as TrainingState:adultProfile?.state||newTrainingState();
 const localSafetyPending=Boolean(player&&hasPendingSafetyStop(offlineQueue,player.profile.id));const state=localSafetyPending?{...baseState,safetyStopped:true}:baseState;
 const path=PATHS.find(p=>p.id===state.pathId)!;const generatedSession=useMemo(()=>buildSession(state.pathId,state.week,state.day,state.cycle||0),[state.pathId,state.week,state.day,state.cycle]);
 const session=playerMode&&mission?.executionSnapshot?.blocks?.length?mission.executionSnapshot:generatedSession;
 const sessionDrillIds=useMemo(()=>session.blocks.map(item=>item.id),[session]);
 const completed=playerMode&&mission?mission.activities.filter(item=>['completed','skipped'].includes(item.status)).length:session.blocks.filter(d=>isDrillDone(state,session,d)).length;
 const todayAction=resolveTodayMissionAction({status:mission?.status,missionInProgress:['in-progress','paused','interrupted'].includes(mission?.status||''),completedActivities:completed,safetyHold:Boolean(mission?.safetyHold)});
 const sessionDone=playerMode?mission?.status==='completed':state.sessions.some((s:{id:string})=>s.id===session.id);
 const missionAbandoned=Boolean(playerMode&&mission?.status==='abandoned');
 const enabled=preview||Boolean(profile);const drillId=resolveTrainingDrill(enabled&&!showFirstValue,selected,sessionDrillIds);
 const drill=session.blocks.find(d=>d.id===drillId);const coach=profile?.role==='coach'&&!preview;
 const skillChecks=state.checks as Array<{group:string;pathId:string;passed:boolean;date:string;skillId?:number}>;
 const navigate=useCallback((view:string,drillId:string|null=null,replace=false)=>{setTab(view);setSelected(drillId);if(typeof window!=='undefined'){const url=trainingLocation({view,drill:drillId});window.history[replace?'replaceState':'pushState']({},'',url);}},[]);
 const persistOfflineQueue=useCallback((queue:OfflineMutation[])=>{queueRef.current=queue;setOfflineQueue(queue);try{if(typeof window!=='undefined')window.localStorage.setItem(OFFLINE_MISSION_QUEUE_KEY,serializeOfflineQueue(queue));return true;}catch{return false;}},[]);
 const loadAdult=useCallback(async()=>{
  try{const result=await fetchTrainingProfiles();setProfiles(result.profiles);setActive(activeAdultProfileId(result.profiles));setMode(result.mode);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Cannot load training');setMode('error');}
 },[]);
 const loadPlayer=useCallback(async()=>{try{const result=await fetchPlayerProjection();if(result){const currentMission=await fetchMissionProjection();setPlayer(result);setMission(currentMission);setProfiles([]);setMode('signed-in');setError('');}return result;}catch(e){setError(e instanceof Error?e.message:'Cannot load your goalie');return null;}},[]);
 const load=useCallback(async()=>{if(player)await loadPlayer();else await loadAdult();},[player,loadPlayer,loadAdult]);
 const syncOffline=useCallback(async()=>{
  const current=missionRef.current;if(syncRef.current||!current||!queueRef.current.length)return;syncRef.current=true;setOfflineStatus('syncing');
  try{
   const result=await reconcileOfflineQueue({queue:queueRef.current,profileContextId:current.profileContextId,send:(item:OfflineMutation)=>sendMissionMutation(fetch,item),fetchAuthoritative:fetchMissionProjection});
   persistOfflineQueue(result.queue);if(result.mission){const confirmed={...result.mission,pendingSync:false};missionRef.current=confirmed;setMission(confirmed);if(confirmed.status==='interrupted'){const refreshed=await fetchPlayerProjection();if(refreshed)setPlayer(refreshed);}}
   setOfflineStatus(result.status as OfflineStatus);
  }finally{syncRef.current=false;}
 },[persistOfflineQueue]);
 useEffect(()=>{missionRef.current=mission;},[mission]);
 useEffect(()=>{const timer=window.setTimeout(()=>{try{const restored=restoreOfflineQueue(window.localStorage.getItem(OFFLINE_MISSION_QUEUE_KEY));const stored=persistOfflineQueue(restored);if(restored.length)setOfflineStatus(stored?'pending':'adult-review');}catch{setOfflineStatus('adult-review');}},0);return()=>window.clearTimeout(timer);},[persistOfflineQueue]);
 useEffect(()=>{const online=()=>void syncOffline();window.addEventListener('online',online);return()=>window.removeEventListener('online',online);},[syncOffline]);
 useEffect(()=>{if(!mission||mission.pendingSync||!offlineQueue.length)return;const timer=window.setTimeout(()=>{try{const projected=projectOfflineQueue(mission,offlineQueue) as MissionProjection;missionRef.current=projected;setMission(projected);}catch{setOfflineStatus('adult-review');}},0);return()=>window.clearTimeout(timer);},[mission,offlineQueue]);
 useEffect(()=>{if(mission&&offlineQueue.length&&offlineStatus==='pending'&&navigator.onLine)void syncOffline();},[mission,offlineQueue.length,offlineStatus,syncOffline]);
 useEffect(()=>{let current=true;void loadInitialAccess(fetch,readTrainingResponse).then(result=>{if(!current)return;if(result.kind==='player'){setPlayer(result.player as PlayerProjection);setMission(result.mission as MissionProjection);setProfiles([]);setMode('signed-in');setResumeFirstValue(true);setShowFirstValue(true);}else if(result.kind==='adult'){const adultProfiles=result.profiles as Profile[];setProfiles(adultProfiles);setActive(activeAdultProfileId(adultProfiles));setMode('signed-in');}else{setMode('guest');setProfiles([]);}setError('');}).catch(e=>{if(!current)return;setError(e instanceof Error?e.message:'Cannot load training');setMode('error');});return()=>{current=false;};},[]);
 useEffect(()=>{const sync=()=>{const next=parseTrainingLocation(window.location.search,sessionDrillIds,playerMode?'player':'adult');setTab(next.view);setSelected(next.drill);};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[sessionDrillIds,playerMode]);
 async function act(action:Action){
  if(busyRef.current){
   const current=missionRef.current;
   if(action.type!=='stop'||!playerMode||!profile||!current||!['in-progress','paused','interrupted'].includes(current.status))return false;
   const queued=createOfflineMutation(current,'safety-stop');const optimistic=applyOfflineMutation(current,queued) as MissionProjection;const nextQueue=enqueueOfflineMutation(queueRef.current,queued);const stored=persistOfflineQueue(nextQueue);
   missionRef.current=optimistic;setMission(optimistic);setPlayer(value=>value?{...value,training:{...value.training,safetyStopped:true}}:value);setOfflineStatus(stored?'pending':'adult-review');return true;
  }
  busyRef.current=true;setBusy(true);setError('');
  try{
   if(preview){setSample(applyAction(sample,action,{role:'owner',id:'preview-adult'}));return true;}
   if(!profile)throw new Error('An adult must set up a profile first.');
   if(playerMode){
    if(action.type==='stop'&&(!mission||!['in-progress','paused','interrupted'].includes(mission.status))){const operationKey=['player',profile.id,profile.revision,'stop'].join(':');const projected=await requestPlayerAction({revision:profile.revision,action},operationKey);setPlayer(projected);return true;}
    if(!mission)throw new Error('Your mission could not be loaded. Reload saved progress.');
    const activity=mission.activities[mission.currentActivityIndex];
    let missionAction=action.type;const details:Record<string,unknown>={};
    if(action.type==='set'){
     if(!activity||activity.key!==action.drillId)throw new Error('Return to your current activity.');
     missionAction='record-result';details.activityKey=activity.key;details.completedSets=Number(activity.result?.completedSets||0)+1;details.usedEasierVersion=action.usedEasierVersion===true;if(Number.isInteger(action.answer))details.answer=action.answer;
    }else if(action.type==='stop')missionAction='safety-stop';
    else if(action.drillId)details.activityKey=action.drillId;
    if(action.reason)details.reason=action.reason;
    try{const projected=await requestMissionMutation(mission,missionAction,details);let visible=projected;try{if(queueRef.current.length)visible=projectOfflineQueue(projected,queueRef.current) as MissionProjection;}catch{setOfflineStatus('adult-review');}missionRef.current=visible;setMission(visible);}
    catch(requestError){
     if(!(requestError&&typeof requestError==='object'&&'retryable' in requestError&&requestError.retryable===true))throw requestError;
     const queued=createOfflineMutation(mission,missionAction,details);const nextQueue=enqueueOfflineMutation(queueRef.current,queued);const stored=persistOfflineQueue(nextQueue);
     const optimistic=applyOfflineMutation(mission,queued) as MissionProjection;missionRef.current=optimistic;setMission(optimistic);setOfflineStatus(stored?'pending':'adult-review');
     if(missionAction==='safety-stop')setPlayer(current=>current?{...current,training:{...current.training,safetyStopped:true}}:current);
     return true;
    }
    if(['safety-stop','complete-mission'].includes(missionAction)){const refreshed=await fetchPlayerProjection();if(refreshed)setPlayer(refreshed);}
    return true;
   }
   const result=await request({type:'action',profileId:profile.id,revision:profile.revision,action});
   setProfiles(items=>items.map(p=>p.id===profile.id?{...p,state:result.state,revision:result.revision}:p));return true;
  }catch(e){setError(e instanceof Error?e.message:'Save failed');return false;}finally{busyRef.current=false;setBusy(false);}
 }
 async function goToAdult(){await loadAdult();setPlayer(null);setMission(null);setShowFirstValue(false);navigate('Profile');}
 async function openTodayMission(){
  if(!playerMode||!profile){navigate('Home',session.blocks.find(item=>!isDrillDone(state,session,item))?.id||null);return;}
  if(mission?.status==='unavailable'||mission?.safetyHold){await goToAdult();return;}
  setBusy(true);setError('');
  try{
   let current=mission;
   if(current?.status==='not-started'){current=await startPlayerMission(`today-start:${profile.id}:${current.missionId}`);missionRef.current=current;setMission(current);}
   else if(current&&['paused','interrupted'].includes(current.status)){if(!await act({type:'resume'}))return;current=missionRef.current;}
   const next=current?.activities[current.currentActivityIndex]?.key;if(next)navigate('Today',next);
  }catch(reason){setError(reason instanceof Error?reason.message:'Your mission could not be started. Try again.');}
  finally{setBusy(false);}
 }
 function celebrate(name:string){setCelebration(name);toast.success('SAVE MADE!',{description:name+' complete. That is one more skill rep in the bank.',duration:3500});}
 useEffect(()=>{if(!celebration)return;const timer=setTimeout(()=>setCelebration(''),2800);return()=>clearTimeout(timer);},[celebration]);
 if(adultProfile?.role==='owner'&&adultProfile.setupStatus==='legacy-review-required')return <main className="tf-app tf-access-app"><header className="tf-header tf-access-header"><Brand/><span className="tf-office">At home · Off ice</span></header><section className="tf-access-main"><p className="tf-kicker">SETUP REVIEW</p><h1>Keep the progress. Complete the missing setup.</h1><p>Your saved sessions and coach access stay attached to the same goalie profile.</p><OnboardingFlow initialStep="parent-permission" legacyProfile={adultProfile} signOutLink={signOutLink} onHandoff={async()=>{const projected=await loadPlayer();if(projected){setResumeFirstValue(false);setShowFirstValue(true);}}}/></section><footer className="tf-footer">Tendie Forge · At-home, off-ice development · Adult managed</footer></main>;
 if(!enabled)return <AccessShell mode={mode} error={error} signInLink={signInLink} signOutLink={signOutLink} onPreview={()=>setPreview(true)} onReload={()=>void loadAdult()} onCreated={async()=>{const projected=await loadPlayer();if(projected){setResumeFirstValue(false);setShowFirstValue(true);}}}/>;
 if(player&&showFirstValue)return <main className="tf-app tf-access-app"><header className="tf-header tf-access-header"><Brand/><span className="tf-office">At home · Off ice</span></header><section className="tf-access-main"><PlayerFirstValueFlow player={player} resume={resumeFirstValue} onStartMission={async(operationKey,alreadyStarted)=>{const currentMission=alreadyStarted?await fetchMissionProjection():await startPlayerMission(operationKey);setMission(currentMission);setShowFirstValue(false);const next=currentMission.activities[currentMission.currentActivityIndex]?.key;navigate('Today',next||null);}} onStop={()=>act({type:'stop'})} onParent={async()=>{await loadAdult();setPlayer(null);setMission(null);setShowFirstValue(false);}}/></section><footer className="tf-footer">Tendie Forge · At-home, off-ice development · Adult managed</footer></main>;
 return <main className="tf-app">
  <a className="tf-skip" href="#training-main">Skip to training</a>
  <header className="tf-header"><Brand onHome={()=>navigate(playerMode?'Today':'Home')}/><div className="tf-header-end"><span className="tf-office">At home · Off ice</span>{profile&&!playerMode&&<span className="tf-adult-label">{coach?'Coach view':'Adult managed'}</span>}<button className="tf-avatar" onClick={()=>navigate('Profile')} aria-label={playerMode?'Open goalie profile':coach?'Open coach workspace':'Open profile and adult tools'}>{profile?.nickname?.slice(0,1)||'G'}</button></div></header>
  <div className="tf-frame"><nav className="tf-nav" aria-label="Main navigation">{playerMode?PLAYER_NAV.map(([name,Icon])=><button key={name} aria-current={tab===name?'page':undefined} className={tab===name?'active':''} onClick={()=>navigate(name)}><Icon size={21}/><span>{name}</span></button>):NAV.map(([name,Icon])=><button key={name} aria-current={tab===name?'page':undefined} className={tab===name?'active':''} onClick={()=>navigate(name)}><Icon size={21}/><span>{name}</span></button>)}</nav>
  <section id="training-main" className="tf-main">
   {preview&&<div className="tf-notice">Preview mode • changes are not saved. <button onClick={()=>{setPreview(false);setSample(newTrainingState());}}>Exit preview</button></div>}
   {playerMode&&offlineStatus&&<OfflineMissionStatus status={offlineStatus} count={offlineQueue.filter(item=>item.profileContextId===mission?.profileContextId).length} onSync={()=>void syncOffline()} onAdult={()=>navigate('Profile')}/>}
   {error&&<div role="alert" className="tf-error">{error} <button onClick={()=>void load()}>Reload saved progress</button></div>}
   {(tab==='Home'||tab==='Today')&&<>
    <div className="tf-heading"><div><p className="tf-kicker">{profile?.nickname||'GOALIE'} · {path.name}</p><h1>{sessionDone?'That is a session earned.':'Your next save starts here.'}</h1></div><span className="tf-level">Path {path.level}</span></div>
    {state.safetyStopped?<div className="tf-error"><AlertTriangle/><h2>Training is paused.</h2><p>Tell a parent or guardian what happened. Rest does not erase your progress.</p><button className="tf-secondary" onClick={()=>void goToAdult()}>Adult review</button></div>:mission?.safetyHold?<MissionSafetyHold message={mission.safetyHold.message} replacement={mission.safetyHold.replacement} onAdult={()=>void goToAdult()}/>:mission?.status==='unavailable'?<MissionUnavailableState message={mission.unavailable?.message||'An adult needs to review your training plan.'} onAdult={()=>void goToAdult()}/>:missionAbandoned?<div className="tf-error"><AlertTriangle/><h2>This mission was ended.</h2><p>Your saved work remains in history. Return to an adult before starting another mission.</p><button className="tf-secondary" onClick={()=>void goToAdult()}>Return to adult</button></div>:<section className="tf-today"><div className="tf-today-top"><p className="tf-kicker">WEEK {state.week+1} · SESSION {state.day+1}</p><span><Clock size={16}/>{session.minutes} min planned</span></div><h2>{session.title}</h2><p className="tf-session-intro">{sessionDone?'Put the equipment away. Recovery is part of getting better.':`${session.blocks.length-completed} of ${session.blocks.length} activities left. One clear task at a time.`}</p><Progress value={completed/session.blocks.length*100} aria-label="Activities complete"/>
     <div className="tf-start-row">{!sessionDone?<button disabled={busy||coach} className="tf-primary" onClick={()=>void openTodayMission()}><Play size={19} fill="currentColor"/>{todayAction.label}</button>:playerMode?<button className="tf-primary" onClick={()=>navigate('Progress')}>View saved progress <ArrowRight size={18}/></button>:<button className="tf-primary" disabled={busy||coach} onClick={()=>void act({type:'next'})}>{state.week===19&&state.day===path.days-1?'Start another practice cycle':'View next planned session'} <ArrowRight size={18}/></button>}<span>{session.blocks.length} activities · {session.minutes} minutes</span></div>
    </section>}
    {!state.safetyStopped&&!mission?.safetyHold&&mission?.status!=='unavailable'&&<><section className="tf-day-list" aria-label="Today’s activities">{session.blocks.map((d,i)=>{const execution=playerMode?mission?.activities.find(item=>item.key===d.id):null;const done=playerMode?['completed','skipped'].includes(execution?.status||''):isDrillDone(state,session,d);const locked=Boolean(missionAbandoned||playerMode&&(!execution||execution.ordinal>(mission?.currentActivityIndex??0))&&!done);return <button key={d.id} disabled={locked} onClick={()=>navigate(playerMode?'Today':'Home',d.id)} className="tf-drill-row"><span className={done?'tf-number done':'tf-number'}>{done?<Check size={19}/>:i+1}</span><span><strong>{d.name}</strong><small>{missionAbandoned?'Mission ended—return to an adult':locked?'Start the mission or finish the activity above first':`${d.sets} ${d.sets===1?'set':'sets'} · ${d.target} · ${d.minutes} min`}</small></span><ChevronRight size={19}/></button>;})}</section>
    {completed===session.blocks.length&&!sessionDone&&!missionAbandoned&&<button className="tf-primary" disabled={busy} onClick={async()=>{if(await act({type:playerMode?'complete-mission':'finish'}))celebrate('Full training session');}}><Trophy size={19}/>{playerMode?'Finish mission':'Finish and earn your session badge'}</button>}
    {playerMode?<section className="tf-reward"><span className="tf-reward-icon"><Check size={32}/></span><div><p className="tf-kicker">PROGRESS SAVES AS YOU GO</p><h3>{sessionDone?'Mission complete':'Finish every activity with control'}</h3><p>{sessionDone?(mission?.pendingSync?'Mission complete on this device. Connect to confirm it with your adult account.':'Your completed mission is saved. XP and progression are calculated by the next verified system.'):(mission?.pendingSync?'Recent progress is stored on this device until it reconnects.':'Reloading or leaving will not erase confirmed sets.')}</p></div></section>:<section className="tf-reward"><span className="tf-reward-icon"><Trophy size={32}/></span><div><p className="tf-kicker">{state.sessions.length?'EARNED THROUGH TRAINING':'YOUR FIRST REWARD'}</p><h3>{state.sessions.length?`${state.sessions.length} session badges earned`:'The First Save badge'}</h3><p>{state.sessions.length?'Every badge marks a completed session—not time spent in the app.':'Complete every activity and finish the session to earn it.'}</p></div></section>}
    <p className="tf-fine">Planned time includes setup, demonstration, breaks, and reflection. Do not add repetitions to fill time. Other sports count toward your total workload.</p></>}
   </>}
   {(tab==='Train'||tab==='Journey')&&<><div className="tf-heading"><div><p className="tf-kicker">20 WEEKS · OFF-ICE ONLY</p><h1>Your development path</h1></div></div><section className="tf-path-intro"><h2>{path.name}</h2><p>{path.description}</p><strong>{path.days} days × {path.minutes} minutes each week</strong><p>Keep this commitment throughout the path. Advancing requires skill checks—not finishing weeks. Take rest days between demanding sessions.</p></section><div className="tf-weeks">{WEEKS.map((w,i)=><article key={w.number} className={i===state.week?'current':''}><span className="tf-number">{w.number}</span><div><h3>{w.name}</h3><p>{w.skills.map(id=>SKILLS.find(s=>s.id===id)?.name).join(' · ')}</p></div><span>{i===state.week?'Current':i<state.week?'Covered':'Coming up'}</span></article>)}</div></>}
   {tab==='Progress'&&<><p className="tf-kicker">YOUR WORK. YOUR PROGRESS.</p><h1>Built, not guessed.</h1><section className="tf-progress-summary"><div><strong>{state.sessions.length}</strong><span>Sessions finished</span></div><div><strong>{completed}/{session.blocks.length}</strong><span>Today’s drills</span></div><div><strong>{new Set(skillChecks.filter(c=>c.pathId===state.pathId&&c.passed&&c.skillId).map(c=>c.skillId)).size}/30</strong><span>Skills accomplished</span></div></section><h2>Earn the next path</h2><p>Show all 30 skills with control. Each development group must also be observed on two different days. A parent or coach records exactly what they saw.</p><div className="tf-skills">{GROUPS.map(group=>{const skills=SKILLS.filter(s=>s.group===group);const achieved=new Set(skillChecks.filter(c=>c.group===group&&c.pathId===state.pathId&&c.passed).map(c=>c.skillId));const days=new Set(skillChecks.filter(c=>c.group===group&&c.pathId===state.pathId&&c.passed).map(c=>c.date.slice(0,10))).size;return <article key={group}><div><h3>{group}</h3><span>{achieved.size}/{skills.length} skills</span></div><Progress value={achieved.size/skills.length*100} aria-label={`${group} skill accomplishments`}/><p>{Math.min(days,2)}/2 observed days · {RUBRICS[group]}</p></article>;})}</div><h2>Session history</h2>{state.sessions.length?state.sessions.slice().reverse().map((s:{id:string;date:string;week:number;day:number})=><div key={s.id} className="tf-history"><Check size={18}/><span>Week {s.week+1}, session {s.day+1}</span><time>{new Date(s.date).toLocaleDateString()}</time></div>):<p>Your first completed session will appear here. There are no sample scores.</p>}</>}
   {tab==='Profile'&&(playerMode?<PlayerProfilePanel profile={profile} state={state} onParent={async()=>{await loadAdult();setPlayer(null);setShowFirstValue(false);}}/>:<ProfilePanel key={preview?'preview':profile?.id} profile={profile} preview={preview} profiles={profiles} active={active} onSwitch={async id=>{const chosen=profiles.find(item=>item.id===id);if(chosen?.role!=='owner'){setActive(id);return;}const key=contextSwitchOperationKey(contextKeysRef.current,id);try{await setPlayerContext(id,key);completeContextSwitch(contextKeysRef.current,id);setActive(id);setError('');}catch(error){setError(error instanceof Error?error.message:'Goalie was not changed. Try again.');}}} onChildHandoff={async()=>{const projected=await loadPlayer();if(projected){setResumeFirstValue(false);setShowFirstValue(true);}}} state={state} busy={busy} act={act} reload={loadAdult} onError={setError} signOutLink={signOutLink}/>)}
  </section></div>
  <footer className="tf-footer">SCS Saints Goalie Forge · At-home, off-ice development · Adult managed</footer>
  <Dialog open={Boolean(drill)} onOpenChange={open=>{if(!open)navigate(tab,null,true);}}><DialogContent ref={dialogRef} tabIndex={-1} onOpenAutoFocus={e=>{e.preventDefault();dialogRef.current?.focus();}} className="tf-dialog">{drill&&<DrillDetail key={`${session.id}:${drill.id}`} drill={drill} state={state} session={session} mission={playerMode?mission:null} busy={busy} readOnly={coach} act={act} saveError={error} onReload={()=>void load()} onExit={()=>navigate(tab,null,true)} onDone={()=>{celebrate(drill.name);navigate(tab,null,true);}}/>}</DialogContent></Dialog>
  <Toaster theme="light" position="top-center" richColors/>
  {celebration&&<div className="tf-celebration" aria-hidden="true"><Shield size={40}/><strong>SAVE MADE</strong><span>{celebration}</span></div>}
 </main>;
}
export function OfflineMissionStatus({status,count,onSync,onAdult}:{status:string;count:number;onSync:()=>void;onAdult:()=>void}){
 const copy=status==='syncing'?'Confirming saved progress…':status==='synced'?'Saved progress is confirmed.':status==='other-profile'?'Some saved progress belongs to another goalie. Switch back to that goalie to sync it.':status==='adult-review'?'This device kept the progress, but an adult must review it before syncing.':'Saved on this device. We’ll sync when connected.';
 return <div className="tf-notice tf-offline-status" role="status"><span>{copy}{count>0?` ${count} ${count===1?'action':'actions'} waiting.`:''}</span><span>{['pending','adult-review'].includes(status)&&<button type="button" onClick={onSync}>Sync now</button>}{['other-profile','adult-review'].includes(status)&&<button type="button" onClick={onAdult}>Adult review</button>}</span></div>;
}
export function TrainingSaveError({message,onReload}:{message:string;onReload:()=>void}){return message?<div className="tf-error" role="alert"><p>{message}</p><button className="tf-secondary" onClick={onReload}>Reload saved progress</button><p className="tf-fine">The last action is not confirmed. If something hurts, stop and tell an adult regardless of save status.</p></div>:null;}
export function DrillDetail({drill,state,session,mission,busy,readOnly,act,onDone,onExit,saveError,onReload}:{drill:Drill;state:TrainingState;session:ReturnType<typeof buildSession>|MissionSnapshot;mission:MissionProjection|null;busy:boolean;readOnly:boolean;act:(a:Action)=>Promise<boolean>;onDone:()=>void;onExit:()=>void;saveError:string;onReload:()=>void}){
 const execution=mission?.activities.find(item=>item.key===drill.id);const authoritative=Boolean(mission&&execution);
 const savedAnswer=authoritative?execution?.result?.answer:undefined;const legacyAnswer=state.answers[session.id] as {choice:number;correct:boolean}|undefined;
 const [now,setNow]=useState(Date.now);const [easy,setEasy]=useState(execution?.result?.usedEasierVersion===true);const [readingAnswer,setReadingAnswer]=useState<number|undefined>(savedAnswer??legacyAnswer?.choice);const [restDeadline,setRestDeadline]=useState(()=>Date.now()+(execution?.restRemainingSeconds||0)*1000);const [started,setStarted]=useState(false);
 const legacyRest=(state as TrainingState&{rests?:Record<string,{until:number;remaining:number}>}).rests?.[`${session.id}:${drill.id}`];
 const seconds=authoritative&&execution?.status==='resting'?Math.max(0,Math.ceil((restDeadline-now)/1000)):legacyRest?legacyRest.remaining||Math.max(0,Math.ceil((legacyRest.until-now)/1000)):0;
 const running=Boolean(legacyRest&&!legacyRest.remaining&&seconds>0);const done=authoritative?['completed','skipped'].includes(execution?.status||''):isDrillDone(state,session,drill);
 const setsDone=authoritative?Number(execution?.result?.completedSets||0):Array.from({length:drill.sets},(_,i)=>state.sets[`${session.id}:${drill.id}:${i}`]).filter(Boolean).length;
 const question=mission?.executionSnapshot?.reading||WEEKS[session.week];const answer=authoritative&&execution?.result&&typeof execution.result.answer==='number'?{choice:execution.result.answer,correct:execution.result.correct===true}:legacyAnswer;
 const locked=readOnly||(authoritative&&execution?.ordinal!==mission?.currentActivityIndex&&!done);const control=authoritative&&mission&&execution?resolveMissionActivityControl({...mission,currentActivityIndex:execution.ordinal}):null;
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(t);},[]);
 async function finishSet(){if(await act({type:'set',drillId:drill.id,setIndex:setsDone,answer:readingAnswer,usedEasierVersion:easy}))setNow(Date.now());}
 async function handleControl(){
  if(!control)return;
  if(control.action==='start-activity')await act({type:'start-activity',drillId:drill.id});
  else if(control.action==='record-result')await finishSet();
  else if(control.action==='start-rest'){if(await act({type:'start-rest',drillId:drill.id}))setRestDeadline(Date.now()+drill.restSeconds*1000);}
  else if(control.action==='end-rest'&&seconds===0)await act({type:'end-rest',drillId:drill.id});
  else if(control.action==='complete-activity'&&await act({type:'complete-activity',drillId:drill.id}))onDone();
  else if(control.action==='resume')await act({type:'resume'});
 }
 return <><DialogHeader><p className="tf-kicker">{drill.group} · OFF ICE ONLY</p><DialogTitle>{drill.name}</DialogTitle><DialogDescription>{drill.cue}</DialogDescription></DialogHeader>
  <div className="tf-dose"><div><strong>{drill.sets} {drill.sets===1?'set':'sets'}</strong><span>{drill.target}</span></div><div><strong>{drill.restSeconds}s</strong><span>rest between sets</span></div><div><strong>{drill.minutes} min</strong><span>planned block</span></div></div>
  {drill.id==='read'?<section className="tf-question"><h3>{question.question}</h3><div>{question.options.map((option,i)=><button key={option} disabled={busy||locked||state.safetyStopped||Boolean(answer)} className={(readingAnswer??answer?.choice)===i?'selected':''} onClick={()=>authoritative?setReadingAnswer(i):void act({type:'answer',answer:i})}>{String.fromCharCode(65+i)}. {option}</button>)}</div>{answer?<p role="status"><strong>{answer.correct?'Good read.':'Try this way of thinking: '}</strong> {question.explanation}</p>:readingAnswer!==undefined&&<p role="status">Answer selected. Finish the activity to check it.</p>}</section>:<DrillMap kind={drill.diagram} name={drill.name}/>}
  <section className="tf-equipment"><div><strong>You need</strong><p>{drill.equipment}</p></div><div><strong>Your space</strong><p>{drill.space}</p></div></section>
  {drill.substitution&&<MissionSubstitutionNotice substitution={drill.substitution}/>}
  <h3>Set up</h3><p>{drill.setup}</p><h3>Do this</h3><ol className="tf-steps">{drill.steps.map((step:string)=><li key={step}>{step}</li>)}</ol>
  <button className="tf-link" onClick={()=>setEasy(!easy)} aria-expanded={easy}>{easy?'Hide easier version':'Need an easier version?'}</button>{easy&&<p className="tf-easier">{drill.easier}</p>}
  <p className="tf-safety"><AlertTriangle size={18}/>{drill.safety}</p>
  <div className="tf-drill-controls"><div className="tf-set-dots" aria-label={`${setsDone} of ${drill.sets} sets completed`}>{Array.from({length:drill.sets},(_,i)=><span className={i<setsDone?'done':''} key={i}>{i<setsDone?<Check size={16}/>:i+1}</span>)}</div>
   <TrainingSaveError message={saveError} onReload={onReload}/>
   {done?<p><Check/> {execution?.status==='skipped'?'Activity safely substituted.':'Activity complete.'}</p>:state.safetyStopped?<p role="alert">Training paused. Ask an adult to check in.</p>:authoritative?<>{execution?.status==='resting'?<div className="tf-rest"><strong role="timer">{seconds>0?`Rest ${seconds}s`:'Rest complete'}</strong><button disabled={busy||locked||seconds>0} className="tf-primary" onClick={()=>void handleControl()}><Play size={16}/>Continue</button></div>:<button className="tf-primary" disabled={busy||locked||(control?.action==='record-result'&&drill.id==='read'&&readingAnswer===undefined)} onClick={()=>void handleControl()}>{control?.action==='start-activity'?<Play size={18}/>:<Check size={18}/>} {busy?'Saving…':control?.label}</button>}{mission?.status==='in-progress'&&<div className="tf-training-exits"><button className="tf-secondary" disabled={busy||locked} onClick={async()=>{if(await act({type:'pause'}))onExit();}}><Pause size={16}/>Pause and exit</button><button className="tf-link" disabled={busy||locked} onClick={async()=>{if(await act({type:'skip-activity',drillId:drill.id,reason:'safe-substitution'}))onExit();}}>Use a safe substitution</button></div>}</>:seconds>0?<div className="tf-rest"><strong role="timer">Rest {seconds}s</strong><button disabled={busy||readOnly} className="tf-secondary" onClick={()=>void act({type:running?'pause-rest':'resume-rest',drillId:drill.id})}>{running?<Pause size={16}/>:<Play size={16}/>} {running?'Pause':'Resume'}</button></div>:!started?<button className="tf-primary" onClick={()=>setStarted(true)} disabled={readOnly}><Play size={18}/>I understand—start this drill</button>:<button className="tf-primary" disabled={busy||readOnly||(drill.id==='read'&&!legacyAnswer)} onClick={()=>void finishSet()}><Check size={18}/>{busy?'Saving…':`I finished set ${setsDone+1}`}</button>}
   {!done&&<button className="tf-link tf-stop" disabled={locked} onClick={async()=>{if(await act({type:'stop'}))onExit();}}>Something hurts / stop training</button>}
   <p className="tf-fine">Complete the listed work with control. You can rest longer. Never rush to finish a timer.</p>
 </div></>;
}
function EmptyAccount({onCreated,signOutLink,onboardingDraft}:{onCreated:(id:string)=>Promise<void>;signOutLink:ReactNode;onboardingDraft?:unknown|null}) {
 const [coach,setCoach]=useState(false);
 if(coach)return <section className="tf-access-choice"><h2>No goalies are shared with you yet</h2><p>Ask a parent or guardian to add the email used for this adult account. The Site owner must also give you access to this private Site.</p><div className="tf-actions"><button className="tf-secondary" onClick={()=>setCoach(false)}>Back</button>{signOutLink}</div></section>;
 return <OnboardingFlow initialDraft={onboardingDraft} signOutLink={signOutLink} onCoach={()=>setCoach(true)} onHandoff={onCreated}/>;
}
function PlayerProfilePanel({profile,state,onParent}:{profile:Profile|undefined;state:TrainingState;onParent:()=>Promise<void>}){
 return <><p className="tf-kicker">MY GOALIE PROFILE</p><h1>{profile?.nickname||'Goalie'}</h1><p>{profile?.ageBand} · {PATHS.find(path=>path.id===state.pathId)?.name}</p><section className="tf-profile-card"><Shield/><h2>Private by default</h2><p>Your progress belongs to you and your family. Tendie Forge has no public rankings, direct messages, or public profile.</p></section><button className="tf-secondary" onClick={()=>void onParent()}><Lock size={17}/>Parent area</button></>;
}
function ProfilePanel({profile,preview,profiles,active,onSwitch,onChildHandoff,state,busy,act,reload,onError,signOutLink}:{profile:Profile|undefined;preview:boolean;profiles:Profile[];active:string;onSwitch:(s:string)=>Promise<void>|void;onChildHandoff:()=>Promise<void>;state:TrainingState;busy:boolean;act:(a:Action)=>Promise<boolean>;reload:()=>Promise<void>;onError:(s:string)=>void;signOutLink:ReactNode}) {
 const [showAdult,setShowAdult]=useState(profile?.role==='coach');const [adding,setAdding]=useState(false);const [confirm,setConfirm]=useState(false);const [email,setEmail]=useState('');const [skillId,setSkillId]=useState(1);const [note,setNote]=useState('');const [pending,setPending]=useState(false);
 const skill=SKILLS.find(item=>item.id===skillId)||SKILLS[0];
 async function admin(type:string,extra:Record<string,unknown>={}){if(preview){toast.info('Preview only—no real account changes.');return;}if(!profile)return;setPending(true);try{await request({type,profileId:profile.id,...extra});await reload();toast.success('Saved');}catch(e){onError(e instanceof Error?e.message:'Unable to save');}finally{setPending(false);}}
 return <><p className="tf-kicker">YOUR GOALIE PROFILE</p><h1>{profile?.nickname||'Preview goalie'}</h1><p>{profile?.team||'SCS Saints'} · {profile?.ageBand||'10–15'} · {PATHS.find(p=>p.id===state.pathId)?.name}</p><section className="tf-profile-card"><Shield/><h2>Private by default</h2><p>No public rankings, direct messages, or photos. Your progress is about your own practice.</p></section>
  {profile?.role==='owner'&&!profile.spaces?.includes('small-indoor')&&<section className="tf-error"><h2>Confirm the training space</h2><p>Before a mission can be assigned, confirm a dry, non-slip indoor area with room to move and no breakable objects nearby.</p><button className="tf-secondary" disabled={pending} onClick={async()=>{setPending(true);try{await confirmProfileTrainingSpace(profile);await reload();toast.success('Training space confirmed');}catch(reason){onError(reason instanceof Error?reason.message:'Training space was not confirmed.');}finally{setPending(false);}}}>{pending?'SAVING…':'Confirm clear indoor area'}</button></section>}
  {profiles.length>1&&<label className="tf-field">Training profile<select value={active||profiles[0]?.id} onChange={e=>void onSwitch(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.nickname} · {p.team}{p.role==='coach'?' (coach view)':''}</option>)}</select></label>}
  <button className="tf-secondary" onClick={()=>setShowAdult(!showAdult)} aria-expanded={showAdult}><Lock size={17}/>{showAdult?'Close adult tools':profile?.role==='coach'?'Open coach workspace':'Open parent & coach tools'}</button>
  {showAdult&&<section className="tf-adult"><h2>{profile?.role==='coach'?'Coach observations':'Parent / guardian controls'}</h2><p>This signed-in adult account owns this workspace. Player view simplifies the screen; it is not a separate child login or a security lock.</p>
   {state.safetyStopped&&profile?.role!=='coach'&&<section className="tf-error"><h3>Safety check needed</h3><p>Check in with your player before any physical activity resumes. Clearing this flag does not provide medical clearance.</p><button disabled={busy} className="tf-secondary" onClick={()=>void act({type:'clear-safety'})}>I checked in—clear the pause</button></section>}
   <h3>Record an observed accomplishment</h3><p>Choose the exact skill and record what happened. All 30 skills must be accomplished, with observations across at least two days in each development group.</p><label className="tf-field">Skill<select value={skillId} onChange={e=>setSkillId(Number(e.target.value))}>{GROUPS.map(group=><optgroup label={group} key={group}>{SKILLS.filter(item=>item.group===group).map(item=><option key={item.id} value={item.id}>{item.id}. {item.name}</option>)}</optgroup>)}</select></label><p className="tf-rubric"><strong>{skill.group} benchmark:</strong> {skill.benchmarks[state.pathId as keyof typeof skill.benchmarks]}</p><label className="tf-field">What did you observe?<textarea value={note} onChange={e=>setNote(e.target.value)} minLength={8} maxLength={600} placeholder="Example: 5 of 6 steps ended balanced and held for 2 seconds."/></label><div className="tf-actions"><button className="tf-primary" disabled={busy||note.trim().length<8} onClick={async()=>{if(await act({type:'check',skillId,note,passed:true})){setNote('');toast.success('Skill accomplishment saved');}}}>Record achieved</button><button className="tf-secondary" disabled={busy||note.trim().length<8} onClick={async()=>{if(await act({type:'check',skillId,note,passed:false})){setNote('');toast.success('Practice note saved');}}}>Keep practicing</button></div>
   <CoachEvaluation state={state} busy={busy} act={act}/>
   {profile?.role!=='coach'&&<><h3>Next path</h3><p>The next path increases the weekly commitment. Check the player’s full sport schedule and recovery before changing paths.</p><button className="tf-primary" disabled={busy||!canAdvance(state)||state.pathId==='performance'} onClick={()=>void act({type:'advance'})}>Confirm readiness and advance</button>
   <h3>Coach access</h3><p>Two permissions are required: add the coach here, then give the same adult account access to this private Site. This form does not send an invitation. Coaches can review training and add evidence; they cannot complete drills, advance paths, or delete profiles.</p><label className="tf-field">Coach’s adult account email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="coach@example.com"/></label><button className="tf-secondary" disabled={pending||!email} onClick={()=>void admin('share',{email})}>Add coach to this profile</button>{profile?.grants.map(g=><div className="tf-history" key={g}><span>{g} · profile access added</span><button disabled={pending} onClick={()=>void admin('revoke',{email:g})}>Remove access</button></div>)}
   <h3>Household</h3><button className="tf-secondary" onClick={()=>setAdding(!adding)}>Add another player</button>{adding&&<OnboardingFlow initialStep="parent-permission" signOutLink={signOutLink} onHandoff={async()=>{setAdding(false);await onChildHandoff();}}/>}
   <h3>Your data</h3><div className="tf-actions"><button className="tf-secondary" disabled={preview||pending} onClick={async()=>{try{const data=await request({type:'export',profileId:profile?.id});const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='goalie-forge-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){onError(e instanceof Error?e.message:'Export failed');}}}>Download progress</button><button className="tf-link tf-stop" onClick={()=>setConfirm(true)}>Delete player profile</button></div>
   {confirm&&<div className="tf-error"><p>Delete this profile, progress, and coach links permanently? This cannot be undone.</p><button disabled={pending} className="tf-secondary" onClick={()=>setConfirm(false)}>Keep profile</button><button disabled={pending} className="tf-danger" onClick={()=>void admin('delete')}>Permanently delete</button></div>}
   {signOutLink}</>}
  </section>}
 </>;
}
function CoachEvaluation({state,busy,act}:{state:TrainingState;busy:boolean;act:(a:Action)=>Promise<boolean>}) {
 const [ratings,setRatings]=useState(()=>EVALUATION_SECTIONS.map(()=>0));const [cause,setCause]=useState('none');const [note,setNote]=useState('');
 const records=(state as TrainingState&{evaluations?:Array<{date:string;ratings:number[];cause:string;note:string}>}).evaluations||[];
 return <section className="tf-evaluation"><h3>Repeatable 45–60 minute coach evaluation</h3><p>Run the same ten off-ice sections and score only what you watch: 0 not observed, 1 needs support, 2 sometimes controlled, 3 consistently controlled. Planned tasks total about 50 minutes including short transitions.</p>
 <form className="tf-form" onSubmit={async e=>{e.preventDefault();if(await act({type:'evaluate',ratings,cause,note})){setNote('');toast.success('Coach review saved');}}}>
 <div className="tf-evaluation-list">{EVALUATION_SECTIONS.map((section,i)=><article className="tf-evaluation-item" key={section.id}><h4>{i+1}. {section.name}</h4><p>{section.task}</p><ul>{section.watchFor.map(item=><li key={item}>{item}</li>)}</ul><label>Observed control<select value={ratings[i]} onChange={e=>setRatings(values=>values.map((v,n)=>n===i?Number(e.target.value):v))}><option value={0}>Not observed</option><option value={1}>Needs support</option><option value={2}>Sometimes controlled</option><option value={3}>Consistently controlled</option></select></label></article>)}</div>
 <label>Main cause of a missed task<select value={cause} onChange={e=>setCause(e.target.value)}>{['none','positioning','tracking','movement','save selection','execution','decision-making'].map(c=><option key={c} value={c}>{c==='none'?'No missed task / not observed':c}</option>)}</select></label>
 <label>Evidence and one next step<textarea required minLength={8} maxLength={600} value={note} onChange={e=>setNote(e.target.value)} placeholder="8 of 10 catches tracked to the hands. Next: keep eyes on the last two catches."/></label><p className="tf-fine">Save selection is assessed through seated reading tasks only. These observations do not measure on-ice proficiency or automatically unlock a path.</p><button className="tf-secondary" disabled={busy||note.trim().length<8}>Save coach review</button></form>
 {records.slice(-3).reverse().map((r,i)=><article className="tf-history" key={r.date+String(i)}><div><strong>{new Date(r.date).toLocaleDateString()} · {r.cause==='none'?'Observation':r.cause}</strong><p>{r.note}</p><small>{r.ratings.map((v,n)=>(EVALUATION_SECTIONS[n]?.name||`Legacy section ${n+1}`)+': '+v).join(' · ')}</small></div></article>)}
 </section>;
}
