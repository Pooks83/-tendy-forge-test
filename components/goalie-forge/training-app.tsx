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
import {DrillMap} from './drill-map';
import {OnboardingFlow} from '@/components/tendie-forge/onboarding-flow';
import {PlayerFirstValueFlow} from '@/components/tendie-forge/player-first-value';
type TrainingState=ReturnType<typeof newTrainingState>;
type Profile={id:string;nickname:string;team:string;ageBand:string;role:'owner'|'coach'|'player';active?:boolean;revision:number;state:TrainingState;grants:string[];catches?:string|null;experience?:string|null;equipment?:string[];plannedDays?:string[];missionMinutes?:number|null;setupStatus?:string};
type PlayerProjection={profile:{id:string;nickname:string;ageBand:string;catches:string;experience:string;equipment:string[];plannedDays:string[];missionMinutes:number;setupStatus:string;revision:number};training:TrainingState};
type Action={type:string;drillId?:string;setIndex?:number;answer?:number;skillId?:number;passed?:boolean;note?:string;ratings?:number[];cause?:string};
type Drill=ReturnType<typeof buildSession>['blocks'][number];
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
export function TrainingApp({signInLink,signOutLink}:{signInLink:ReactNode;signOutLink:ReactNode}){
 const [tab,setTab]=useState('Home');const [profiles,setProfiles]=useState<Profile[]>([]);const [active,setActive]=useState('');
 const [player,setPlayer]=useState<PlayerProjection|null>(null);const [showFirstValue,setShowFirstValue]=useState(false);const [resumeFirstValue,setResumeFirstValue]=useState(false);
 const [mode,setMode]=useState<'loading'|'signed-in'|'guest'|'error'>('loading');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState(false);const [sample,setSample]=useState(newTrainingState);const [selected,setSelected]=useState<string|null>(null);
 const [celebration,setCelebration]=useState('');const busyRef=useRef(false);const dialogRef=useRef<HTMLDivElement>(null);const contextKeysRef=useRef(new Map<string,string>());
 const adultProfile=profiles.find(p=>p.id===active)||profiles[0];
 const profile:Profile|undefined=player?{...player.profile,team:'',role:'player',state:player.training,grants:[]}:adultProfile;
 const state=preview?sample:player?buildPlayerViewState(player.training,newTrainingState()) as TrainingState:adultProfile?.state||newTrainingState();
 const path=PATHS.find(p=>p.id===state.pathId)!;const session=useMemo(()=>buildSession(state.pathId,state.week,state.day,state.cycle||0),[state.pathId,state.week,state.day,state.cycle]);
 const sessionDrillIds=useMemo(()=>session.blocks.map(item=>item.id),[session]);
 const completed=session.blocks.filter(d=>isDrillDone(state,session,d)).length;
 const sessionDone=state.sessions.some((s:{id:string})=>s.id===session.id);
 const playerMode=Boolean(player);const enabled=preview||Boolean(profile);const drillId=resolveTrainingDrill(enabled&&!showFirstValue,selected,sessionDrillIds);
 const drill=session.blocks.find(d=>d.id===drillId);const coach=profile?.role==='coach'&&!preview;
 const skillChecks=state.checks as Array<{group:string;pathId:string;passed:boolean;date:string;skillId?:number}>;
 const navigate=useCallback((view:string,drillId:string|null=null,replace=false)=>{setTab(view);setSelected(drillId);if(typeof window!=='undefined'){const url=trainingLocation({view,drill:drillId});window.history[replace?'replaceState':'pushState']({},'',url);}},[]);
 const loadAdult=useCallback(async()=>{
  try{const result=await fetchTrainingProfiles();setProfiles(result.profiles);setActive(activeAdultProfileId(result.profiles));setMode(result.mode);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Cannot load training');setMode('error');}
 },[]);
 const loadPlayer=useCallback(async()=>{try{const result=await fetchPlayerProjection();if(result){setPlayer(result);setProfiles([]);setMode('signed-in');setError('');}return result;}catch(e){setError(e instanceof Error?e.message:'Cannot load your goalie');return null;}},[]);
 const load=useCallback(async()=>{if(player)await loadPlayer();else await loadAdult();},[player,loadPlayer,loadAdult]);
 useEffect(()=>{let current=true;void loadInitialAccess(fetch,readTrainingResponse).then(result=>{if(!current)return;if(result.kind==='player'){setPlayer(result.player as PlayerProjection);setProfiles([]);setMode('signed-in');setResumeFirstValue(true);setShowFirstValue(true);}else if(result.kind==='adult'){const adultProfiles=result.profiles as Profile[];setProfiles(adultProfiles);setActive(activeAdultProfileId(adultProfiles));setMode('signed-in');}else{setMode('guest');setProfiles([]);}setError('');}).catch(e=>{if(!current)return;setError(e instanceof Error?e.message:'Cannot load training');setMode('error');});return()=>{current=false;};},[]);
 useEffect(()=>{const sync=()=>{const next=parseTrainingLocation(window.location.search,sessionDrillIds,playerMode?'player':'adult');setTab(next.view);setSelected(next.drill);};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[sessionDrillIds,playerMode]);
 async function act(action:Action){
  if(busyRef.current)return false;busyRef.current=true;setBusy(true);setError('');
  try{
   if(preview){setSample(applyAction(sample,action,{role:'owner',id:'preview-adult'}));return true;}
   if(!profile)throw new Error('An adult must set up a profile first.');
   if(playerMode){const operationKey=['player',profile.id,profile.revision,action.type,action.drillId??'',action.setIndex??'',action.answer??''].join(':');const projected=await requestPlayerAction({revision:profile.revision,action},operationKey);setPlayer(projected);return true;}
   const result=await request({type:'action',profileId:profile.id,revision:profile.revision,action});
   setProfiles(items=>items.map(p=>p.id===profile.id?{...p,state:result.state,revision:result.revision}:p));return true;
  }catch(e){setError(e instanceof Error?e.message:'Save failed');return false;}finally{busyRef.current=false;setBusy(false);}
 }
 function celebrate(name:string){setCelebration(name);toast.success('SAVE MADE!',{description:name+' complete. That is one more skill rep in the bank.',duration:3500});}
 useEffect(()=>{if(!celebration)return;const timer=setTimeout(()=>setCelebration(''),2800);return()=>clearTimeout(timer);},[celebration]);
 if(adultProfile?.role==='owner'&&adultProfile.setupStatus==='legacy-review-required')return <main className="tf-app tf-access-app"><header className="tf-header tf-access-header"><Brand/><span className="tf-office">At home · Off ice</span></header><section className="tf-access-main"><p className="tf-kicker">SETUP REVIEW</p><h1>Keep the progress. Complete the missing setup.</h1><p>Your saved sessions and coach access stay attached to the same goalie profile.</p><OnboardingFlow initialStep="parent-permission" legacyProfile={adultProfile} signOutLink={signOutLink} onHandoff={async()=>{const projected=await loadPlayer();if(projected){setResumeFirstValue(false);setShowFirstValue(true);}}}/></section><footer className="tf-footer">Tendie Forge · At-home, off-ice development · Adult managed</footer></main>;
 if(!enabled)return <AccessShell mode={mode} error={error} signInLink={signInLink} signOutLink={signOutLink} onPreview={()=>setPreview(true)} onReload={()=>void loadAdult()} onCreated={async()=>{const projected=await loadPlayer();if(projected){setResumeFirstValue(false);setShowFirstValue(true);}}}/>;
 if(player&&showFirstValue)return <main className="tf-app tf-access-app"><header className="tf-header tf-access-header"><Brand/><span className="tf-office">At home · Off ice</span></header><section className="tf-access-main"><PlayerFirstValueFlow player={player} resume={resumeFirstValue} onStartMission={()=>setShowFirstValue(false)} onStop={()=>act({type:'stop'})} onParent={async()=>{await loadAdult();setPlayer(null);setShowFirstValue(false);}}/></section><footer className="tf-footer">Tendie Forge · At-home, off-ice development · Adult managed</footer></main>;
 return <main className="tf-app">
  <a className="tf-skip" href="#training-main">Skip to training</a>
  <header className="tf-header"><Brand onHome={()=>navigate(playerMode?'Today':'Home')}/><div className="tf-header-end"><span className="tf-office">At home · Off ice</span>{profile&&!playerMode&&<span className="tf-adult-label">{coach?'Coach view':'Adult managed'}</span>}<button className="tf-avatar" onClick={()=>navigate('Profile')} aria-label={playerMode?'Open goalie profile':coach?'Open coach workspace':'Open profile and adult tools'}>{profile?.nickname?.slice(0,1)||'G'}</button></div></header>
  <div className="tf-frame"><nav className="tf-nav" aria-label="Main navigation">{playerMode?PLAYER_NAV.map(([name,Icon])=><button key={name} aria-current={tab===name?'page':undefined} className={tab===name?'active':''} onClick={()=>navigate(name)}><Icon size={21}/><span>{name}</span></button>):NAV.map(([name,Icon])=><button key={name} aria-current={tab===name?'page':undefined} className={tab===name?'active':''} onClick={()=>navigate(name)}><Icon size={21}/><span>{name}</span></button>)}</nav>
  <section id="training-main" className="tf-main">
   {preview&&<div className="tf-notice">Preview mode • changes are not saved. <button onClick={()=>{setPreview(false);setSample(newTrainingState());}}>Exit preview</button></div>}
   {error&&<div role="alert" className="tf-error">{error} <button onClick={()=>void load()}>Reload saved progress</button></div>}
   {(tab==='Home'||tab==='Today')&&<>
    <div className="tf-heading"><div><p className="tf-kicker">{profile?.nickname||'GOALIE'} · {path.name}</p><h1>{sessionDone?'That is a session earned.':'Your next save starts here.'}</h1></div><span className="tf-level">Path {path.level}</span></div>
    {state.safetyStopped?<div className="tf-error"><AlertTriangle/><h2>Training is paused.</h2><p>Tell a parent or guardian what happened. Rest does not erase your progress.</p><button className="tf-secondary" onClick={()=>setTab('Profile')}>Adult review</button></div>:<section className="tf-today"><div className="tf-today-top"><p className="tf-kicker">WEEK {state.week+1} · SESSION {state.day+1}</p><span><Clock size={16}/>{path.minutes} min planned</span></div><h2>{session.title}</h2><p className="tf-session-intro">{sessionDone?'Put the equipment away. Recovery is part of getting better.':`${session.blocks.length-completed} of ${session.blocks.length} drills left. One clear task at a time.`}</p><Progress value={completed/session.blocks.length*100} aria-label="Drills complete"/>
     <div className="tf-start-row">{!sessionDone?<button disabled={busy||coach} className="tf-primary" onClick={()=>navigate(playerMode?'Today':'Home',session.blocks.find(d=>!isDrillDone(state,session,d))?.id||'cool')}><Play size={19} fill="currentColor"/>{completed?'Continue training':'Start today’s training'}</button>:<button className="tf-primary" disabled={busy||coach} onClick={()=>void act({type:'next'})}>{state.week===19&&state.day===path.days-1?'Start another practice cycle':'View next planned session'} <ArrowRight size={18}/></button>}<span>{path.days} days/week · {path.schedule.join(' / ')}</span></div>
    </section>}
    <section className="tf-day-list" aria-label="Today’s drills">{session.blocks.map((d,i)=><button key={d.id} onClick={()=>navigate(playerMode?'Today':'Home',d.id)} className="tf-drill-row"><span className={isDrillDone(state,session,d)?'tf-number done':'tf-number'}>{isDrillDone(state,session,d)?<Check size={19}/>:i+1}</span><span><strong>{d.name}</strong><small>{d.sets} {d.sets===1?'set':'sets'} · {d.target} · {d.minutes} min</small></span><ChevronRight size={19}/></button>)}</section>
    {completed===session.blocks.length&&!sessionDone&&<button className="tf-primary" disabled={busy} onClick={async()=>{if(await act({type:'finish'}))celebrate('Full training session');}}><Trophy size={19}/>Finish and earn your session badge</button>}
    <section className="tf-reward"><span className="tf-reward-icon"><Trophy size={32}/></span><div><p className="tf-kicker">{state.sessions.length?'EARNED THROUGH TRAINING':'YOUR FIRST REWARD'}</p><h3>{state.sessions.length?`${state.sessions.length} session badges earned`:'The First Save badge'}</h3><p>{state.sessions.length?'Every badge marks a completed session—not time spent in the app.':'Complete every drill and finish the session to earn it.'}</p></div></section>
    <p className="tf-fine">Planned time includes setup, demonstration, breaks, and reflection. Do not add repetitions to fill time. Other sports count toward your total workload.</p>
   </>}
   {(tab==='Train'||tab==='Journey')&&<><div className="tf-heading"><div><p className="tf-kicker">20 WEEKS · OFF-ICE ONLY</p><h1>Your development path</h1></div></div><section className="tf-path-intro"><h2>{path.name}</h2><p>{path.description}</p><strong>{path.days} days × {path.minutes} minutes each week</strong><p>Keep this commitment throughout the path. Advancing requires skill checks—not finishing weeks. Take rest days between demanding sessions.</p></section><div className="tf-weeks">{WEEKS.map((w,i)=><article key={w.number} className={i===state.week?'current':''}><span className="tf-number">{w.number}</span><div><h3>{w.name}</h3><p>{w.skills.map(id=>SKILLS.find(s=>s.id===id)?.name).join(' · ')}</p></div><span>{i===state.week?'Current':i<state.week?'Covered':'Coming up'}</span></article>)}</div></>}
   {tab==='Progress'&&<><p className="tf-kicker">YOUR WORK. YOUR PROGRESS.</p><h1>Built, not guessed.</h1><section className="tf-progress-summary"><div><strong>{state.sessions.length}</strong><span>Sessions finished</span></div><div><strong>{completed}/{session.blocks.length}</strong><span>Today’s drills</span></div><div><strong>{new Set(skillChecks.filter(c=>c.pathId===state.pathId&&c.passed&&c.skillId).map(c=>c.skillId)).size}/30</strong><span>Skills accomplished</span></div></section><h2>Earn the next path</h2><p>Show all 30 skills with control. Each development group must also be observed on two different days. A parent or coach records exactly what they saw.</p><div className="tf-skills">{GROUPS.map(group=>{const skills=SKILLS.filter(s=>s.group===group);const achieved=new Set(skillChecks.filter(c=>c.group===group&&c.pathId===state.pathId&&c.passed).map(c=>c.skillId));const days=new Set(skillChecks.filter(c=>c.group===group&&c.pathId===state.pathId&&c.passed).map(c=>c.date.slice(0,10))).size;return <article key={group}><div><h3>{group}</h3><span>{achieved.size}/{skills.length} skills</span></div><Progress value={achieved.size/skills.length*100} aria-label={`${group} skill accomplishments`}/><p>{Math.min(days,2)}/2 observed days · {RUBRICS[group]}</p></article>;})}</div><h2>Session history</h2>{state.sessions.length?state.sessions.slice().reverse().map((s:{id:string;date:string;week:number;day:number})=><div key={s.id} className="tf-history"><Check size={18}/><span>Week {s.week+1}, session {s.day+1}</span><time>{new Date(s.date).toLocaleDateString()}</time></div>):<p>Your first completed session will appear here. There are no sample scores.</p>}</>}
   {tab==='Profile'&&(playerMode?<PlayerProfilePanel profile={profile} state={state} onParent={async()=>{await loadAdult();setPlayer(null);setShowFirstValue(false);}}/>:<ProfilePanel key={preview?'preview':profile?.id} profile={profile} preview={preview} profiles={profiles} active={active} onSwitch={async id=>{const chosen=profiles.find(item=>item.id===id);if(chosen?.role!=='owner'){setActive(id);return;}const key=contextSwitchOperationKey(contextKeysRef.current,id);try{await setPlayerContext(id,key);completeContextSwitch(contextKeysRef.current,id);setActive(id);setError('');}catch(error){setError(error instanceof Error?error.message:'Goalie was not changed. Try again.');}}} onChildHandoff={async()=>{const projected=await loadPlayer();if(projected){setResumeFirstValue(false);setShowFirstValue(true);}}} state={state} busy={busy} act={act} reload={loadAdult} onError={setError} signOutLink={signOutLink}/>)}
  </section></div>
  <footer className="tf-footer">SCS Saints Goalie Forge · At-home, off-ice development · Adult managed</footer>
  <Dialog open={Boolean(drill)} onOpenChange={open=>{if(!open)navigate(tab,null,true);}}><DialogContent ref={dialogRef} tabIndex={-1} onOpenAutoFocus={e=>{e.preventDefault();dialogRef.current?.focus();}} className="tf-dialog">{drill&&<DrillDetail key={`${session.id}:${drill.id}`} drill={drill} state={state} session={session} busy={busy} readOnly={coach} act={act} saveError={error} onReload={()=>void load()} onDone={()=>{celebrate(drill.name);navigate(tab,null,true);}}/>}</DialogContent></Dialog>
  <Toaster theme="light" position="top-center" richColors/>
  {celebration&&<div className="tf-celebration" aria-hidden="true"><Shield size={40}/><strong>SAVE MADE</strong><span>{celebration}</span></div>}
 </main>;
}
export function TrainingSaveError({message,onReload}:{message:string;onReload:()=>void}){return message?<div className="tf-error" role="alert"><p>{message}</p><button className="tf-secondary" onClick={onReload}>Reload saved progress</button><p className="tf-fine">The last action is not confirmed. If something hurts, stop and tell an adult regardless of save status.</p></div>:null;}
function DrillDetail({drill,state,session,busy,readOnly,act,onDone,saveError,onReload}:{drill:Drill;state:TrainingState;session:ReturnType<typeof buildSession>;busy:boolean;readOnly:boolean;act:(a:Action)=>Promise<boolean>;onDone:()=>void;saveError:string;onReload:()=>void}){
 const [now,setNow]=useState(Date.now);const [easy,setEasy]=useState(false);const [started,setStarted]=useState(false);
 const rest=(state as TrainingState&{rests?:Record<string,{until:number;remaining:number}>}).rests?.[`${session.id}:${drill.id}`];
 const seconds=rest?rest.remaining||Math.max(0,Math.ceil((rest.until-now)/1000)):0;const running=Boolean(rest&&!rest.remaining&&seconds>0);
 const done=isDrillDone(state,session,drill);const setsDone=Array.from({length:drill.sets},(_,i)=>state.sets[`${session.id}:${drill.id}:${i}`]).filter(Boolean).length;
 const question=WEEKS[session.week];const answer=state.answers[session.id] as {choice:number;correct:boolean}|undefined;
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(t);},[]);
 async function finishSet(){if(await act({type:'set',drillId:drill.id,setIndex:setsDone})){setNow(Date.now());if(setsDone+1===drill.sets)onDone();}}
 return <><DialogHeader><p className="tf-kicker">{drill.group} · OFF ICE ONLY</p><DialogTitle>{drill.name}</DialogTitle><DialogDescription>{drill.cue}</DialogDescription></DialogHeader>
  <div className="tf-dose"><div><strong>{drill.sets} {drill.sets===1?'set':'sets'}</strong><span>{drill.target}</span></div><div><strong>{drill.restSeconds}s</strong><span>rest between sets</span></div><div><strong>{drill.minutes} min</strong><span>planned block</span></div></div>
  {drill.id==='read'?<section className="tf-question"><h3>{question.question}</h3><div>{question.options.map((option,i)=><button key={option} disabled={busy||readOnly||state.safetyStopped} className={answer?.choice===i?'selected':''} onClick={()=>void act({type:'answer',answer:i})}>{String.fromCharCode(65+i)}. {option}</button>)}</div>{answer&&<p role="status"><strong>{answer.correct?'Good read.':'Try this way of thinking: '}</strong> {question.explanation}</p>}</section>:<DrillMap kind={drill.diagram} name={drill.name}/>}
  <section className="tf-equipment"><div><strong>You need</strong><p>{drill.equipment}</p></div><div><strong>Your space</strong><p>{drill.space}</p></div></section>
  <h3>Set up</h3><p>{drill.setup}</p><h3>Do this</h3><ol className="tf-steps">{drill.steps.map((step:string)=><li key={step}>{step}</li>)}</ol>
  <button className="tf-link" onClick={()=>setEasy(!easy)} aria-expanded={easy}>{easy?'Hide easier version':'Need an easier version?'}</button>{easy&&<p className="tf-easier">{drill.easier}</p>}
  <p className="tf-safety"><AlertTriangle size={18}/>{drill.safety}</p>
  <div className="tf-drill-controls"><div className="tf-set-dots" aria-label={`${setsDone} of ${drill.sets} sets completed`}>{Array.from({length:drill.sets},(_,i)=><span className={i<setsDone?'done':''} key={i}>{i<setsDone?<Check size={16}/>:i+1}</span>)}</div>
   <TrainingSaveError message={saveError} onReload={onReload}/>
   {done?<p><Check/> Drill already complete.</p>:state.safetyStopped?<p role="alert">Training paused. Ask an adult to check in.</p>:seconds>0?<div className="tf-rest"><strong role="timer">Rest {seconds}s</strong><button disabled={busy||readOnly} className="tf-secondary" onClick={()=>void act({type:running?'pause-rest':'resume-rest',drillId:drill.id})}>{running?<Pause size={16}/>:<Play size={16}/>} {running?'Pause':'Resume'}</button></div>:!started?<button className="tf-primary" onClick={()=>setStarted(true)} disabled={readOnly}><Play size={18}/>I understand—start this drill</button>:<button className="tf-primary" disabled={busy||readOnly||(drill.id==='read'&&!answer)} onClick={()=>void finishSet()}><Check size={18}/>{busy?'Saving…':`I finished set ${setsDone+1}`}</button>}
   {!done&&<button className="tf-link tf-stop" disabled={busy||readOnly} onClick={()=>void act({type:'stop'})}>Something hurts / stop training</button>}
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
