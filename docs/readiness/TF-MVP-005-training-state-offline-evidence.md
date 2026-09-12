# TF-MVP-005 — Training State Machine + Offline Evidence

Date: 2026-09-12  
Authority: `00_START_HERE` v1.4 → Canonical Build Specification v1.4 → Readiness Control Plane v1.4  
Work package: TF-MVP-005 — Training State + Offline  
Golden journeys: GJ-02 daily-development execution and GJ-05 continuity/interruption  
Pre-package reference: `0940f0a`  
Implementation checkpoint: `d873ce1`  
Verified recovery checkpoint: `1e474d2`  
Published Version 8: unchanged

## Exit decision

**PASS — TF-MVP-005 implementation, automated evidence, production-equivalent build, and available-browser gate.**

This is not a claim that all of GJ-02 is launch-complete. TF-MVP-007 still owns the atomic XP/reward/progression ledger, so the current completion acknowledgement deliberately awards no XP, badge, or progression. TF-MVP-006 still owns reviewed content eligibility and mission generation. Physical iOS termination/background behavior and the six-width matrix remain TF-MVP-017 gates.

## Canonical outcome delivered

- Mission lifecycle: `NOT_STARTED → IN_PROGRESS ↔ PAUSED/INTERRUPTED → COMPLETED`, with `ABANDONED` from an active/paused mission and terminal completion/abandonment.
- Ordered activity lifecycle: Ready → In progress → structured result → required rest → completed or controlled substitution.
- One authoritative mission instance per profile/mission and no second active mission for a profile.
- Immutable execution snapshot and content version pinned when the mission starts; later curriculum/profile movement does not rewrite active work.
- Revision-checked mission and profile writes with stable idempotency records, audit records, and once-only product events.
- Reload restores the exact current activity, completed sets, minimum-rest checkpoint, pause/interruption state, and mission snapshot.
- A privacy-minimized device queue stores only pseudonymous IDs, action, numeric result, revision, allowlisted reason, timestamp, priority, and idempotency identity.
- Pending actions retain their original profile context. Another goalie context cannot read, apply, or blindly overwrite them.
- Safety stop takes effect locally, outranks ordinary queued work, becomes authoritative after acknowledgement, and cannot be cleared by a player action.
- Network/5xx failures are retryable; canonical 4xx conflicts are not mislabeled as offline success.
- Stale reconciliation distinguishes already applied, safe rebase, and adult review. It never uses last-write-wins.
- UI copy distinguishes “stored on this device” from confirmed server progress and provides Sync now or Adult review recovery.

## Data and API mapping

| Contract | Implementation | Evidence |
|---|---|---|
| Mission execution | `mission_instances` revision, status, lifecycle timestamps, `content_version`, immutable `execution_snapshot_json` | schema contract; mission API start/reload tests |
| Activity execution | `activity_instances` unique ordinal/key, structured `result_json`, rest checkpoint and lifecycle timestamps | schema contract; ordered activity/rest tests |
| Optimistic concurrency | mission revision + training-profile revision in conditional batch writes | stale/concurrent mutation tests |
| Idempotency | account + operation key + operation record, replayed authoritative response | mutation replay, terminal completion and lost-response tests |
| Legacy continuity | first GET hydrates legacy sets/rest/answer into versioned execution rows once | legacy mission migration test |
| Offline queue | `offline-mission-queue.mjs` strict allowlist, stable key, priority, projection and reconciliation | offline queue and GJ-05 tests |
| Request classification | `mission-request.mjs` preserves canonical codes; only network/5xx retry automatically | mission request tests |
| Player context | server active-player relationship plus request profile match | wrong-context/revoked tests; queue context tests |

Migrations added by this package:

- `drizzle/0006_training_execution.sql`
- `drizzle/0007_activity_rest_checkpoint.sql`

Extended endpoint:

- `GET /api/mission` returns the current authoritative mission projection or a not-started projection.
- `POST /api/mission` accepts only the declared lifecycle actions, same-origin JSON, valid idempotency key, active profile context, expected revision, and a validated optional offline identity pair.

## Golden-journey evidence

### GJ-02 — Daily development within TF-MVP-005 scope

Proven sequence:

1. Mission ready/start.
2. Current activity start.
3. One ordered result per listed set.
4. Exact minimum rest between sets and rest recovery after reload.
5. Reading answer stored while correctness is derived by the server.
6. Current activity completion and next-activity unlock.
7. All activities complete once.
8. Mission completion becomes terminal and a duplicate returns the existing result.
9. Today resolves to mission complete and the user can acknowledge/return.
10. No XP/reward is fabricated before TF-MVP-007.

The current product does not claim GJ-02 reward/progression completion; that dependency is explicit and visible in the completion copy.

### GJ-05 — Continuity

| Branch | Result |
|---|---:|
| Pause and Back | PASS — acknowledged progress retained; Today exposes Resume |
| Reload/browser refresh | PASS — current activity, set result, rest, mission status and snapshot restore |
| Process termination contract | PASS (web storage adapter) — strict queue serializes/restores with stable identity |
| Network loss mid-action | PASS — local projection and pending-device status |
| Reconnect | PASS — ordered authoritative replay |
| Duplicate/lost response | PASS — same operation key returns existing server result/events |
| Stale revision | PASS — already-applied, safe-retry/rebase, or adult-review; no blind overwrite |
| Missed week | PASS — old active mission remains the next resumable action; elapsed time does not abandon or advance it |
| Stale content/config | PASS — active mission uses its start-time immutable snapshot/version |
| Offline safety stop | PASS — immediate local interruption, queue priority, authoritative once reconciled |
| Active-player switch | PASS — mismatched queue remains isolated and directs the adult back |
| Offline remains unavailable | PASS — queue retained; UI says device-only and offers retry/adult exit |

