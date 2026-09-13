# TF-MVP-007 Completion and Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mission completion atomically award duplicate-safe XP, canonical development-attribute credit, one Journey advance, and the once-only `FIRST_SAVE` entitlement.

**Architecture:** A pure progression calculator produces a deterministic completion package from the immutable mission snapshot and terminal activity state. The mission store writes that package, Journey update, audit, and idempotency response in its existing D1 batch; an append-only ledger and relationship-authorized read projection make the server authoritative. The client only renders the persisted projection.

**Tech Stack:** TypeScript/JavaScript, Next/Vinext, Cloudflare Workers and D1, Drizzle schema, React 19, Node test runner, Miniflare.

**Spec:** `docs/superpowers/specs/2026-09-12-tf-mvp-007-completion-progression-design.md`

## Global Constraints

- Rule version is exactly `tf-progression-v1`.
- One completed prescribed minute earns exactly one XP; skipped work earns zero.
- Attribute storage uses integer milli-units and must conserve total XP units.
- Canonical attributes are `TRACKING`, `HANDS`, `BALANCE`, `EXPLOSIVENESS`, `STRENGTH`, `MOBILITY`, `CONDITIONING`, and `MINDSET`.
- Mission completion, Journey advancement, XP, attributes, reward, audit, and idempotency must be one atomic D1 batch.
- `FIRST_SAVE` is awarded once only after positive eligible work and never affects athletic scores.
- No path advancement, streak, plausibility verdict, PR bonus, goalie rating, or legacy backfill is introduced.
- Clients render server results and never calculate progression.
- Real content remains launch-blocked until qualified reviewers approve it and explicitly assign canonical attributes.

---

### Task 1: Pure progression rules and content contract

**Files:**
- Create: `lib/progression.mjs`
- Create: `tests/progression.test.mjs`
- Modify: `lib/training-content.mjs`
- Modify: `lib/mission-generator.mjs`
- Modify: `tests/training-content.test.mjs`
- Modify: `tests/mission-generator.test.mjs`
- Modify: `tests/helpers/training-content-fixture.mjs`

**Interfaces:**
- Produces: `PROGRESSION_RULE_VERSION`, `CANONICAL_DEVELOPMENT_ATTRIBUTES`, `calculateCompletionPackage({missionInstanceId, profileId, snapshot, activities, journey})`.
- Produces: mission snapshot blocks with `developmentAttributeIds: string[]`.
- Consumes: terminal activity statuses and integer `block.minutes` values.

- [ ] **Step 1: Write failing pure-rule tests**

Add literal tests proving that a 15-minute mission with completed blocks of 4 and 6 minutes plus a skipped 5-minute block yields `10 XP`, `10000` attribute units, a `2/3` completion ratio, and deterministic split remainders. Add separate failures for unknown attributes, missing attributes on a completed block, non-terminal activities, and extra result volume.

```js
const result=calculateCompletionPackage({
 missionInstanceId:'mi-1',profileId:'p1',
 snapshot:{blocks:[
  {id:'move',minutes:4,developmentAttributeIds:['BALANCE','EXPLOSIVENESS']},
  {id:'track',minutes:6,developmentAttributeIds:['TRACKING']},
  {id:'mind',minutes:5,developmentAttributeIds:['MINDSET']},
 ]},
 activities:[{key:'move',status:'COMPLETED'},{key:'track',status:'COMPLETED'},{key:'mind',status:'SKIPPED'}],
 journey:{pathId:'foundation',week:0,day:0,cycle:0,daysPerWeek:3,weeksPerCycle:20},
});
assert.equal(result.xp,10);
assert.deepEqual(result.attributeUnits,{BALANCE:2000,EXPLOSIVENESS:2000,TRACKING:6000});
assert.deepEqual(result.journeyAfter,{pathId:'foundation',week:0,day:1,cycle:0});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/progression.test.mjs tests/training-content.test.mjs tests/mission-generator.test.mjs`

Expected: FAIL because the progression module and canonical content field do not exist.

- [ ] **Step 3: Implement the minimal pure calculator**

