# TF-MVP-004 Player Shell + First Value Implementation Plan

> **Authority:** `00_START_HERE` v1.4 → Canonical Build Specification v1.4 → Readiness Control Plane v1.4. This package implements only TF-MVP-004 and GJ-01. It does not implement the full TF-MVP-005 training state machine, offline queue, rewards, game analysis, or publishing.

## Outcome

Deliver one independently verifiable vertical journey:

`parent setup → goalie handoff → 60-second challenge → first Today mission`

The player shell has exactly four destinations—Today, Journey, Progress, Profile—and Today exposes one dominant next action. Server state, not local UI history, determines whether first value is new, active, completed, blocked for safety, or ready for the first mission.

## Package boundaries

- Preserve the working TF-MVP-003 identity, relationship, consent, and active-player contracts.
- Preserve the existing deterministic training curriculum until TF-MVP-006.
- Add only the narrow event persistence needed to prove GJ-01's once-only analytics contract. Optional analytics consent remains authoritative; no child nickname, email, date of birth, notes, or media enter events.
- Do not publish. Manual six-width/device verification remains a TF-MVP-017 gate, but automated responsive/accessibility contracts are required here.

### Task 1: Make first-value status a single authoritative server projection

**Files:**
- Modify: `lib/first-challenge-state.mjs`
- Modify: `lib/first-challenge-store.ts`
- Modify: `app/api/first-challenge/route.ts`
- Test: `tests/first-challenge-state.test.mjs`
- Test: `tests/first-challenge-api.test.mjs`

1. Add failing resolver tests for `not-started`, `active`, `completed`, `safety-stopped`, and invalid/stale state.
2. Add API tests proving safety status is returned on GET, remaining time is server-derived, expired active challenges become finishable without inventing completion, revoked relationships fail, and retries preserve the same logical result.
3. Implement a pure first-value resolver and return its projection from the API.
4. Run focused tests: `npm run build && node --test tests/first-challenge-state.test.mjs tests/first-challenge-api.test.mjs`.
5. Commit the task.

### Task 2: Establish a privacy-safe once-only product event ledger

**Files:**
- Create: `drizzle/0004_*.sql`
- Create: `lib/product-event-store.ts`
- Modify: `lib/household-store.ts`
- Modify: `lib/first-challenge-store.ts`
- Modify: `app/api/player-action/route.ts`
- Modify: `tests/schema-contract.test.mjs`
- Modify: `tests/onboarding-api.test.mjs`
- Modify: `tests/first-challenge-api.test.mjs`
- Modify/Create: `tests/product-events.test.mjs`

1. Add failing schema/privacy tests for a unique logical event key, pseudonymous account/player identifiers, build/config versions, and metadata without child PII.
2. Add failing behavior tests proving `player_created`, `onboarding_completed`, `today_viewed`, and `mission_started` each persist at most once when optional analytics is allowed; they persist zero times when it is declined.
3. Implement a minimal `product_events` table and reusable insert-or-ignore statement. Keep delivery/export/observability out of scope for TF-MVP-015.
4. Add event writes to the existing atomic mutations where possible. Use a dedicated idempotent server action for `today_viewed`/`mission_started` only if no authoritative mutation already exists.
5. Run focused schema, onboarding, challenge, and product-event tests.
6. Commit the task.

### Task 3: Reconcile the player shell to the v1.4 four-destination contract

**Files:**
- Modify: `lib/training-navigation.mjs`
- Modify: `components/goalie-forge/training-app.tsx`
- Modify: `app/training.css`
- Modify: `tests/navigation.test.mjs`
- Modify: `tests/ui-components.test.mjs`

1. Add failing tests for exactly Today/Journey/Progress/Profile, canonical query/deep-link handling, back/forward behavior, no Locker tab, and no adult-only controls in player mode.
2. Make canonical destination IDs independent from old internal labels (`Home`/`Train`) and preserve old compatible URLs only as redirects/normalization, not a second navigation model.
3. Ensure Profile offers a clear adult hand-back path; Journey and Progress contain no false rank claims; Today contains exactly one dominant actionable control for its current state.
4. Add automated CSS contracts for 320–430px safe-area behavior, wrapping labels, touch targets, and no forced horizontal width.
5. Run focused navigation and UI tests.
6. Commit the task.

### Task 4: Complete GJ-01 interruption, retry, safety, and first-mission handoff

**Files:**
- Modify: `components/tendie-forge/player-first-value.tsx`
- Modify: `components/goalie-forge/training-app.tsx`
- Modify: `lib/access-loader.mjs`
- Modify/Create: `lib/today-state.mjs`
- Modify: `tests/access-loader.test.mjs`
- Modify: `tests/first-challenge-state.test.mjs`
- Modify: `tests/ui-components.test.mjs`
- Create: `tests/gj-01-first-value.test.mjs`

1. Add a failing end-to-end contract test from completed onboarding through handoff, challenge start, exact 60-second completion, first Today state, and first mission start.
2. Add branches for reload before start, reload while active, retry after ambiguous start/complete response, completed challenge reload, safety stop, adult return, expired/revoked relationship, and recoverable load failure.
3. Implement a pure Today resolver for the GJ-01 states used in this package. Do not implement TF-MVP-005 offline semantics; show an honest recoverable network state instead.
4. Ensure challenge start/finish controls cannot double-submit and all server errors produce a defined retry or adult exit.
5. Make first mission handoff land on Today with the mission as the sole dominant action, then enter the existing first activity without duplicating `mission_started`.
6. Run focused GJ-01 and component tests.
7. Commit the task.

### Task 5: Package verification and evidence

**Files:**
- Create: `docs/readiness/TF-MVP-004-player-shell-first-value-evidence.md`
- Modify: readiness ledger only if the canonical source format permits repository-local evidence without altering the authority files.

1. Run `npm test`.
2. Run `npx tsc --noEmit --incremental false`.
3. Run `npm run lint` and classify generated/pre-existing warnings.
4. Run `git diff --check` and inspect the complete diff for package-boundary violations.
5. Request independent code review for canonical compliance, privacy, authorization, idempotency, and regression risk; resolve every Critical/Important finding and repeat affected tests.
6. Validate the production-equivalent preview at the available phone/desktop viewports. Mark unavailable physical iOS/device checks as deferred to TF-MVP-017, never as passed.
7. Record exact commands/results, security/privacy impact, analytics behavior, rollback commit, unresolved external/human gates, and the next dependency (TF-MVP-005).
8. Do not merge or publish.

## Exit criteria

- GJ-01 has no undefined or dead-end branch within TF-MVP-004 scope.
- First-value and first-mission state survive reload and ambiguous retry without duplicate completion or events.
- Server authorization and active-player context protect every request.
- Today exposes one dominant next action and the player shell exposes exactly four canonical destinations.
- Required GJ-01 events are once-only when optional analytics is permitted and absent when declined.
- Build, typecheck, lint, focused tests, full regression, diff review, and independent review pass.
- Manual physical-device coverage is explicitly deferred to TF-MVP-017; published Version 8 remains unchanged.
