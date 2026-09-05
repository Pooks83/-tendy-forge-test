import {PATHS,GROUPS,WEEKS,buildSession,recordSet,finishSession,nextSession,canAdvance} from './training.mjs';
export function applyAction(state,action,actor,date=new Date().toISOString()) {
 const adult=actor.role==='owner'||actor.role==='coach';
 const session=buildSession(state.pathId,state.week,state.day,state.cycle||0);
 switch(action.type) {
  case 'stop': return {...state,safetyStopped:true};
  case 'clear-safety': if(actor.role!=='owner') throw new Error('Parent permission required'); return {...state,safetyStopped:false};
  case 'set': {
   if(actor.role==='coach') throw new Error('Owner permission required');
   const key=`${session.id}:${action.drillId}`;
   if(state.sets[`${key}:${action.setIndex}`]) return state;
   if(action.setIndex>0&&!state.sets[`${key}:${action.setIndex-1}`]) throw new Error('Complete sets in order');
   if(action.drillId==='read'&&!state.answers[session.id]) throw new Error('Choose an answer before completing the reading task');
   const rest=state.rests?.[key];
   if(rest&&(rest.remaining>0||rest.until>Date.parse(date))) throw new Error('Finish your rest before the next set');
   const next=recordSet(state,session,action.drillId,action.setIndex);
   const drill=session.blocks.find(d=>d.id===action.drillId);
   return {...next,rests:{...state.rests,[key]:{until:Date.parse(date)+(action.setIndex+1<drill.sets?drill.restSeconds*1000:0),remaining:0}}};
  }
  case 'pause-rest': case 'resume-rest': {
   if(actor.role==='coach') throw new Error('Owner permission required');
   const key=`${session.id}:${action.drillId}`;const rest=state.rests?.[key];
   if(!rest) throw new Error('Invalid rest timer');
   const now=Date.parse(date);
   const value=action.type==='pause-rest'?{until:0,remaining:rest.remaining||Math.max(0,Math.ceil((rest.until-now)/1000))}:{until:rest.remaining?now+rest.remaining*1000:rest.until,remaining:0};
   return {...state,rests:{...state.rests,[key]:value}};
  }
  case 'answer': {
   if(!Number.isInteger(action.answer)||action.answer<0||action.answer>2) throw new Error('Invalid answer');
   return {...state,answers:{...state.answers,[session.id]:{choice:action.answer,correct:action.answer===WEEKS[state.week].answer}}};
  }
  case 'finish': if(actor.role==='coach') throw new Error('Owner permission required'); return finishSession(state,session,date);
  case 'next': if(actor.role==='coach') throw new Error('Owner permission required'); return nextSession(state);
  case 'evaluate': {
   if(!adult||!actor.id) throw new Error('Adult permission required');
   if(!Array.isArray(action.ratings)||action.ratings.length!==5||!action.ratings.every(n=>Number.isInteger(n)&&n>=0&&n<=3)||!['none','positioning','tracking','movement','save selection','execution','decision-making'].includes(action.cause)||typeof action.note!=='string'||action.note.trim().length<8||action.note.length>600) throw new Error('Invalid evaluation: add five ratings and a specific observation');
   return {...state,evaluations:[...(state.evaluations||[]),{ratings:[...action.ratings],cause:action.cause,note:action.note.trim(),reviewedBy:actor.id,date,pathId:state.pathId,context:'off-ice'}]};
  }
  case 'check': {
   if(!adult||!actor.id) throw new Error('Adult permission required');
   if(!GROUPS.includes(action.group)||typeof action.passed!=='boolean'||typeof action.note!=='string'||action.note.trim().length<8||action.note.length>600) throw new Error('Add a specific observed example (8–600 characters)');
   const check={group:action.group,pathId:state.pathId,passed:action.passed,note:action.note.trim(),reviewedBy:actor.id,date};
   return {...state,checks:[...state.checks,check]};
  }
  case 'advance': {
   if(actor.role!=='owner') throw new Error('Parent permission required');
   if(!canAdvance(state)) throw new Error('Complete the skill accomplishments first');
   const index=PATHS.findIndex(p=>p.id===state.pathId);
   if(index===PATHS.length-1) throw new Error('You are on the final path');
   return {...state,pathId:PATHS[index+1].id,week:0,day:0,cycle:0};
  }
  default: throw new Error('Unknown action');
 }
}
