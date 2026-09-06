# Goalie Forge Onboarding-Shell Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the broken header and every dead first-run control by rendering onboarding and active training as mutually exclusive product shells.

**Architecture:** Extract a testable `AccessShell` and explicit brand primitive from the existing client application. `TrainingApp` keeps identity and data loading, but returns the access shell until a saved/shared profile or explicit sample preview is active; the existing training shell then renders unchanged.

**Tech Stack:** React 19, TypeScript, Vinext/Next-compatible App Router, Node test runner, Vite SSR, Cloudflare Worker/D1, Sites.

**Spec:** `docs/superpowers/specs/2026-09-06-onboarding-shell-repair-design.md`

## Global Constraints

- Do not change the curriculum, authentication provider, organization model, D1 schema, or role authorization rules.
- Do not render player navigation or a profile avatar without an active profile or sample preview.
- Keep Home, Train, Progress, and Profile as the only four active-training destinations.
- Keep the current URL-state adapter, safe-area handling, and 44-pixel touch targets.
- Do not publish until the deployed access shell and active training shell have been visually inspected.

---

### Task 1: Separate access and training shells

**Files:**
- Modify: `components/goalie-forge/training-app.tsx`
- Test: `tests/ui-components.test.mjs`

**Interfaces:**
- Consumes: `signInLink: ReactNode`, `signOutLink: ReactNode`, existing `mode`, `error`, `load`, `preview`, and profile creation callback.
- Produces: exported `AccessShell(props)` and internal `Brand(props)` components; `TrainingApp` returns `AccessShell` while `enabled === false`.

- [ ] **Step 1: Write failing component tests**

Add tests that render `TrainingApp` and `AccessShell` with `renderToStaticMarkup`:

```js
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
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test --test-name-pattern='first-run access shell|signed-in empty account' tests/ui-components.test.mjs
```

Expected: failures because `AccessShell` is not exported and the current server-rendered tree includes `Main navigation`.

- [ ] **Step 3: Implement the shell boundary**

In `training-app.tsx`:

```tsx
function Brand({onHome}:{onHome?:()=>void}) {
  const content=<><span className="tf-brand-mark"><Shield size={23}/></span><span className="tf-brand-copy">GOALIE <b>FORGE</b><small>ST. CLAIR SHORES SAINTS</small></span></>;
  return onHome?<button type="button" onClick={onHome} className="tf-brand">{content}</button>:<div className="tf-brand">{content}</div>;
}

export function AccessShell(props:AccessShellProps) {
  return <main className="tf-app tf-access-app">
    <header className="tf-header tf-access-header"><Brand/><span className="tf-office">At home · Off ice</span></header>
    <section className="tf-access-main" aria-labelledby="access-title">
      <p className="tf-kicker">SCS SAINTS GOALIE DEVELOPMENT</p>
      <h1 id="access-title">Your next save starts here.</h1>
      {/* loading, guest, error, or signed-in EmptyAccount content */}
    </section>
  </main>;
}
```

Pass `signOutLink` into `EmptyAccount` and render it both at the role choice and coach empty state. After all hooks have run in `TrainingApp`, return `AccessShell` when `!enabled`; otherwise render only the existing training shell. Remove the old `!enabled` welcome section and redundant `enabled &&` guards from active screens.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
node --test --test-name-pattern='first-run access shell|signed-in empty account|adult authentication' tests/ui-components.test.mjs
```

Expected: all matching tests pass.

- [ ] **Step 5: Commit the shell boundary**

```bash
git add components/goalie-forge/training-app.tsx tests/ui-components.test.mjs
git commit -m "Fix first-run application shell"
```

### Task 2: Make brand and onboarding responsive

**Files:**
- Modify: `app/training.css`
- Test: `tests/ui-components.test.mjs`

**Interfaces:**
- Consumes: `.tf-access-app`, `.tf-access-header`, `.tf-access-main`, `.tf-brand-mark`, and `.tf-brand-copy` from Task 1.
- Produces: structurally scoped brand styling and responsive access-shell layout.

- [ ] **Step 1: Write failing style regression test**

```js
test('brand and onboarding use structural classes without dead-shell spacing',async()=>{
  const css=await readFile(new URL('../app/training.css',import.meta.url),'utf8');
  assert.match(css,/\.tf-brand-mark\{/);
  assert.match(css,/\.tf-brand-copy\{/);
  assert.doesNotMatch(css,/\.tf-brand>span\{/);
  assert.match(css,/\.tf-access-main\{/);
  assert.match(css,/@media\(max-width:760px\)[^{]*\{[^}]*|\.tf-access-main/);
});
```

- [ ] **Step 2: Run the style test and verify RED**

Run:

```bash
node --test --test-name-pattern='brand and onboarding' tests/ui-components.test.mjs
```

Expected: failure because `.tf-brand > span` still styles both logo children and access-shell selectors do not exist.

- [ ] **Step 3: Implement scoped responsive styles**

Replace `.tf-brand > span` with `.tf-brand-mark`; add `.tf-brand-copy`; center `.tf-access-main` at a readable maximum width; remove bottom-navigation padding from `.tf-access-app`; and at `max-width:760px` use 16-pixel side padding with full-width access-shell primary and secondary actions. Preserve the existing training-shell mobile navigation rules.

- [ ] **Step 4: Run component tests and verify GREEN**

Run:

```bash
node --test tests/ui-components.test.mjs
```

Expected: all component and CSS tests pass.

- [ ] **Step 5: Commit responsive repair**

```bash
git add app/training.css tests/ui-components.test.mjs
git commit -m "Repair onboarding and brand layout"
```

### Task 3: Run the release and live visual gates

**Files:**
- Modify only if a failing gate identifies a root cause.
- Test: `tests/*.test.mjs`

**Interfaces:**
- Consumes: the completed access and training shells.
- Produces: a verified commit and, only after local success, a new saved Sites version.

- [ ] **Step 1: Run the complete local release gate**

```bash
npm run lint
npm exec tsc -- --noEmit
npm run build
node --test tests/*.test.mjs
git diff --check
```

Expected: zero lint errors, successful typecheck/build, zero failed tests, and no whitespace errors.

- [ ] **Step 2: Visually inspect the local or preview access shell**

Confirm the logo and wordmark do not overlap, no inactive navigation is visible, parent setup can be opened and closed, coach empty state can be opened and closed, and Sign out is visible in signed-in empty states.

- [ ] **Step 3: Push and save the exact verified commit**

Push the full `git rev-parse --verify HEAD` commit, package the matching build output, and save a new Goalie Forge Site version without changing its existing custom audience.

- [ ] **Step 4: Publish and inspect the production deployment**

After deployment succeeds, reload the production URL and capture the access shell. Confirm the published DOM and screenshot match Step 2. Inspect recent worker errors.

- [ ] **Step 5: Report actual verification limits**

State exactly which live states were inspected. Do not label profile creation, the active player shell, or coach-with-profile behavior visually verified unless those states were actually exercised in production.