Implement immutable constants, terminal validation, completed-minute summation, milli-unit allocation in lexical attribute order, and Journey rollover. Return this stable shape:

```js
{
 ruleVersion:'tf-progression-v1',missionInstanceId,profileId,
 completedPrescribedMinutes,skippedPrescribedMinutes,totalPrescribedMinutes,
 completionMultiplier,xp,xpUnits,attributeUnits,
 journeyBefore:{pathId,week,day,cycle},journeyAfter:{pathId,week,day,cycle},
 firstSaveEligible:xp>0,
}
```

Update content validation so a `PUBLISHED` activity requires a non-empty, unique `developmentAttributeIds` list containing only canonical values. Copy this field through `generateMission()` and into generated/replacement snapshot blocks. Test fixtures must add explicit test-only canonical attributes before stamping candidate records as reviewed and published; production candidates remain unapproved.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/progression.test.mjs tests/training-content.test.mjs tests/mission-generator.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 5: Commit the rules boundary**

```bash
git add lib/progression.mjs lib/training-content.mjs lib/mission-generator.mjs tests/progression.test.mjs tests/training-content.test.mjs tests/mission-generator.test.mjs tests/helpers/training-content-fixture.mjs
git commit -m "feat: define authoritative progression rules"
```

### Task 2: Append-only progression schema

**Files:**
- Create: `drizzle/0010_completion_progression.sql`
- Modify: `db/schema.ts`
- Modify: `tests/schema-contract.test.mjs`

**Interfaces:**
- Produces tables: `progression_rule_versions`, `mission_completion_ledger`, `xp_ledger`, `attribute_progress_ledger`, `reward_entitlements`.
- Enforces uniqueness on mission completion, XP logical source, completion/attribute pair, and profile/reward pair.

- [ ] **Step 1: Write the failing migration contract**

Add a schema test that migrates an in-memory database, verifies every exact column, and attempts duplicate inserts for each uniqueness boundary. The test must assert that duplicate `mission_instance_id`, `logical_source`, `(completion_id, attribute_id)`, and `(profile_id, reward_id)` writes fail.

- [ ] **Step 2: Run the schema test and verify RED**

Run: `node --test tests/schema-contract.test.mjs`

Expected: FAIL because the progression tables are absent.

- [ ] **Step 3: Add the migration and Drizzle declarations**

Create the five tables with foreign keys to `training_profiles` and `mission_instances`, integer XP/unit values, JSON Journey snapshots, immutable version IDs, ISO timestamps, and these logical constraints:

```sql
UNIQUE(mission_instance_id)
UNIQUE(logical_source)
PRIMARY KEY(completion_id, attribute_id)
PRIMARY KEY(profile_id, reward_id)
```

Seed `progression_rule_versions` with the exact immutable `tf-progression-v1` JSON config using `INSERT OR IGNORE`.

- [ ] **Step 4: Run the schema test and verify GREEN**

Run: `node --test tests/schema-contract.test.mjs`

Expected: schema tests pass.

- [ ] **Step 5: Commit the persistence boundary**

```bash
git add drizzle/0010_completion_progression.sql db/schema.ts tests/schema-contract.test.mjs
git commit -m "feat: add progression ledgers"
```

### Task 3: Relationship-authorized progress projection

**Files:**
- Create: `lib/progression-store.ts`
- Create: `app/api/progress/route.ts`
- Create: `tests/progress-api.test.mjs`

**Interfaces:**
- Produces: `getProgressProjection(db, identity)`.
- Returns: `{profileContextId, ruleVersion, totalXp, attributes, journey, rewards, recentCompletions, meaning}`.
- Consumes: `getActivePlayer()` relationship enforcement and append-only ledger rows.

- [ ] **Step 1: Write failing endpoint tests**

Use real Miniflare/D1 records to prove an authorized guardian receives only the active profile’s totals, attributes, Journey, entitlements, and recent completion summaries. Prove missing context returns `PLAYER_CONTEXT_REQUIRED`, a revoked relationship is forbidden, and changing active context cannot leak the prior child’s progression.

The successful literal projection must include:

