# Goalie Forge MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and privately publish a responsive, local-first Goalie Forge MVP that demonstrates the player, parent, and coach journeys end to end.

**Architecture:** A React/Vinext single-page application keeps persistent demo state in localStorage. A pure JavaScript engine owns deterministic mission, XP, reward, safety, and coaching rules, while presentation components render the role-based product surfaces.

**Tech Stack:** Vinext, React 19, TypeScript, Tailwind CSS v4, shadcn primitives, Lucide icons, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-04-goalie-forge-mvp-design.md`

## Global Constraints

- Build a functional product surface, not a marketing page.
- Keep data local and label prototype-only account/privacy actions honestly.
- No child rankings, social features, ads, purchases, or outcome claims.
- Safety and parent controls override XP, story and coach focus.
- Use semantic controls, visible focus, responsive layout, and 44px minimum mobile targets.
- Preserve the starter's build scripts and add no dependencies.

---

### Task 1: Testable game rules and seeded demo data

**Files:**
- Create: `tests/goalie-engine.test.mjs`
- Create: `lib/goalie-engine.mjs`

**Interfaces:**
- Produces `createInitialState()`, `completeMission(state)`, `applySubstitution(state, activityId)`, `reportSafetyStop(state)`, `setCoachFocus(state, focus)`, and `setCoachLink(state, linked)`.
- Consumed by `app/page.tsx` and the presentation components.

- [ ] **Step 1: Write the failing tests**

```js
test("mission completion caps awarded XP at prescribed mission XP", () => {
  const next = completeMission(createInitialState());
  assert.equal(next.player.xpToday, next.mission.xpCap);
});

test("safety stop blocks physical work and creates parent action", () => {
  const next = reportSafetyStop(createInitialState());
  assert.equal(next.mission.safetyStopped, true);
  assert.equal(next.parentActionRequired, true);
});
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/goalie-engine.test.mjs` and confirm it fails because the engine does not exist.

- [ ] **Step 3: Implement minimal engine behavior**

Seed player, mission, attributes, roster and parent settings. Cap XP at `mission.xpCap`, create a restricted safety signal, support duplicate cosmetic token conversion, and keep state immutable.

- [ ] **Step 4: Verify GREEN**

Run `node --test tests/goalie-engine.test.mjs` and confirm all rules tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/goalie-engine.test.mjs lib/goalie-engine.mjs
git commit -m "feat: add goalie game rules engine"
```

### Task 2: Application state, role shell, and persistence

**Files:**
- Create: `components/goalie-forge/goalie-forge-app.tsx`
- Create: `components/goalie-forge/ui.tsx`
- Modify: `app/page.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes the engine state and transition functions.
- Produces player navigation for Today, Journey, Progress, Locker and Profile; plus Parent and Coach roles.

- [ ] **Step 1: Write a failing rendered-product test**

```js
assert.match(await response.text(), /Goalie Forge/);
assert.match(html, /Start mission/);
```

- [ ] **Step 2: Verify RED**

Run `npm test` and confirm the starter page does not satisfy product-content assertions.

- [ ] **Step 3: Implement the application shell**

Create a client-side coordinator that loads/saves demo state, exposes reset, changes roles, and renders responsive navigation and local-only privacy notice.

- [ ] **Step 4: Verify GREEN**

Run `npm test` and confirm the suite passes.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/goalie-forge/goalie-forge-app.tsx components/goalie-forge/ui.tsx tests/rendered-html.test.mjs
git commit -m "feat: add goalie forge application shell"
```

### Task 3: Player mission, progression, and story experience

**Files:**
- Create: `components/goalie-forge/player-screens.tsx`
- Modify: `components/goalie-forge/goalie-forge-app.tsx`
- Modify: `lib/goalie-engine.mjs`
- Modify: `tests/goalie-engine.test.mjs`

**Interfaces:**
- Consumes engine state and player transitions.
- Produces working Today, Journey, Progress, Locker and Profile screens.

