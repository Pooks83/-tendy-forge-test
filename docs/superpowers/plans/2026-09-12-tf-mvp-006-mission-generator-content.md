# TF-MVP-006 Mission Generator and Content Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed legacy rotations with a deterministic, explainable mission generator that assigns only eligible, versioned, published activity content and safely blocks assignment when reviewed content is unavailable.

**Architecture:** Keep active mission execution from TF-MVP-005 unchanged and snapshot the generator result at mission start. Add a strict content contract, a pure eligibility/planning engine, and a server-side catalog store. Existing activities become review candidates only; publication requires explicit development and qualified safety-review metadata. The generator accepts future coach focus, ACTIVE priority, re-test and coverage inputs now, but P0 uses safe foundation inputs until their owning work packages persist those objects.

**Tech Stack:** Vinext/React, TypeScript, JavaScript pure-domain modules, Cloudflare Workers/D1, Node test runner.

**Spec:** `project_sources/03-Tendie_Forge_P0_P1_Canonical_Build_Specification_v1_4.docx` sections 09, 10 and 25; `docs/canonical-design/SPECIFICATION.md` flows TRAIN-001/002 and screens SCR-PLAYER-001/SCR-DRILL-001.

## Global Constraints

- Authority order is START HERE v1.4, Canonical Build Specification v1.4, then Readiness Control Plane v1.4; conflicting older 30/45/60-minute design text is superseded by canonical 15/25/35-minute missions.
- Normal mission planning makes zero model calls.
- A normal mission has 3–5 eligible activities; Quick Play is outside this package.
- Eligibility is deny-by-default for publication, age/development, equipment or approved substitution, physical restriction, workload/safety, required space/input, and objective/protocol compatibility.
- Safety/restrictions and recovery/workload outrank coach focus, ACTIVE priority, re-test, coverage, difficulty, variety and Journey packaging.
- At most one child-facing ACTIVE technical priority is accepted as input.
- A 25-minute ACTIVE-priority mission allocates approximately 40–60% of meaningful training time to its mapped intervention, subject to higher-order gates.
- Activity families use Level 1/2/3 prescriptions instead of duplicated activity records.
- Only PUBLISHED versions with both development and safety approval metadata may be assigned.
- Existing unreviewed activity copy is candidate content, not silently grandfathered publication.
- Active and historical mission snapshots remain immutable even if content is later retired; a safety retirement blocks the affected unfinished activity and requires an approved replacement.
- Published Version 8 remains unchanged until the complete launch gate.

---

### Task 1: Versioned content contract and review-gated catalog

**Files:**
- Create: `lib/training-content.mjs`
- Create: `drizzle/0008_training_content.sql`
- Create: `scripts/generate-training-content-seed.mjs`
- Create: `tests/training-content.test.mjs`
- Modify: `tests/schema-contract.test.mjs`

**Interfaces:**
- Produces `CONTENT_VERSION`, `CONTENT_STATUSES`, `validateActivityVersion(value)`, `isPublishedActivity(value)`, `candidateActivityVersions`, and D1 tables `activity_families` / `activity_versions`.
- Each version includes the canonical section-10 fields plus stable family, prescription and review metadata.

- [ ] **Step 1: Write failing contract and schema tests**

```js
assert.ok(engine.candidateActivityVersions.length >= 20 && engine.candidateActivityVersions.length <= 30);
assert.equal(engine.isPublishedActivity({...valid, contentStatus:'PUBLISHED', developmentReview:null}), false);
assert.throws(() => engine.validateActivityVersion({...valid, primaryCues:['one','two','three']}), /primary cues/i);
assert.ok(tables.includes('activity_families'));
assert.ok(tables.includes('activity_versions'));
```

- [ ] **Step 2: Run the focused tests and confirm missing exports/tables fail**

Run: `node --test tests/training-content.test.mjs tests/schema-contract.test.mjs`

- [ ] **Step 3: Add the normalized contract and lifecycle migration**

Use immutable `(activity_id, version)` identity, `family_id`, `payload_json`, lifecycle status, two reviewer identities/timestamps, publication/retirement timestamps, and indexes for published family/version lookup. Validation rejects unknown status, missing required fields, more than two primary cues, empty substitutions, unsupported age bands/levels, unsafe prohibited movement tags, and publication without both reviews.

- [ ] **Step 4: Convert the current 15 activities and at least five additional low-demand/concept candidates to complete versioned records**

Every candidate must contain precise setup, starting position, movement steps, reps/time, rounds, rest, success measure, result unit, plausibility, Level 1/2/3 prescriptions, substitution, safety, pain-stop rule and asset/caption references. Keep all candidates at `DEVELOPMENT_REVIEW` or `SAFETY_REVIEW`; do not fabricate reviewer approval.