## Privacy, authorization, safety and analytics

- Device queue rejects unknown item/body/result fields and non-allowlisted reasons. It contains no nickname, email, consent, coach note, media, exact birth date, or location.
- Every server read/write still requires an authenticated adult, active player context, and an active guardian relationship.
- Request profile context must equal the server active profile; revoked or cross-household requests make no mission/activity write.
- Safety stop is immediate in the loaded client even if the request fails. Reconciliation sends safety before ordinary work and leaves any unsafe conflict for adult review.
- Clearing safety remains an authenticated adult action; it is not an offline player mutation.
- `offline_pending` and `sync_reconciled` emit only after successful authoritative reconciliation when optional analytics is allowed.
- Each offline logical event uses a unique pseudonymous key and metadata limited to mission ID, action, and queued seconds.
- Retry does not duplicate those events. Declined analytics stores none and never blocks operational sync.

## Verification results

| Gate | Result | Evidence |
|---|---:|---|
| Production build | PASS | Vinext five-stage build completed; all application/API routes bundled |
| Full automated regression | PASS | `npm test`: 134/134 tests passed |
| Focused GJ-02/GJ-05 | PASS | 5/5 named journey tests plus mission API/queue/request/component suites |
| TypeScript | PASS | `npx tsc --noEmit --incremental false`: exit 0 |
| Lint | PASS | 0 errors; 3 pre-existing/generated warnings only |
| Diff hygiene | PASS | `git diff --check`: exit 0 |
| Browser access shell | PASS | Supported preview rendered sign-in/sample entry without application console error |
| Browser sample mission | PASS | Today and activity dialog rendered; document width equaled viewport width at 1363 px |
| Physical iOS / six-width matrix | DEFERRED | TF-MVP-017; not represented as passed |
| Independent code review | PASS | Two review rounds closed all Critical/Important findings; final rereview found no material P0/P1 issue |

Retained lint warnings are outside this package: one unused import in the pre-existing canonical-design generator and two unused disable directives in generated Cloudflare declarations.

### Independent-review corrections

| Finding | Root correction | Regression evidence |
|---|---|---|
| Emergency Stop was disabled during an ordinary in-flight save | Stop remains available, interrupts locally, enters the safety-priority queue, and is re-projected over a late ordinary response | component busy/Stop contract; GJ-05 offline safety branch |
| Same key could be reused for a different mutation payload | Server idempotency binds the semantic action, mission/profile context, activity, result, reason, queue timestamp and offline identity | changed-result replay returns `DUPLICATE_REQUEST` |
| Safety stop could be rejected after an ordinary interruption | Safety transition is valid and idempotent from `INTERRUPTED` and remains adult-cleared | mission lifecycle and authoritative safety API tests |
| An abandoned mission exposed an action that deterministically failed | Today resolves abandonment to a locked adult recovery state and no drill action | mission resolver and UI component tests |
| A rebased offline request could become ambiguous if its response was lost or the app terminated | Revision is treated as a concurrency precondition, not semantic operation identity; safe rebase preserves the operation key and server replay | rebased request retention plus revision-independent server replay tests |

## Scope and change-control boundaries

Not implemented here:

- TF-MVP-006 mission generator, 20–30 reviewed activity families, eligibility filtering, substitutions/content retirement and human safety review.
- TF-MVP-007 completion transaction’s XP, eight attributes, Journey movement, deterministic reward and anti-grind/plausibility ledgers.
- TF-MVP-015 production event delivery, dashboards, alerting and operational observability.
- TF-MVP-017 physical iOS background/foreground/termination, native storage, small/current/large iPhones, VoiceOver, Dynamic Type and full responsive/accessibility regression.
- Merge, push, publish or any change to existing Version 8.

## Rollback and runtime boundary

All work remains on isolated branch `tf-mvp-v1-4`. The exact pre-package rollback/reference point is `0940f0a`. Reverting the TF-MVP-005 commit range restores the verified TF-MVP-004 source. Main, the Sites project access policy, and published Version 8 were not changed.

## Exit-criteria trace

| TF-MVP-005 criterion | Result |
|---|---:|
| GJ-02 execution and GJ-05 continuity have no undefined P0/P1 branch in package scope | PASS |
| Mission/activity state authoritative, revisioned, snapshot-pinned and reload recoverable | PASS |
| Duplicate/stale/ambiguous retry cannot double-complete or duplicate current audit/product events | PASS |
| Offline stable identity and original player context; no cross-child/blind overwrite | PASS |
| Safety stop immediate offline and authoritative after reconciliation | PASS |
| Pending local vs confirmed server UI with retry/adult exit | PASS |
| Build/type/lint/focused/full/diff/browser gates | PASS within available environment |
| Independent review | PASS — final rereview found no material P0/P1 issue |
| TF-MVP-006/007 dependencies explicit; Version 8 unchanged | PASS |

**Next dependency: TF-MVP-006 — Mission Generator + Content Eligibility.**
