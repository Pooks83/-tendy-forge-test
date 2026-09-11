# TF-MVP-005 Training State + Offline Implementation Plan

> **Authority:** `00_START_HERE` v1.4 → Canonical Build Specification v1.4 → Readiness Control Plane v1.4. This package implements TF-MVP-005 and the interruption/recovery portions of GJ-02/GJ-05. It does not decide content eligibility (TF-MVP-006), award XP/rewards (TF-MVP-007), finish the analytics pipeline (TF-MVP-015), perform the final device matrix (TF-MVP-017), merge, or publish.

## Outcome

Deliver one authoritative, recoverable mission-execution system:

`mission ready → activity preview → active activity → result/rest → next activity → mission complete`

The same logical mission and activity state survives reload, process termination, network loss, duplicate delivery, stale clients, and active-player changes. Completion is terminal and exactly once. Offline UI describes pending work plainly and never treats unsynchronized progress as server-confirmed.

## Architecture contract

- `mission_instances` is the source of truth for mission lifecycle and revision. The legacy `training_profiles.state` remains a compatibility projection during this package; mission mutations update both in one database batch.
- Every started mission stores an immutable execution snapshot and content/config version so a later curriculum release cannot change an active session. TF-MVP-006 will supply reviewed eligible content through this boundary without replacing the execution model.
- Activity lifecycle is represented by child rows keyed by mission and ordinal. Results are structured and schema-validated; free-text child notes are not added.
- Every mutation requires authenticated adult identity, active-player context, explicit mission ID, expected revision, and a stable idempotency key. A request pinned to another child is rejected without writes.
- Client offline persistence is behind a small adapter. The current web implementation stores only opaque IDs, action names, numeric results, revisions, timestamps, and idempotency keys; never nickname, email, consent data, notes, or media.
- Safety stop takes effect locally even while offline and is reconciled before ordinary queued actions. Clearing a safety stop remains an authenticated adult action and is never queued as a child action.
- Mission completion may expose a completion acknowledgement, but no XP, badge, reward ledger, or progression award is created until TF-MVP-007.

### Task 1: Define the canonical pure mission state machine

**Files:**
- Create: `lib/mission-state.mjs`
- Create: `tests/mission-state.test.mjs`

1. Add failing table-driven tests for `NOT_STARTED → IN_PROGRESS ↔ PAUSED/INTERRUPTED → COMPLETED` and `IN_PROGRESS/PAUSED/INTERRUPTED → ABANDONED`.
2. Prove `COMPLETED` and `ABANDONED` are terminal, duplicate completion returns the same result, and invalid transitions produce canonical error codes.
3. Define activity states (`READY`, `IN_PROGRESS`, `RESTING`, `COMPLETED`, `SKIPPED`) and legal order. Require a structured result before activity completion where applicable.
4. Define pure projections for Today (`mission-ready`, `active-resume`, `rest-recovery`, `mission-complete`, `blocked-adult`, `offline-cached`, `loading`, `recoverable-error`).
5. Run `node --test tests/mission-state.test.mjs tests/today-state.test.mjs`.
6. Commit the task.