- [ ] **Step 5: Add a fail-closed catalog seed generator**

`scripts/generate-training-content-seed.mjs` validates every input record and emits idempotent SQL only for PUBLISHED versions with complete development/safety approval metadata. It exits nonzero when an input claims publication without both reviews, and never promotes candidate status itself.

- [ ] **Step 6: Run focused tests and commit**

Run: `node --test tests/training-content.test.mjs tests/schema-contract.test.mjs`

Commit: `feat: define review-gated training content`

### Task 2: Pure deterministic eligibility engine

**Files:**
- Create: `lib/activity-eligibility.mjs`
- Create: `tests/activity-eligibility.test.mjs`

**Interfaces:**
- Consumes `ActivityVersion` records and `EligibilityContext {ageBand, level, equipment, spaces, physicalRestrictions, safetyStopped, workload, objective, requiredInputs}`.
- Produces `evaluateActivity(activity, context) -> {eligible, prescription, substitution, reasons}` and `eligibleActivities(catalog, context)`.

- [ ] **Step 1: Write a table-driven failing test for every canonical gate**

```js
for (const [change, code] of cases) {
  const result=evaluateActivity({...published,...change.activity},{...safeContext,...change.context});
  assert.equal(result.eligible,false);
  assert.ok(result.reasons.some(reason=>reason.code===code));
}
```

Cover `NOT_PUBLISHED`, `AGE_BLOCKED`, `LEVEL_BLOCKED`, `EQUIPMENT_MISSING`, `SPACE_MISSING`, `PHYSICAL_RESTRICTION`, `SAFETY_STOPPED`, `WORKLOAD_BLOCKED`, `INPUT_MISSING`, `OBJECTIVE_MISMATCH`, plus equipment/space substitution success.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/activity-eligibility.test.mjs`

- [ ] **Step 3: Implement deny-by-default evaluation with stable reason codes**

The engine must never infer missing equipment, space, review, physical-readiness or publication facts. A substitution is eligible only when the substitution itself passes all remaining gates and carries a published target version.

- [ ] **Step 4: Test deterministic output, unknown fields and safety precedence**

Run: `node --test tests/activity-eligibility.test.mjs`

- [ ] **Step 5: Commit**

Commit: `feat: enforce activity eligibility`

### Task 3: Explainable deterministic mission planner

**Files:**
- Create: `lib/mission-generator.mjs`
- Create: `tests/mission-generator.test.mjs`

**Interfaces:**
- Consumes `MissionPlanningContext` with one optional `activePriority`, optional confirmed coach focus, optional due re-test, coverage history, duration 15/25/35, recovery/workload state, and eligible catalog.
- Produces `MissionPlan {missionId, version, source, objective, priorityIds, orderedActivityVersions, durationMinutes, equipment, substitutions, workload, completionRules, rewardRuleVersion, explanation}` or `MissionUnavailable {code, audience, message, nextAction, explanation}`.

- [ ] **Step 1: Write failing deterministic-planning tests**

Assert identical inputs produce deep-equal plans, durations select 3/4/5 activities, unsafe/recovery contexts return one explicit next action, no more than one ACTIVE priority is accepted, a 25-minute priority plan assigns 40–60% meaningful time when eligible, and missing mapped content returns `CONTENT_REVIEW_REQUIRED` rather than unrelated work presented as priority training.

- [ ] **Step 2: Run and confirm missing generator failure**

Run: `node --test tests/mission-generator.test.mjs`

- [ ] **Step 3: Implement stable ranking and tie-breaking**

Rank by the canonical order, then stable family/version ID. Preserve complementary warm-up/recovery work, workload caps and variety history. Do not use randomness, current clock time or a model call in selection.

- [ ] **Step 4: Implement the explanation trace**

Expose selected reason, excluded counts by stable code, substitution decisions, priority time allocation, duration/activity count and the single safe next action. Child projection receives concise stored copy; adult/debug evidence may retain rule codes without private notes.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test tests/mission-generator.test.mjs tests/activity-eligibility.test.mjs`

Commit: `feat: generate explainable missions`

### Task 4: Server catalog and immutable mission-plan integration

**Files:**
- Create: `lib/training-content-store.ts`
- Create: `drizzle/0009_profile_training_space.sql`
- Modify: `lib/mission-store.ts`
- Modify: `lib/identity-contract.mjs`
- Modify: `app/api/mission/route.ts`
- Modify: `tests/mission-api.test.mjs`
- Create: `tests/mission-content-retirement.test.mjs`

