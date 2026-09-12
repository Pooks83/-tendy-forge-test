import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test('first-run access shell exposes no inactive player navigation',async()=>{
  const {TrainingApp}=await vite.ssrLoadModule('/components/goalie-forge/training-app.tsx');
  const html=renderToStaticMarkup(React.createElement(TrainingApp,{
    signInLink:React.createElement('a',{href:'/signin'},'Adult sign-in'),
    signOutLink:React.createElement('a',{href:'/signout'},'Sign out'),
  }));
  assert.doesNotMatch(html,/Main navigation/);
  assert.doesNotMatch(html,/Open profile/);
  assert.match(html,/Loading your training/);
});

test('signed-in empty account has complete parent coach and sign-out paths',async()=>{
  const {AccessShell}=await vite.ssrLoadModule('/components/goalie-forge/training-app.tsx');
  assert.equal(typeof AccessShell,'function');
  const html=renderToStaticMarkup(React.createElement(AccessShell,{
    mode:'signed-in',error:'',signInLink:null,
    signOutLink:React.createElement('a',{href:'/signout'},'Sign out'),
    onPreview:()=>{},onReload:()=>{},onCreated:async()=>{},onboardingDraft:null,
  }));
  assert.match(html,/I’M A PARENT/);
  assert.match(html,/I’m a coach/);
  assert.match(html,/Sign out/);
  assert.doesNotMatch(html,/Main navigation/);
});
test('canonical onboarding keeps child data after consent and supports no-equipment planning',async()=>{
  const {OnboardingFlow}=await vite.ssrLoadModule('/components/tendie-forge/onboarding-flow.tsx');
  assert.equal(typeof OnboardingFlow,'function');
  const render=initialStep=>renderToStaticMarkup(React.createElement(OnboardingFlow,{initialStep,initialDraft:null,signOutLink:React.createElement('a',{href:'/signout'},'Sign out'),onHandoff:async()=>{}}));
  const welcome=render('welcome');
  assert.match(welcome,/I’M A PARENT/);
  assert.doesNotMatch(welcome,/Player nickname/);
  assert.doesNotMatch(welcome,/Player navigation/);
  const permission=render('parent-permission');
  assert.match(permission,/Required permission/);
  assert.match(permission,/Optional/);
  const profile=render('create-goalie');
  assert.match(profile,/Player nickname/);
  assert.match(profile,/Catches with/);
  assert.match(profile,/Goalie experience/);
  assert.match(profile,/Under 10/);
  assert.match(profile,/10–12/);
  assert.match(profile,/13–15/);
  assert.match(profile,/16 or older/);
  const gear=render('gear');
  assert.match(gear,/No equipment is required/);
  assert.match(gear,/Clear indoor training area/);
  assert.match(gear,/Confirm the training space/);
  const plan=render('training-plan');
  assert.match(plan,/15 minutes/);
  assert.match(plan,/25 minutes/);
  assert.match(plan,/35 minutes/);
  assert.match(plan,/Monday/);
});
test('Today explains unavailable content and substitutions without internal review detail',async()=>{
 const {MissionUnavailableState,MissionSubstitutionNotice,MissionSafetyHold,AdultSafetyReplacement}=await vite.ssrLoadModule('/components/goalie-forge/training-app.tsx');
 const unavailable=renderToStaticMarkup(React.createElement(MissionUnavailableState,{message:'An adult needs to review your training plan.',onAdult:()=>{}}));
 assert.match(unavailable,/An adult needs to review your training plan/);assert.match(unavailable,/Go to parent area/);assert.equal((unavailable.match(/<button/g)||[]).length,1);assert.doesNotMatch(unavailable,/reviewer|score|weight/i);
 const substitution=renderToStaticMarkup(React.createElement(MissionSubstitutionNotice,{substitution:{id:'wall-reduced',equipment:[],space:['small-indoor'],setup:'Use a clear floor marker instead.'}}));
 assert.match(substitution,/Safe setup change/);assert.match(substitution,/Use a clear floor marker instead/);assert.doesNotMatch(substitution,/reviewer/i);
 const hold=renderToStaticMarkup(React.createElement(MissionSafetyHold,{message:'This activity was withdrawn for safety.',replacement:{activityId:'a',version:2,name:'Reviewed replacement'},onAdult:()=>{}}));
 assert.match(hold,/withdrawn for safety/);assert.match(hold,/Reviewed replacement/);assert.equal((hold.match(/<button/g)||[]).length,1);
 const adult=renderToStaticMarkup(React.createElement(AdultSafetyReplacement,{hold:{message:'Withdrawn.',activityKey:'a',replacement:{activityId:'a',version:2,name:'Reviewed replacement'}},busy:false,onAdopt:()=>{}}));
 assert.match(adult,/Safety replacement required/);assert.match(adult,/Reviewed replacement/);assert.match(adult,/Use reviewed replacement/);assert.equal((adult.match(/<button/g)||[]).length,1);
 const blockedAdult=renderToStaticMarkup(React.createElement(AdultSafetyReplacement,{hold:{message:'Withdrawn.',activityKey:'a',replacement:null},busy:false,onAdopt:()=>{}}));
 assert.match(blockedAdult,/No eligible reviewed replacement is available/);assert.equal((blockedAdult.match(/<button/g)||[]).length,0);
});
test('child first value defines the four canonical screens without rank or tutorial copy',async()=>{
  const {PlayerFirstValueFlow}=await vite.ssrLoadModule('/components/tendie-forge/player-first-value.tsx');
  const player={profile:{id:'p1',nickname:'Goalie',plannedDays:['monday'],missionMinutes:15},training:{revision:0}};
  const render=initialStep=>renderToStaticMarkup(React.createElement(PlayerFirstValueFlow,{player,initialStep,onStartMission:()=>{},onStop:async()=>true,onParent:async()=>{}}));
  assert.match(render('goalie-welcome'),/LET’S GO/);
  assert.match(render('first-challenge'),/60-second first challenge/);
  assert.match(render('challenge-active'),/60/);
  const win=render('first-win');
  assert.match(win,/SEE MY FIRST MISSION/);
  assert.doesNotMatch(win,/rank|percentile/i);
  const today=render('first-today');
  assert.match(today,/START MISSION/);
  assert.doesNotMatch(today,/Main navigation/);
  assert.match(render('safety-stopped'),/GO TO PARENT AREA/);
  const resume=renderToStaticMarkup(React.createElement(PlayerFirstValueFlow,{player,initialStep:'first-today',initialMissionStarted:true,onStartMission:async()=>true,onStop:async()=>true,onParent:async()=>{}}));
  assert.match(resume,/RESUME MISSION/);
  assert.doesNotMatch(resume,/START MISSION/);
});
test('training save feedback exposes the error and reload action, and stays absent without an error',async()=>{
 const {TrainingSaveError}=await vite.ssrLoadModule('/components/goalie-forge/training-app.tsx');
 const html=renderToStaticMarkup(React.createElement(TrainingSaveError,{message:'Progress changed on another device.',onReload:()=>{}}));
 assert.match(html,/role="alert"/);assert.match(html,/Progress changed on another device/);assert.match(html,/<button/);
 assert.equal(renderToStaticMarkup(React.createElement(TrainingSaveError,{message:'',onReload:()=>{}})),'');
});
test('offline mission status distinguishes device storage, sync, conflict, and another goalie',async()=>{
 const {OfflineMissionStatus}=await vite.ssrLoadModule('/components/goalie-forge/training-app.tsx');
 const render=status=>renderToStaticMarkup(React.createElement(OfflineMissionStatus,{status,count:2,onSync:()=>{},onAdult:()=>{}}));
 assert.match(render('pending'),/Saved on this device/);assert.match(render('pending'),/Sync now/);
 assert.match(render('syncing'),/Confirming saved progress/);
 assert.match(render('adult-review'),/adult must review/);assert.match(render('adult-review'),/Adult review/);
 assert.match(render('other-profile'),/belongs to another goalie/);assert.doesNotMatch(render('other-profile'),/Sync now/);
});
test('player activity reload renders controls from authoritative mission state',async()=>{
 const {DrillDetail}=await vite.ssrLoadModule('/components/goalie-forge/training-app.tsx');
 const {Dialog}=await vite.ssrLoadModule('/components/ui/dialog.tsx');
 const {buildSession,newTrainingState}=await vite.ssrLoadModule('/lib/training.mjs');
 const session=buildSession('foundation',0,0,0);const drill=session.blocks[0];
 const base={id:'m1',missionId:session.id,profileContextId:'p1',status:'in-progress',revision:2,currentActivityIndex:0,executionSnapshot:session};
 const render=activity=>renderToStaticMarkup(React.createElement(Dialog,{open:true},React.createElement(DrillDetail,{drill,state:newTrainingState(),session,mission:{...base,activities:[activity]},busy:false,readOnly:false,act:async()=>true,onDone:()=>{},onExit:()=>{},saveError:'',onReload:()=>{}})));
 const ready=render({key:drill.id,ordinal:0,status:'ready',result:null,requiredSets:drill.sets,restSeconds:drill.restSeconds,restRemainingSeconds:0,restCompletedAfterSet:0});
 assert.match(ready,/Start this activity/);assert.match(ready,/Pause and exit/);assert.match(ready,/Use a safe substitution/);assert.doesNotMatch(ready,/I understand—start this drill/);
 const betweenSets=render({key:drill.id,ordinal:0,status:'in-progress',result:{completedSets:1},requiredSets:drill.sets,restSeconds:drill.restSeconds,restRemainingSeconds:0,restCompletedAfterSet:0});
 assert.match(betweenSets,/Start 30-second rest/);
 const resting=render({key:drill.id,ordinal:0,status:'resting',result:{completedSets:1},requiredSets:drill.sets,restSeconds:drill.restSeconds,restRemainingSeconds:20,restCompletedAfterSet:0});
 assert.match(resting,/Rest 20s/);assert.match(resting,/disabled/);
 const busy=renderToStaticMarkup(React.createElement(Dialog,{open:true},React.createElement(DrillDetail,{drill,state:newTrainingState(),session,mission:{...base,activities:[{key:drill.id,ordinal:0,status:'in-progress',result:null,requiredSets:drill.sets,restSeconds:drill.restSeconds,restRemainingSeconds:0,restCompletedAfterSet:0}]},busy:true,readOnly:false,act:async()=>true,onDone:()=>{},onExit:()=>{},saveError:'',onReload:()=>{}})));
 const stopButton=busy.match(/<button[^>]*class="tf-link tf-stop"[^>]*>/)?.[0]||'';assert.ok(stopButton);assert.doesNotMatch(stopButton,/disabled/,'pain Stop remains available while an ordinary save is pending');
});
test('adult authentication starts from server-rendered top-level links',async()=>{
  const {AdultSignInLink,AdultSignOutLink}=await vite.ssrLoadModule('/components/goalie-forge/auth-links.tsx');
  const signIn=renderToStaticMarkup(React.createElement(AdultSignInLink));
  const signOut=renderToStaticMarkup(React.createElement(AdultSignOutLink));
  assert.match(signIn,/href="\/signin-with-chatgpt\?return_to=%2F"/);
  assert.match(signIn,/target="_top"/);
  assert.match(signIn,/Adult sign-in/);
  assert.match(signOut,/href="\/signout-with-chatgpt\?return_to=%2F"/);
  assert.match(signOut,/target="_top"/);
});

