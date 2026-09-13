import {Check,Shield,Trophy} from 'lucide-react';

export const DEVELOPMENT_ATTRIBUTE_LABELS={TRACKING:'Tracking',HANDS:'Hands',BALANCE:'Balance',EXPLOSIVENESS:'Explosiveness',STRENGTH:'Strength',MOBILITY:'Mobility',CONDITIONING:'Conditioning',MINDSET:'Mindset'} as const;
export type ProgressionProjection={profileContextId:string;ruleVersion:string;totalXp:number;attributes:Record<keyof typeof DEVELOPMENT_ATTRIBUTE_LABELS,number>;journey:{pathId:string;week:number;day:number;cycle:number};rewards:Array<{id:string;awardedAt:string}>;recentCompletions:Array<{missionId:string;completedAt:string;completedPrescribedMinutes:number;skippedPrescribedMinutes:number;xp:number;ruleVersion:string}>;meaning:string};
export type CompletionSummary={classification:'CREDITED'|'LEGACY_UNCREDITED';ruleVersion:string|null;completedPrescribedMinutes:number;skippedPrescribedMinutes:number;totalPrescribedMinutes:number;completionMultiplier:number;xp:number;attributes:Record<string,number>;journeyBefore:{pathId:string;week:number;day:number;cycle:number};journeyAfter:{pathId:string;week:number;day:number;cycle:number};newReward:string|null};

const journeyLabel=(journey:{week:number;day:number;cycle:number})=>`Week ${journey.week+1} · Session ${journey.day+1}${journey.cycle?` · Cycle ${journey.cycle+1}`:''}`;

export function CompletionProgress({summary,pendingSync}:{summary:CompletionSummary;pendingSync:boolean}){
 if(pendingSync)return <section className="tf-reward" role="status"><span className="tf-reward-icon"><Check size={30}/></span><div><p className="tf-kicker">SAVED ON THIS DEVICE</p><h3>Connect to confirm progression.</h3><p>Your activity results are retained. XP and Journey movement appear only after the server confirms them.</p></div></section>;
 if(summary.classification==='LEGACY_UNCREDITED')return <section className="tf-reward" role="status"><span className="tf-reward-icon"><Check size={30}/></span><div><p className="tf-kicker">MISSION SAVED</p><h3>Historical training retained.</h3><p>This older mission stays in history. No XP or Journey movement was invented for it.</p></div></section>;
 return <section className="tf-reward tf-completion-progress" role="status"><span className="tf-reward-icon">{summary.newReward==='FIRST_SAVE'?<Trophy size={30}/>:<Check size={30}/>}</span><div><p className="tf-kicker">MISSION CONFIRMED</p><h3>{summary.xp>0?`${summary.xp} XP earned`:'Mission saved — earned no XP'}</h3><p>{summary.skippedPrescribedMinutes>0?`${summary.skippedPrescribedMinutes} planned minutes were skipped and earned no XP. `:''}Next: {journeyLabel(summary.journeyAfter)}.</p>{summary.newReward==='FIRST_SAVE'&&<strong>First Save unlocked.</strong>}</div></section>;
}

export function ProgressionPanel({projection,loading,error,onRetry}:{projection:ProgressionProjection|null;loading:boolean;error:string;onRetry:()=>void}){
 if(loading)return <section className="tf-progress-state" aria-live="polite"><p role="status">Loading your progress…</p></section>;
 if(error)return <section className="tf-error" role="alert"><p>{error}</p><button className="tf-secondary" onClick={onRetry}>Try again</button></section>;
 if(!projection)return <section className="tf-progress-state"><h2>Complete your first mission.</h2><p>Your confirmed work will appear here.</p></section>;
 const firstSave=projection.rewards.find(reward=>reward.id==='FIRST_SAVE');
 return <>
  <p className="tf-kicker">YOUR WORK. YOUR PROGRESS.</p><h1>Built, not guessed.</h1>
  <section className="tf-progress-summary"><div><strong>{projection.totalXp} XP</strong><span>Completed prescribed work</span></div><div><strong>{journeyLabel(projection.journey)}</strong><span>Current Journey position</span></div><div><strong>{projection.recentCompletions.length}</strong><span>Credited missions shown</span></div></section>
  <p className="tf-fine">{projection.meaning}</p>
  {firstSave&&<section className="tf-reward"><span className="tf-reward-icon"><Shield size={30}/><Check size={16}/></span><div><p className="tf-kicker">EARNED REWARD</p><h2>First Save</h2><p>Unlocked by completing your first eligible prescribed work on {new Date(firstSave.awardedAt).toLocaleDateString()}.</p></div></section>}
  <h2>Development attributes</h2><p>These totals show where your completed prescribed work was directed. They are not skill ratings.</p>
  <section className="tf-attribute-grid">{Object.entries(DEVELOPMENT_ATTRIBUTE_LABELS).map(([id,label])=><article key={id}><span>{label}</span><strong>{projection.attributes[id as keyof typeof DEVELOPMENT_ATTRIBUTE_LABELS]} XP</strong></article>)}</section>
  <h2>Credited mission history</h2>{projection.recentCompletions.length?projection.recentCompletions.map(item=><div className="tf-history" key={item.missionId+item.completedAt}><Check size={18}/><span>{item.xp} XP · {item.completedPrescribedMinutes} completed minutes{item.skippedPrescribedMinutes?` · ${item.skippedPrescribedMinutes} skipped`:''}</span><time>{new Date(item.completedAt).toLocaleDateString()}</time></div>):<p>Complete your first mission to begin your development history.</p>}
 </>;
}