**Interfaces:**
- `loadPublishedCatalog(db)` returns validated published versions only.
- Mission GET/start generates from the active server profile’s age band, equipment, mission duration and training state; caller-supplied profile facts are ignored.
- Practice-space eligibility comes only from persisted adult-confirmed profile space IDs. Existing profiles have no inferred space and receive adult plan review until that fact is recorded by the later schedule/profile surface.
- Started mission persists the complete generated plan in `execution_snapshot_json` and its catalog/config version in `content_version`.

- [x] **Step 1: Add failing API tests with explicitly seeded reviewed content**

Cover 15/25/35 outputs, missing equipment substitution, no eligible content, unreviewed content exclusion, start-time snapshot immutability, active mission reload after catalog change, and cross-player/profile-input rejection.

- [x] **Step 2: Run the focused API suite and confirm failure**

Run: `npm run build && node --test tests/mission-api.test.mjs tests/mission-content-retirement.test.mjs`

- [x] **Step 3: Implement catalog loading and mission generation in `mission-store.ts`**

Replace new-mission calls to the legacy `buildSession` rotation. Retain `sessionForMission` only for pre-TF-MVP-006 migration. Return an explainable not-started or unavailable projection; never create empty activity rows.

- [x] **Step 4: Implement retirement behavior**

Ordinary content update/retirement does not rewrite an active snapshot. A version explicitly retired for safety blocks its unfinished activity and returns an approved replacement when one exists; otherwise it returns adult review without deleting acknowledged evidence.

- [x] **Step 5: Run focused integration tests and commit**

Run: `npm run build && node --test tests/mission-api.test.mjs tests/mission-content-retirement.test.mjs`

Commit: `feat: persist generated mission plans`

### Task 5: Today and player-facing unavailable/substitution states

**Files:**
- Modify: `components/goalie-forge/training-app.tsx`
- Modify: `lib/today-state.mjs`
- Modify: `tests/ui-components.test.mjs`
- Modify: `tests/today-state.test.mjs`
- Modify: `tests/gj-02-training-completion.test.mjs`

**Interfaces:**
- Player receives exactly one dominant next action: resume, start eligible mission, rest/recovery, or adult action required.
- Drill renders the exact snapshot prescription and any approved substitution; it never reads a newer catalog version mid-session.

- [ ] **Step 1: Add failing child-state tests**

Cover concise `CONTENT_REVIEW_REQUIRED`, equipment substitution disclosure, safety/recovery dominance, exact 15/25/35-minute label, 3–5 activity count and no child exposure of reviewer identity or internal scoring math.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/today-state.test.mjs tests/ui-components.test.mjs tests/gj-02-training-completion.test.mjs`

- [ ] **Step 3: Render canonical state/copy from the server plan**

Use “An adult needs to review your training plan” when no publishable intervention exists. Substitution copy names what changed and preserves exact dose/safety. Do not add a browse-to-decide catalog or a second CTA.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test tests/today-state.test.mjs tests/ui-components.test.mjs tests/gj-02-training-completion.test.mjs`

Commit: `feat: explain mission eligibility in Today`

### Task 6: Candidate-content review package and TF-MVP-006 evidence

**Files:**
- Create: `docs/readiness/TF-MVP-006-content-review-register.md`
- Create: `docs/readiness/TF-MVP-006-mission-generator-evidence.md`

**Interfaces:**
- Review register lists every candidate version, mapped skill/priority, age/level, equipment/space, substitution, workload, media, development review, safety review and publish decision.
- Evidence maps SCP-004/005/006/013/017/018, GJ-02/GJ-05 and the TF-MVP-006 exit criterion to tests and observed limitations.

- [ ] **Step 1: Generate a complete candidate review register from the validated catalog**

Every missing human review or media asset remains visibly NOT APPROVED. Do not use automated tests as youth-training approval.

- [ ] **Step 2: Run the full release gate**

Run: `git diff --check`

Run: `npm test`

Run: `npx tsc --noEmit --incremental false`

Run: `npm run lint`

- [ ] **Step 3: Run supported browser inspection**

Inspect access/sample, a seeded eligible 15/25/35 mission, substitution, unavailable-content and retired-content recovery. Record console errors and horizontal overflow; leave physical iOS/six-width validation to TF-MVP-017.

- [ ] **Step 4: Perform independent code review**

Review safety precedence, review-gate bypasses, deterministic repeatability, cross-player isolation, snapshot immutability, retirement, substitutions, duration/count, missing-content recovery and AI-call absence. Resolve every material P0/P1 finding and rerun affected gates.

- [ ] **Step 5: Record the truthful exit decision and commit**

TF-MVP-006 implementation may pass when the engine and all recovery paths pass, but launch content remains blocked until a qualified reviewer approves enough candidate versions to provide complete priority coverage and required instructional media. The evidence must not call unreviewed candidates PUBLISHED.

Commit: `docs: record TF-MVP-006 readiness evidence`
