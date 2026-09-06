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
  assert.match(html,/I’m a parent or guardian/);
  assert.match(html,/I’m a coach/);
  assert.match(html,/Sign out/);
  assert.doesNotMatch(html,/Main navigation/);
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