```js
{
 profileContextId:'p1',ruleVersion:'tf-progression-v1',totalXp:10,
 attributes:{BALANCE:2,EXPLOSIVENESS:2,TRACKING:6},
 rewards:[{id:'FIRST_SAVE',awardedAt:'2026-09-13T12:00:00.000Z'}],
 meaning:'Development work only — not a goalie ability or game-performance score.'
}
```

- [ ] **Step 2: Build and run endpoint tests to verify RED**

Run: `npm run build && node --test tests/progress-api.test.mjs`

Expected: FAIL with `/api/progress` missing.

- [ ] **Step 3: Implement the server projection and route**

Use `getActivePlayer(db, identity)` before any ledger query. Sum integer XP and attribute milli-units in SQL, divide attribute units by 1000 only in the response, order rewards/completions deterministically, send `Cache-Control: no-store`, and reuse canonical error envelopes. Return no account email, adult notes, consent detail, or other profile data.

- [ ] **Step 4: Build and run endpoint tests to verify GREEN**

Run: `npm run build && node --test tests/progress-api.test.mjs`

Expected: all progress endpoint tests pass.

- [ ] **Step 5: Commit the read boundary**

```bash
git add lib/progression-store.ts app/api/progress/route.ts tests/progress-api.test.mjs
git commit -m "feat: expose child-safe progress projection"
```

### Task 4: Atomic mission completion package

**Files:**
- Modify: `lib/mission-store.ts`
- Create: `tests/mission-progression-api.test.mjs`
- Modify: `tests/mission-api.test.mjs`
- Modify: `tests/gj-02-training-completion.test.mjs`

**Interfaces:**
- Consumes: `calculateCompletionPackage()` from Task 1.
- Produces: completion responses with `completionSummary` and terminal mission projections that retain it on reload.
- Writes: mission, activity, profile Journey, completion, XP, attributes, optional `FIRST_SAVE`, audit, analytics, and idempotency statements in one batch.

- [ ] **Step 1: Write failing integration tests**

With reviewed published fixture content, complete a real mission through the API and assert:

- credited XP equals completed prescribed minutes;
- a skipped activity contributes zero;
- Journey advances once, including week and cycle rollover cases;
- the path ID never changes;
- one completion, one XP logical source, conserved attribute units, and one `FIRST_SAVE` entitlement exist;
- same-key replay and different-key duplicate completion do not add rows or advance again;
- a zero-XP all-skipped terminal mission records history but no reward;
- a completed activity missing canonical attributes returns `PROGRESSION_CONFIG_REQUIRED` and changes no table;
- a forced conditional-write failure changes no mission, profile, progression, audit, or idempotency row;
- historical legacy missions are returned as `LEGACY_UNCREDITED` without backfill.

- [ ] **Step 2: Build and run mission progression tests to verify RED**

Run: `npm run build && node --test tests/mission-progression-api.test.mjs tests/mission-api.test.mjs tests/gj-02-training-completion.test.mjs`

Expected: FAIL because completion currently writes no progression package.

- [ ] **Step 3: Integrate calculation before the terminal transition write**

For `complete-mission`, validate and calculate from the immutable snapshot before preparing SQL. Update `legacyProjection()` so the terminal transition receives the calculator’s `journeyAfter`, while retaining existing sets, rests, answers, checks, evaluations, safety state, and session history. Add completion/XP/attribute/reward statements only for eligible generated missions. Persist the returned completion summary in the idempotency response and load it for later mission GETs.

Use conditional `INSERT ... SELECT ... WHERE` statements tied to the same mission/profile revision conditions as the existing updates. After `db.batch`, verify every mandatory result’s `meta.changes`; any missing change is a stale atomic failure. Treat a unique collision as an authoritative already-completed read, never as a second award.

- [ ] **Step 4: Build and run mission progression tests to verify GREEN**

Run: `npm run build && node --test tests/mission-progression-api.test.mjs tests/mission-api.test.mjs tests/gj-02-training-completion.test.mjs`

Expected: all focused mission tests pass.

- [ ] **Step 5: Commit the atomic write boundary**

```bash
git add lib/mission-store.ts tests/mission-progression-api.test.mjs tests/mission-api.test.mjs tests/gj-02-training-completion.test.mjs
git commit -m "feat: award progression atomically"
```