### Task 2: Persist versioned mission and activity execution atomically

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0006_*.sql`
- Modify: `lib/mission-store.ts`
- Modify: `app/api/mission/route.ts`
- Modify: `tests/schema-contract.test.mjs`
- Create: `tests/mission-api.test.mjs`

1. Add failing schema tests for mission revision, immutable execution snapshot/config version, interruption/abandon timestamps, and uniquely ordered activity instances.
2. Add failing API tests for start/resume, start activity, result, rest, next activity, pause/interruption, abandon, and terminal completion.
3. Add branches for stale revision, duplicate retry, invalid result, wrong mission, premature completion, safety stop, revoked relationship, and active-player mismatch.
4. Implement one validated mutation service whose transaction writes the mission/activity rows, compatibility projection, idempotency record, audit event, and allowed once-only product event together.
5. Return the complete authoritative mission projection after every successful or replayed mutation.
6. Prove an active mission uses its stored snapshot after the underlying curriculum/config changes.
7. Run the focused schema/API tests through the production worker build.
8. Commit the task.

### Task 3: Move player training UI to the authoritative mission API

**Files:**
- Modify: `components/goalie-forge/training-app.tsx`
- Modify: `lib/access-loader.mjs`
- Modify: `lib/today-state.mjs`
- Modify: `app/training.css`
- Modify: `tests/access-loader.test.mjs`
- Modify: `tests/today-state.test.mjs`
- Modify: `tests/ui-components.test.mjs`

1. Add failing tests that reload into the exact active activity/rest state and show one dominant action for every Today state.
2. Replace player-mode drill writes to `/api/player-action` with mission mutations carrying mission ID, expected mission revision, active profile context, and stable operation key. Preserve adult/coach legacy paths until their owning packages migrate them.
3. Make activity start, result, rest, pause/exit, substitution, and pain/safety actions explicit. Remove local-only `started` state.
4. Make pending, saving, confirmed, rejected, and recoverable error feedback distinguishable and accessible.
5. Keep the existing safety guidance and prevent a completed mission from reopening as editable.
6. Run focused component/navigation/access tests.
7. Commit the task.

### Task 4: Add private offline queue and deterministic reconciliation

**Files:**
- Create: `lib/offline-mission-queue.mjs`
- Modify: `components/goalie-forge/training-app.tsx`
- Modify: `app/api/mission/route.ts`
- Modify: `lib/mission-store.ts`
- Modify: `app/training.css`
- Create: `tests/offline-mission-queue.test.mjs`
- Modify: `tests/mission-api.test.mjs`
- Modify: `tests/product-events.test.mjs`

1. Add failing tests for queue serialization, reload recovery, stable idempotency keys, ordered replay, double tap, timeout after server commit, network loss mid-mission, and process termination.
2. Add multi-child tests proving a queued action cannot apply after context changes and remains recoverable only in its original player context.
3. Add safety tests proving an offline pain/stop action immediately blocks local activity, is replayed first, and ordinary queued work cannot pass it.
4. Implement the storage adapter and reconciliation reducer. On failure retain the item with plain-language retry/return-to-adult recovery; on authoritative replay replace local pending state with the server projection.
5. Emit `offline_pending` and `sync_reconciled` once only when analytics is permitted. Do not put operational correctness behind analytics consent.
6. Handle stale revision by fetching authoritative state and classifying the queued action as already applied, safe to retry, or requiring adult review—never by blind last-write-wins.
7. Run focused offline/API/event tests.
8. Commit the task.

### Task 5: Prove GJ-02/GJ-05 interruption and recovery

**Files:**
- Create: `tests/gj-02-training-completion.test.mjs`
- Create: `tests/gj-05-interruption-recovery.test.mjs`
- Create: `docs/readiness/TF-MVP-005-training-state-offline-evidence.md`

1. Prove GJ-02 from mission ready through every activity, rest, terminal completion, completion acknowledgement, and return to Today. Record reward/XP as explicitly deferred to TF-MVP-007.
2. Prove GJ-05 across pause, Back, reload, process termination, offline mutation, reconnect, duplicate retry, missed-week return, stale configuration, safety stop, and active-player switch.
3. Run `npm test`, `npm run build`, `npx tsc --noEmit --incremental false`, `npm run lint`, and `git diff --check`.
4. Inspect the full diff for scope, privacy, authorization, transaction, and migration risks.
5. Request independent review; resolve all Critical/Important findings and repeat affected tests.
6. Inspect the production-equivalent web preview at available representative widths. Mark physical iOS, background/foreground, and native storage behavior as deferred to TF-MVP-017 unless actually verified.
7. Record commands, results, version boundary, rollback point, unresolved human/device gates, and next dependency.
8. Do not merge or publish.

## Exit criteria

- GJ-02 mission execution and GJ-05 interruption/recovery have no undefined P0/P1 branch within TF-MVP-005 scope.
- Mission and activity state are authoritative, revisioned, immutable-by-snapshot, and recoverable after reload/termination.
- Duplicate, stale, and ambiguous retries cannot double-complete a mission, duplicate audit/product events, or award future rewards twice.
- Offline actions carry stable IDs and original player context; cross-child application and blind conflict overwrite are impossible.
- Safety stop is immediate offline and authoritative after reconciliation.
- UI distinguishes pending local work from confirmed server work with a defined retry or adult exit.
- Build, typecheck, lint, focused tests, full regression, diff review, and independent review pass.
- TF-MVP-006 content eligibility and TF-MVP-007 XP/rewards remain explicit dependencies; published Version 8 remains unchanged.
