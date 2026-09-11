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
    onPreview:()=>{},onReload:()=>{},onCreated:async()=>{},
  }));
  assert.match(html,/I’M A PARENT/);
  assert.match(html,/I’m a coach/);
  assert.match(html,/Sign out/);
  assert.doesNotMatch(html,/Main navigation/);
});
test('canonical onboarding keeps child data after consent and supports no-equipment planning',async()=>{
  const {OnboardingFlow}=await vite.ssrLoadModule('/components/tendie-forge/onboarding-flow.tsx');
  assert.equal(typeof OnboardingFlow,'function');
  const render=initialStep=>renderToStaticMarkup(React.createElement(OnboardingFlow,{initialStep,signOutLink:React.createElement('a',{href:'/signout'},'Sign out'),onHandoff:async()=>{}}));
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
  const plan=render('training-plan');
  assert.match(plan,/15 minutes/);
  assert.match(plan,/25 minutes/);
  assert.match(plan,/35 minutes/);
  assert.match(plan,/Monday/);
});
test('child first value defines the four canonical screens without rank or tutorial copy',async()=>{
  const {PlayerFirstValueFlow}=await vite.ssrLoadModule('/components/tendie-forge/player-first-value.tsx');
  const player={profile:{id:'p1',nickname:'Goalie',plannedDays:['monday'],missionMinutes:15},training:{revision:0}};
  const render=initialStep=>renderToStaticMarkup(React.createElement(PlayerFirstValueFlow,{player,initialStep,onStartMission:()=>{},onStop:async()=>{}}));
  assert.match(render('goalie-welcome'),/LET’S GO/);
  assert.match(render('first-challenge'),/60-second first challenge/);
  assert.match(render('challenge-active'),/60/);
  const win=render('first-win');
  assert.match(win,/SEE MY FIRST MISSION/);
  assert.doesNotMatch(win,/rank|percentile/i);
  const today=render('first-today');
  assert.match(today,/START MISSION/);
  assert.doesNotMatch(today,/Main navigation/);
});
test('training save feedback exposes the error and reload action, and stays absent without an error',async()=>{
 const {TrainingSaveError}=await vite.ssrLoadModule('/components/goalie-forge/training-app.tsx');
 const html=renderToStaticMarkup(React.createElement(TrainingSaveError,{message:'Progress changed on another device.',onReload:()=>{}}));
 assert.match(html,/role="alert"/);assert.match(html,/Progress changed on another device/);assert.match(html,/<button/);
 assert.equal(renderToStaticMarkup(React.createElement(TrainingSaveError,{message:'',onReload:()=>{}})),'');
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