- [ ] **Step 1: Write failing behavior tests**

```js
test("duplicate reward converts to Forge Tokens", () => {
  const state = createInitialState({ ownedRewardIds: ["mask-northstar"] });
  const next = completeMission(state);
  assert.ok(next.player.forgeTokens > state.player.forgeTokens);
});

test("valid activity substitution retains the primary attribute", () => {
  const next = applySubstitution(createInitialState(), "wall-ball");
  assert.equal(next.mission.activities[0].attribute, "Tracking");
});
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/goalie-engine.test.mjs` and confirm failure until reward and substitution transitions are implemented.

- [ ] **Step 3: Implement player flows**

Build a mission player with completion, pause/resume, substitute sheet, safety-report dialog, completion/reward dialog, streak/readiness state, attribute trends, re-test state, chapter nodes, locker cosmetics and profile preferences.

- [ ] **Step 4: Verify GREEN**

Run `npm test` and confirm all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/goalie-forge/player-screens.tsx components/goalie-forge/goalie-forge-app.tsx lib/goalie-engine.mjs tests/goalie-engine.test.mjs
git commit -m "feat: build player training and progression flows"
```

### Task 4: Parent controls and coach console

**Files:**
- Create: `components/goalie-forge/adult-screens.tsx`
- Modify: `components/goalie-forge/goalie-forge-app.tsx`
- Modify: `lib/goalie-engine.mjs`
- Modify: `tests/goalie-engine.test.mjs`

**Interfaces:**
- Consumes parent privacy settings, coach link state, roster and weekly focus transitions.
- Produces interactive Parent and Coach role experiences.

- [ ] **Step 1: Write failing coach and privacy tests**

```js
test("coach focus updates at the next safe mission boundary", () => {
  const next = setCoachFocus(createInitialState(), "Rebound control");
  assert.equal(next.coach.focus, "Rebound control");
  assert.equal(next.mission.nextBoundaryFocus, "Rebound control");
});

test("disconnecting a coach revokes access immediately", () => {
  const next = setCoachLink(createInitialState(), false);
  assert.equal(next.coach.linked, false);
});
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/goalie-engine.test.mjs` and confirm behavior fails until coach-link and focus transitions exist.

- [ ] **Step 3: Implement adult surfaces**

Build parent household/privacy cards, notification and quiet-hour controls, coach link/revoke action, structured export/deletion request notices, weekly summary and safety action. Build coach roster, status filters, goalie detail, focus selection and preset feedback.

- [ ] **Step 4: Verify GREEN**

Run `npm test` and confirm all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/goalie-forge/adult-screens.tsx components/goalie-forge/goalie-forge-app.tsx lib/goalie-engine.mjs tests/goalie-engine.test.mjs
git commit -m "feat: add parent controls and coach console"
```

### Task 5: Visual system, metadata, and release validation

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Produces branded, responsive, accessible presentation and product metadata.

- [ ] **Step 1: Write failing metadata assertions**

```js
assert.match(html, /Goalie Forge/);
assert.match(html, /real-world training game/i);
```

- [ ] **Step 2: Verify RED**

Run `npm test` and confirm metadata assertions fail until product metadata is changed.

- [ ] **Step 3: Implement visual system and metadata**

Replace starter styling with Forge tokens, typography, responsive grid rules, status labels, focus styles, reduced-motion behavior and mobile navigation. Update metadata and concise README product instructions.

- [ ] **Step 4: Validate**

Run `npm test` and `npm run lint`; both must pass before publication.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx tests/rendered-html.test.mjs README.md
git commit -m "feat: polish goalie forge MVP"
```

## Plan review

- Tasks 1–5 cover deterministic product rules, player flows, parent/coach behavior, privacy UI, offline-style state, visual system, metadata, tests and release validation.
- The rules engine is the sole source of truth for game state transitions; UI components receive state and callbacks rather than duplicating rules.