### Task 5: Server-rendered progression experience

**Files:**
- Modify: `components/goalie-forge/training-app.tsx`
- Modify: `app/training.css`
- Modify: `tests/ui-components.test.mjs`
- Modify: `tests/gj-02-training-completion.test.mjs`

**Interfaces:**
- Consumes: `/api/progress` projection and mission `completionSummary`.
- Produces: a Progress screen and completion acknowledgement that contain no client-side award calculations.

- [ ] **Step 1: Write failing UI behavior tests**

Render exported progression components with literal projections and prove:

- total XP and all eight named development attributes are rendered from props;
- the screen says development work is not an ability or game-performance score;
- `FIRST_SAVE` renders only when present in the entitlement list;
- completion shows exact XP, skipped-minute explanation, Journey movement, and only a newly awarded reward;
- zero-XP completion states that skipped work saved but earned no XP;
- no “goalie rating,” client formula, or pre-TF007 placeholder copy appears.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test tests/ui-components.test.mjs tests/gj-02-training-completion.test.mjs`

Expected: FAIL because the Progress UI still uses legacy session counts and placeholder progression copy.

- [ ] **Step 3: Implement projection loading and rendering**

Add `fetchProgressProjection()` beside the existing player/mission fetch helpers. Load it only in player mode, clear it on context exit/switch, and render explicit loading, retry, empty, populated, and zero-XP completion states. Keep skill-accomplishment evidence separate from development attributes. Use existing cards, progress primitives, spacing, focus, safe-area, and responsive patterns; add only progression-specific layout selectors.

- [ ] **Step 4: Run UI tests and verify GREEN**

Run: `node --test tests/ui-components.test.mjs tests/gj-02-training-completion.test.mjs`

Expected: all focused UI tests pass.

- [ ] **Step 5: Commit the UI boundary**

```bash
git add components/goalie-forge/training-app.tsx app/training.css tests/ui-components.test.mjs tests/gj-02-training-completion.test.mjs
git commit -m "feat: render authoritative progression"
```

### Task 6: Regression, evidence, and control-plane handoff

**Files:**
- Create: `docs/readiness/TF-MVP-007-completion-progression-evidence.md`
- Modify only if a verified regression requires it: files already named in Tasks 1–5

**Interfaces:**
- Produces: reproducible readiness evidence with engineering verdict and separate launch blockers.

- [ ] **Step 1: Run the complete release gate**

Run each command fresh:

```bash
npm test
npx tsc --noEmit
npm run lint
git diff --check
```

Record exact pass/fail counts, exit codes, build route list, and warnings. Do not convert known generated-environment warnings into source errors.

- [ ] **Step 2: Inspect the production-equivalent progression journey**

Use the built Miniflare worker to create a profile, establish active context, start and complete a reviewed-fixture mission, reload `/api/progress`, replay completion, switch profiles, and verify D1 row counts. Record actual request statuses and ledger counts.

- [ ] **Step 3: Perform the TF-MVP-007 coverage audit**

Check every design exit criterion against a test or direct query. Explicitly list unresolved human content/safety review, authentication feasibility, physical-restriction persistence, real-device responsive review, streak inputs, plausibility thresholds, and TF-MVP-008 PR dependencies as separate blockers.

- [ ] **Step 4: Write and verify the readiness evidence**

The evidence document must include authority/dependencies, exact implementation commit range, schema and API contracts, rule examples, atomicity/idempotency evidence, authorization evidence, legacy handling, verification outputs, exit verdict, and launch-blocker status. Run `git diff --check` and inspect the document before claiming completion.

- [ ] **Step 5: Commit the evidence checkpoint**

```bash
git add docs/readiness/TF-MVP-007-completion-progression-evidence.md
git commit -m "docs: record TF-MVP-007 readiness evidence"
```

- [ ] **Step 6: Stop before integration or publication**

Report the TF-MVP-007 engineering exit verdict and remaining launch blockers. Do not merge, push, publish, or modify Version 8 without a separate explicit authorization after branch-finishing review.
