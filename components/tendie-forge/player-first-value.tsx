"use client";
import {useEffect,useReducer,useState} from 'react';
import {Check,Shield,Timer,TriangleAlert} from 'lucide-react';
import {firstValueReducer,initialFirstValueState} from '@/lib/first-challenge-state.mjs';

type Step='loading'|'goalie-welcome'|'first-challenge'|'challenge-active'|'first-win'|'first-today';
type PlayerProjection={profile:{id:string;nickname:string;plannedDays?:string[];missionMinutes?:number};training:Record<string,unknown>};
type Props={player:PlayerProjection;initialStep?:Step;resume?:boolean;onStartMission:()=>void;onStop:()=>Promise<void>};

async function challengeRequest(action:'start'|'complete',operationKey:string){
 const response=await fetch('/api/first-challenge',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':operationKey},body:JSON.stringify({action})});
 const result=await response.json() as {status?:string;remainingSeconds?:number;error?:{message?:string}};
 if(!response.ok)throw new Error(result.error?.message||'Your challenge was not changed. Try again.');
 return result;
}

export function PlayerFirstValueFlow({player,initialStep='goalie-welcome',resume=false,onStartMission,onStop}:Props){
 const [state,dispatch]=useReducer(firstValueReducer,undefined,()=>({...initialFirstValueState(),step:resume?'loading':initialStep}));
 const [loadAttempt,setLoadAttempt]=useState(0);
 useEffect(()=>{
  if(!resume)return;
  let current=true;
  void fetch('/api/first-challenge',{cache:'no-store'}).then(async response=>({ok:response.ok,data:await response.json() as {status?:string;remainingSeconds?:number;error?:{message?:string}}})).then(({ok,data})=>{if(!current)return;if(ok)dispatch({type:'HYDRATE',status:data.status,remainingSeconds:data.remainingSeconds});else dispatch({type:'FAILED',message:data.error?.message||'Your challenge could not be loaded.'});}).catch(()=>{if(current)dispatch({type:'FAILED',message:'Your challenge could not be loaded. Try again.'});});
  return()=>{current=false;};
 },[resume,loadAttempt]);
 useEffect(()=>{
  if(state.step!=='challenge-active'||state.remaining<=0)return;
  const timer=setInterval(()=>dispatch({type:'TICK',seconds:1}),1000);
  return()=>clearInterval(timer);
 },[state.step,state.remaining]);
 async function start(){
  dispatch({type:'BUSY'});
  try{const result=await challengeRequest('start',state.startOperationKey);dispatch({type:'HYDRATE',status:result.status,remainingSeconds:result.remainingSeconds??60});}catch(error){dispatch({type:'FAILED',message:error instanceof Error?error.message:'Try again.'});}
 }
 async function complete(){
  dispatch({type:'BUSY'});
  try{await challengeRequest('complete',state.completeOperationKey);dispatch({type:'CHALLENGE_COMPLETED'});}catch(error){dispatch({type:'FAILED',message:error instanceof Error?error.message:'Try again.'});}
 }
 return <section className="tf-first-value" aria-live="polite">
  {state.step==='loading'&&<><p role="status">Loading your next step…</p>{state.error&&<button className="tf-secondary" onClick={()=>{dispatch({type:'BUSY'});setLoadAttempt(value=>value+1);}}>Try again</button>}</>}
  {state.step==='goalie-welcome'&&<><span className="tf-handoff-icon"><Shield size={42}/></span><p className="tf-kicker">WELCOME, GOALIE</p><h1>Hi {player.profile.nickname}. This is your forge.</h1><p>One challenge. One clear next step. Your work builds your own journey.</p><button className="tf-primary" onClick={()=>dispatch({type:'WELCOME_CONTINUED'})}>LET’S GO</button></>}
  {state.step==='first-challenge'&&<><p className="tf-kicker">FIRST CHALLENGE</p><h1>Your 60-second first challenge.</h1><div className="tf-challenge-card"><h2>Ready. Reset. Repeat.</h2><ol><li>Stand in a comfortable goalie-ready position.</li><li>Hold steady for 5 seconds.</li><li>Stand tall, relax, then reset. Keep going until time ends.</li></ol><p className="tf-safety"><TriangleAlert size={18}/>Use a clear, dry floor. No goalie gear or dropping to your knees. Stop if anything hurts.</p></div><button className="tf-primary" disabled={state.busy} onClick={()=>void start()}>{state.busy?'STARTING…':'START'}</button></>}
  {state.step==='challenge-active'&&<><p className="tf-kicker">READY. RESET. REPEAT.</p><div className="tf-challenge-timer" role="timer" aria-label={`${state.remaining} seconds remaining`}><Timer/><strong>{state.remaining}</strong><span>seconds</span></div><p>Stay controlled. Stand tall between holds. Quality matters more than speed.</p>{state.remaining===0&&<button className="tf-primary" disabled={state.busy} onClick={()=>void complete()}>{state.busy?'SAVING…':'FINISH CHALLENGE'}</button>}<button className="tf-link tf-stop" onClick={()=>void onStop()}>STOP — SOMETHING HURTS</button></>}
  {state.step==='first-win'&&<><span className="tf-handoff-icon"><Shield size={42}/><Check size={20}/></span><p className="tf-kicker">FIRST WIN</p><h1>You showed up and finished controlled.</h1><p>You completed your first 60-second ready-position challenge. Your next mission builds from here.</p><button className="tf-primary" onClick={()=>dispatch({type:'WIN_CONTINUED'})}>SEE MY FIRST MISSION</button></>}
  {state.step==='first-today'&&<><p className="tf-kicker">TODAY</p><h1>Your first mission is ready.</h1><section className="tf-today"><h2>Build your base</h2><p>Start with clear, off-ice movement and tracking work. Rest and safety stops protect your progress.</p></section><button className="tf-primary" onClick={onStartMission}>START MISSION</button></>}
  {state.error&&<p className="tf-error" role="alert">{state.error}</p>}
 </section>;
}
