// Curriculum v1. Off-ice practice only; prescribed loads require coach review.
export const PATHS = [
  {id:'foundation',name:'Build your base',days:3,minutes:30,level:1,schedule:['Mon','Wed','Sat'],description:'Learn the moves. Finish balanced.'},
  {id:'builder',name:'Own your movement',days:3,minutes:45,level:2,schedule:['Mon','Wed','Sat'],description:'Link your eyes, hands, and feet.'},
  {id:'performance',name:'Read and respond',days:4,minutes:60,level:3,schedule:['Mon','Wed','Fri','Sun'],description:'Make good choices. Sunday is a low-impact skills day.'},
];
export const GROUPS=['Move','See','React','Recover','Think','Compete'];
// Foundation categories synthesize the supplied evaluation, not an invented historical list.
const names=['Ready position','Balance','Controlled footwork','Lateral power','Jumping and landing','Short acceleration','Bodyweight strength','Core control','Comfortable mobility','Hand-eye coordination','Ball tracking','Target control','Positioning concepts','Safe stick-and-ball control','Communication','Reset routine','Pre-shot information gathering','Release reading and deception','Pattern recognition','Save selection and decisions','Transition and recovery','Broken plays and chaos','Behind-net and low-zone reading','Traffic and sightlines','Preventing chances','Game situations','Film intelligence','Quality under fatigue','Adaptability and learning','Competitive behavior'];
export const SKILLS=names.map((name,i)=>({id:i+1,name}));
export const DRILLS = {
  warm:{name:'Wake up your feet',group:'Move',equipment:'Trainers, 2 floor markers',space:'A clear, non-slip 2 × 2 metre space',sets:2,target:'30 marching steps + 10 side steps each way',restSeconds:30,setup:'Put the markers two small steps apart.',steps:['March in place for 30 steps. Swing your arms.','Take 2 small side steps right, then 2 left. Repeat 5 times between your markers.','That is 10 steps each way. Shake out your hands, rest, then repeat the set.'],cue:'Feet stay underneath you. Start easy.',easier:'Use slower, smaller steps.',safety:'Check that the floor is dry and the markers cannot slip.',diagram:'lane'},
  catch:{name:'Wall ball: catch with two hands',group:'See',equipment:'Soft ball and a solid wall',space:'2 metres from a wall, away from windows',sets:3,target:'10 throws and catches',restSeconds:30,setup:'Stand two big steps from the wall. Hold the soft ball at your waist.',steps:['Gently throw the ball at the wall below your shoulder.','Watch the ball all the way into both hands.','Reset your feet after each catch. Count 10 throws, including misses.'],cue:'Eyes follow the ball into your hands.',easier:'Allow one floor bounce before catching.',safety:'Use a soft ball only. Keep people and glass out of the rebound area.',diagram:'wall'},
  alternate:{name:'Wall ball: swap hands',group:'React',equipment:'Soft ball and a solid wall',space:'2 metres from a wall, away from windows',sets:3,target:'10 throws: 5 catches with each hand',restSeconds:40,setup:'Start in a comfortable standing position two big steps from the wall.',steps:['Throw softly with your right hand. Catch with your left.','Throw with your left. Catch with your right.','Keep swapping for 10 throws. Missed catches still count as attempts.'],cue:'Soft hands. See the whole bounce.',easier:'Catch with two hands, then choose the other throwing hand.',safety:'Do not throw harder to make it difficult.',diagram:'wall'},
  balance:{name:'Stand tall on one foot',group:'Move',equipment:'A wall nearby for support',space:'A flat non-slip floor',sets:3,target:'20 seconds on each foot',restSeconds:30,setup:'Stand near a wall so you can touch it if needed.',steps:['Lift one foot just above the floor.','Keep your eyes on a spot ahead for 20 seconds.','Put your foot down. Switch feet and repeat.'],cue:'Hips level. Breathe normally.',easier:'Rest one fingertip on the wall.',safety:'Put your foot down if you wobble. Do not close your eyes.',diagram:'support'},
  lateral:{name:'Side jump and stick',group:'Move',equipment:'Two flat markers',space:'A clear non-slip 2 × 2 metre area',sets:3,target:'3 small jumps each way',restSeconds:60,setup:'Put two markers a comfortable small step apart. Ask an adult to watch the landing.',steps:['Stand on your right foot with a soft knee.','Make a small hop left and land on your left foot. Hold for 2 seconds.','Hop back and hold. Finish 3 each way, then rest.'],cue:'Land quietly. Knee points the same way as your toes.',easier:'Step sideways and balance instead of jumping.',safety:'Stop if your landing becomes noisy or unsteady, or anything hurts.',diagram:'lane'},
  jump:{name:'Small jump, quiet landing',group:'Move',equipment:'Flat floor marker',space:'Open floor with clear headroom',sets:3,target:'3 small two-foot jumps',restSeconds:60,setup:'Stand with feet comfortably apart. Have an adult check your landing.',steps:['Bend a little at your hips and knees.','Jump a small distance up. Land on both feet with soft knees.','Hold still for 2 seconds. Reset before the next jump.'],cue:'Quiet feet. No race for height.',easier:'Rise onto your toes without leaving the floor.',safety:'No furniture, boxes, or hard-floor knee drops.',diagram:'target'},
  squat:{name:'Sit back and stand',group:'Move',equipment:'A sturdy chair against a wall',space:'Clear floor in front of the chair',sets:2,target:'8 slow repetitions',restSeconds:45,setup:'Put a sturdy chair against a wall. Stand just in front of it.',steps:['Keep feet comfortably apart and arms forward.','Slowly sit back until you lightly touch the seat.','Stand tall again. Repeat 8 times without rushing.'],cue:'Knees follow your toes. Keep breathing.',easier:'Sit fully and stand with light hand support.',safety:'The chair must not roll or slide.',diagram:'support'},
  push:{name:'Wall push-up',group:'Move',equipment:'A solid wall',space:'Enough room to step back from the wall',sets:2,target:'8 controlled repetitions',restSeconds:45,setup:'Place hands on the wall at shoulder height and take one small step back.',steps:['Keep your body in a straight line.','Bend your elbows and bring your chest toward the wall.','Push away gently until your arms are straight. Do 8.'],cue:'Whole body moves together.',easier:'Stand closer to the wall.',safety:'Do not use a door, glass, or unstable furniture.',diagram:'wall'},
  core:{name:'Heel slide',group:'Recover',equipment:'Exercise mat',space:'Enough room to lie down',sets:2,target:'6 slides with each leg',restSeconds:30,setup:'Lie on your back on a mat. Bend your knees with both feet down.',steps:['Breathe normally and keep your hips still.','Slowly slide one heel away along the mat.','Bring it back. Swap legs. Do 6 each side.'],cue:'Small, smooth moves. No back arching.',easier:'Slide only half as far.',safety:'Stay in a comfortable range. Stop for back pain.',diagram:'lane'},
  reset:{name:'Find it, step, reset',group:'Recover',equipment:'Soft ball and 2 markers',space:'Clear non-slip floor',sets:3,target:'6 rolls and resets',restSeconds:40,setup:'Put two markers one step to either side. Start between them with a soft ball.',steps:['Roll the ball gently toward one marker.','Look at the ball, then step toward it and pick it up.','Return to the middle in balance. Change sides each time.'],cue:'Look first. Move second. Finish steady.',easier:'Place the ball close enough to reach with one step.',safety:'No diving, sliding, or dropping onto your knees.',diagram:'lane'},
  scan:{name:'Look, call, catch',group:'See',equipment:'Soft ball, wall, 2 colored cards',space:'Safe wall area with cards at either side',sets:3,target:'8 throws',restSeconds:30,setup:'Put colored cards to your left and right. Stand two steps from the wall.',steps:['Before throwing, turn your head and say one card color.','Look back at the wall. Throw the ball gently.','Watch it into your hands. Use the other card next time.'],cue:'Look away only before you throw.',easier:'Skip the throw and point to each color instead.',safety:'Never look away while a ball is coming toward you.',diagram:'wall'},
  sight:{name:'Find the viewing window',group:'See',equipment:'A stable chair and colored floor target',space:'Clear floor with no thrown balls',sets:3,target:'6 look-and-find repetitions',restSeconds:30,setup:'Place a colored target beyond a stable chair. Stand on the other side.',steps:['Stand still and look for the target around the chair.','Move your head a little left or right until you can see it.','Say the color, return to the middle, and repeat.'],cue:'Small head move. Keep your feet steady.',easier:'Move the chair farther from the target.',safety:'Do not throw balls through the chair or climb on it.',diagram:'sight'},
  sprint:{name:'Quick start, easy stop',group:'Move',equipment:'2 markers and trainers',space:'Outdoors: 5 metres to run plus 5 metres to slow down',sets:3,target:'1 short 5-metre run',restSeconds:60,setup:'An adult checks the level, dry surface and clear stopping space.',steps:['Stand behind the first marker.','Run to the second marker with quick, controlled steps.','Slow down gradually in the clear area. Walk back and rest.'],cue:'Fast feet, controlled stop. No all-out time trial.',easier:'In a small room, do 10 quick marching steps instead.',safety:'Never sprint in a hallway or toward a wall. Stop if speed or control drops.',diagram:'lane'},
  target:{name:'Soft-ball target pass',group:'React',equipment:'Stick, soft ball, 2 floor markers',space:'Clear 2 × 3 metre area with no people ahead',sets:3,target:'8 gentle passes',restSeconds:30,setup:'Make a target gate with two markers. Stand two metres away.',steps:['Keep your stick blade on the floor behind the soft ball.','Push the ball gently through the gate. No backswing.','Walk to collect it. Say "yours" before the next pass.'],cue:'Look at your target before you pass.',easier:'Use your hand to roll the ball through a wider gate.',safety:'Soft ball only. Keep the stick below your knees.',diagram:'target'},
  cool:{name:'Walk and reset',group:'Recover',equipment:'None',space:'A quiet clear floor area',sets:1,target:'2 minutes easy walking, then 4 slow breaths',restSeconds:0,setup:'Put your equipment away from where you will walk.',steps:['Walk slowly for 2 minutes and relax your shoulders.','Stand or sit comfortably. Breathe in normally and out gently 4 times.','Name one thing you did well and one cue for next time.'],cue:'No breath holding. Finish calm.',easier:'Sit comfortably for the breathing part.',safety:'Tell an adult about pain or dizziness. Do not use breathing to push through symptoms.',diagram:'reset'},
  mobility:{name:'Easy ankle rocks',group:'Recover',equipment:'Wall for balance',space:'Clear, flat floor',sets:2,target:'8 small rocks on each side',restSeconds:30,setup:'Stand facing a wall with one foot a small step ahead of the other.',steps:['Place your hands lightly against the wall.','Keeping the front heel down, bend the front knee forward a little.','Return slowly. Do 8, then swap feet.'],cue:'Comfortable movement, never force a stretch.',easier:'Make the movement smaller.',safety:'Stop for pinching or pain. No forced hip rotation.',diagram:'support'},
};
// Match equipment diagrams to these movements, without a ball-flight arrow.
DRILLS.push.diagram='support';
DRILLS.squat.diagram='chair';
/** @type {Array<[string, number[], string, string[], number, string]>} */
const weekData = [
 ['Ready, steady',[1,2,3], 'A ball is about to arrive. What helps you see it?', ['Hold your head steady','Look at your feet','Close your eyes'],0,'A steady head helps you follow the ball.'],
 ['Quiet landings',[4,5,6],'Your landing gets wobbly. What next?',['Jump farther','Rest, then try the stepping version','Rush the last set'],1,'Control matters more than height or speed.'],
 ['Build your base',[7,8,9],'A movement pinches. What do you do?',['Push harder','Hide it','Stop and tell an adult'],2,'Pain is a reason to stop, not a challenge to beat.'],
 ['Follow the ball',[10,11,12],'A ball hits the wall. Where do your eyes go?',['Toward the next throw','Follow it into your hands','At your score'],1,'Track the whole bounce, not just the start.'],
 ['Find your angle',[13,17],'Before a shot develops, why look to the far side?',['Find another passing threat','Guess the score','Look away during the shot'],0,'Scan early, then return your eyes to the puck before release.'],
 ['Talk and reset',[14,15,16],'Your teammate can safely receive a pass. What helps?',['Say nothing','Look and give a clear call','Rush without looking'],1,'A clear call helps your teammate prepare.'],
 ['Read the release',[18],'A shooter fakes with their shoulders. Is that proof of a shot?',['Yes, drop immediately','No, keep reading the puck and release','Look at the crowd'],1,'One body fake is not enough. Keep gathering information.'],
 ['Spot the next play',[19],'A passing lane opens toward an unmarked attacker. What next?',['Notice the threat without guessing','Forget the puck','Commit before the pass'],0,'Prepare for the threat while staying able to respond.'],
 ['Choose simply',[20],'Does every shot need the same save?',['Always butterfly','Always stay standing','No, choose for the actual shot'],2,'The situation guides the save choice. This is a reading task, not a floor-drop drill.'],
 ['Ready for the next',[21],'After the first save, what comes first?',['Find the puck','Jump up without looking','Celebrate while play continues'],0,'Find it before choosing where to recover.'],
 ['Stay organized',[22],'A puck changes direction after a block. What helps?',['Follow the new path','Keep moving toward the old path','Guess and dive'],0,'Update what you see before making a big move.'],
 ['Read behind the net',[23],'The puck goes behind the net. What else matters?',['Only the puck carrier','An attacker waiting in front','The crowd'],1,'Track the puck and safely update where the pass-out threat is.'],
 ['See through traffic',[24],'A player blocks your view. What is the first useful change?',['A small head adjustment','Drop because you cannot see','Close your eyes'],0,'Try to find a viewing window before committing.'],
 ['Prevent the chance',[25],'Which pass is more helpful under pressure?',['A blind pass into the middle','A hard pass anywhere','A safe pass to a teammate you can see'],2,'Possession and clear communication can prevent the next chance.'],
 ['Know the situation',[26],'The other team adds an extra attacker. What may increase?',['Space and fewer passes','Traffic and passing threats','Nothing changes'],1,'More attackers can add screens, rebounds, and passing options.'],
 ['Learn from a clip',[27],'One clip shows a shooter going left. What can you conclude?',['They always go left','It is one clue, not a guarantee','Never watch again'],1,'Look for repeated patterns. Scouting is not certainty.'],
 ['Quality late in a set',[28],'Your feet get noisy and your form changes. What next?',['Rest or use the easier version','Race to finish','Add extra reps'],0,'Good form matters more than finishing fast.'],
 ['Use one coaching cue',[29],'A coach gives you a new cue. How do you use it?',['Change everything at once','Try one change and check the result','Ignore it after one attempt'],1,'One clear change is easier to notice and improve.'],
 ['Compete with composure',[30],'You miss a catch. What is a useful reset?',['Blame someone','Rush the next throw','Breathe, reset, and follow the next ball'],2,'Own the mistake, then focus on the next useful action.'],
 ['Show what you learned',[1,7,11,17,20,21,24,28,29,30],'What earns your next path?',['Reaching week 20','Showing the skills with control','Spending extra time on screen'],1,'Your accomplishments matter. The calendar does not prove mastery.'],
];
export const WEEKS=weekData.map(([name,skills,question,options,answer,explanation],i)=>({number:i+1,name,skills,question,options,answer,explanation}));
export function buildSession(pathId,week,day,cycle=0) {
 const path=PATHS.find(p=>p.id===pathId);
 if(!path||!Number.isInteger(week)||week<0||week>19||!Number.isInteger(day)||day<0||day>=path.days) throw new Error('Invalid session');
 const low=day===3;
 const rotations=[['catch','lateral','squat'],['balance','jump','push'],['alternate','sprint','core'],['scan','sight','mobility']];
 const selected=[...rotations[day]];
 if(week>=4 && day===0) selected[0]=week%2?'scan':'sight';
 if(week>=8 && day===2) selected[0]=week%2?'target':'reset';
 const blocks=['warm',...selected,'read','cool'].map((id,i)=>{
   const base=id==='read'?{name:'Read the play',group:'Think',equipment:'This screen',space:'A comfortable place to sit',sets:1,target:'Choose an answer and explain why',restSeconds:0,setup:'Read the situation below. You do not need to act it out.',steps:['Look at the situation.','Choose the safest useful response.','Read the feedback. Say why that choice helps.'],cue:'Understand the play. Do not guess for points.',easier:'Ask an adult to read it aloud.',safety:'This is a seated thinking task. No on-ice action is assigned.',diagram:'read'}:DRILLS[id];
   const minutes=[6,6,5,6,4,3][i]+[0,3,4,4,3,1][i]*(path.level-1);
   return {...base,id,offIce:true,minutes,lowImpact:low,skills:WEEKS[week].skills};
 });
 return {id:`${pathId}:${week}:${day}${cycle?`:r${cycle}`:''}`,pathId,week,day,title:WEEKS[week].name,minutes:path.minutes,blocks};
}
/** @typedef {{version:number,cycle?:number,pathId:string,week:number,day:number,sets:Record<string,boolean>,sessions:Array<{id:string,date:string,pathId:string,week:number,day:number}>,checks:Array<{group:string,pathId:string,passed:boolean,note:string,reviewedBy:string,date:string}>,answers:Record<string,{choice:number,correct:boolean}>,safetyStopped:boolean}} TrainingState */
/** @returns {TrainingState} */
export const newTrainingState=()=>({version:1,pathId:'foundation',week:0,day:0,sets:{},sessions:[],checks:[],answers:{},safetyStopped:false});
export function recordSet(state,session,drillId,setIndex) {
 if(state.safetyStopped) throw new Error('Training is paused for safety');
 const drill=session.blocks.find(d=>d.id===drillId);
 if(!drill||!Number.isInteger(setIndex)||setIndex<0||setIndex>=drill.sets) throw new Error('Invalid drill or set');
 const key=`${session.id}:${drillId}:${setIndex}`;
 if(state.sets[key]) return state;
 return {...state,sets:{...state.sets,[key]:true}};
}
export function isDrillDone(state,session,drill) {return Array.from({length:drill.sets},(_,i)=>state.sets[`${session.id}:${drill.id}:${i}`]).every(Boolean);}
export function finishSession(state,session,date=new Date().toISOString()) {
 if(state.safetyStopped||!session.blocks.every(d=>isDrillDone(state,session,d))) throw new Error('Complete each drill before finishing');
 if(state.sessions.some(s=>s.id===session.id)) return state;
 return {...state,sessions:[...state.sessions,{id:session.id,date,pathId:session.pathId,week:session.week,day:session.day}]};
}
export function canAdvance(state) {
 return GROUPS.every(group=>new Set(state.checks.filter(c=>c.pathId===state.pathId&&c.group===group&&c.passed===true&&c.reviewedBy).map(c=>c.date.slice(0,10))).size>=2);
}
export function nextSession(state) {
 const path=PATHS.find(p=>p.id===state.pathId);
 const session=buildSession(state.pathId,state.week,state.day,state.cycle||0);
 if(!state.sessions.some(s=>s.id===session.id)) throw new Error('Finish this session first');
 const day=(state.day+1)%path.days;
 const week=state.week+(day===0?1:0);
 if(week>19) return {...state,week:0,day:0,cycle:(state.cycle||0)+1};
 return {...state,day,week};
}