test('drill illustration teaches setup, action, and finish in one accessible sequence',async()=>{
  const {DrillMap}=await vite.ssrLoadModule('/components/goalie-forge/drill-map.tsx');
  const html=renderToStaticMarkup(React.createElement(DrillMap,{kind:'wall',name:'Wall ball'}));
  assert.match(html,/Instruction picture/);
  assert.match(html,/1\. Get ready/);
  assert.match(html,/2\. Do the move/);
  assert.match(html,/3\. Finish steady/);
  assert.equal((html.match(/class="tf-map-step"/g)||[]).length,3);
});

test('mobile shell uses safe areas without forcing a minimum document width',async()=>{
  const css=await readFile(path.join(root,'app/training.css'),'utf8');
  const globals=await readFile(path.join(root,'app/globals.css'),'utf8');
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/overflow-x:\s*clip/);
  assert.doesNotMatch(css,/\.tf-map svg\{[^}]*min-width/s);
  assert.doesNotMatch(globals,/body\s*\{[^}]*min-width:\s*320px/s);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.tf-nav button\{[^}]*min-height:54px/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.tf-nav button span\{[^}]*overflow-wrap:anywhere/);
});

test('brand and onboarding use structural classes without dead-shell spacing',async()=>{
  const css=await readFile(path.join(root,'app/training.css'),'utf8');
  assert.match(css,/\.tf-brand-mark\{/);
  assert.match(css,/\.tf-brand-copy\{/);
  assert.doesNotMatch(css,/\.tf-brand>span\{/);
  assert.match(css,/\.tf-access-main\{/);
  assert.match(css,/\.tf-access-app\{/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.tf-access-actions/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});
