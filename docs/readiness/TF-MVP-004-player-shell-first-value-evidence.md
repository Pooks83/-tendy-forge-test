# TF-MVP-004 — Player Shell + First Value Evidence

Date: 2026-09-11  
Authority: `00_START_HERE` v1.4 → Canonical Build Specification v1.4 → Readiness Control Plane v1.4  
Golden journey: GJ-01 — Parent setup → goalie handoff → 60-second challenge → first mission  
Baseline: `d461154`  
Verified package head: `e9af24c`  
Published Version 8: unchanged

## Exit decision

**PASS — TF-MVP-004 code, contract, regression, and available-browser gate.**

Physical iOS and the full six-width device matrix are not claimed here. They remain an explicit TF-MVP-017 release gate.

## Implemented vertical outcome

- Server-authoritative first-value projection for not started, active, elapsed/finishable, completed, safety-stopped, and corrupt persisted state.
- Exact v1.4 player navigation: Today / Journey / Progress / Profile. Legacy `home` and `train` deep links normalize to Today and Journey; Locker is not a P0 destination.
- Today retains one dominant mission action and distinguishes Start, Resume, and Continue from authoritative mission/local completion state.
- First mission start persists as a `MissionInstance`, independently of optional analytics consent.
- Reload after challenge or mission start resolves to the correct challenge/Today/resume state.
- Stable operation keys and server idempotency prevent duplicate challenge completion, mission start, audit events, and product events.
- Safety stop, premature start, revoked relationship, invalid event, cross-context access, and recoverable load failure have defined responses.
- The first Today action enters the first incomplete activity directly; returning to Today shows Resume rather than Start.

## Data and API evidence

New durable tables:

- `product_events`: unique logical event key, pseudonymous account/player context, app/build/config version, constrained metadata.
- `mission_instances`: unique profile + mission key, authoritative status and lifecycle timestamps.

New endpoints:

- `GET/POST /api/mission`: relationship-scoped current mission projection and idempotent start.
- `POST /api/player-event`: allowlisted, relationship-scoped `today_viewed` only.

Extended endpoint:

- `GET/POST /api/first-challenge`: server-derived remaining time, safety state, current mission ID/status after completion.

## Analytics and privacy

- `player_created`, `onboarding_completed`, `today_viewed`, and `mission_started` use unique logical keys.
- Optional analytics allowed: each logical event persists at most once.
- Optional analytics declined: no product event is stored; onboarding, challenge, and mission start still work.
- Routine events contain no nickname, email, exact date of birth, free-text notes, photos, video, or precise location.
- Mission state and essential audit evidence do not depend on analytics consent.
- Event transport, dashboards, alerting, and full observability remain TF-MVP-015 scope.

## Authorization and safety

- All player challenge, mission, and event requests require authenticated adult identity, active player context, and active guardian relationship.
- Client-supplied profile substitution is not accepted.
- Revoked relationships return `RELATIONSHIP_REVOKED` and create no mission.
- Mission start before challenge completion returns `INVALID_STATE_TRANSITION`.
- A safety-stopped profile cannot start or complete the challenge/mission and receives the adult recovery path.
- Origin, content type, request size, action allowlist, and idempotency-key checks are enforced on mutations.

## Verification results

| Gate | Result | Evidence |
|---|---:|---|
| Production build | PASS | Vinext five-stage build completed; `/`, `/api/first-challenge`, `/api/mission`, `/api/player-event`, and existing APIs bundled |
| Full automated regression | PASS | `npm test`: 98/98 tests passed |
| TypeScript | PASS | `npx tsc --noEmit --incremental false`: exit 0 |
| Lint | PASS | 0 errors; 3 pre-existing/generated warnings only |
| Diff hygiene | PASS | `git diff --check`: exit 0; worktree clean |
| Focused GJ-01 | PASS | onboarding → challenge → completion → mission start; reload/retry; analytics allow/deny; safety/revocation |
| Browser access shell | PASS | Fresh preview rendered adult sign-in and sample-session entry; no current application console errors |
| Browser sample Today | PASS | One visible primary CTA; document scroll width equaled client width; no horizontal overflow at 1363 × 936 |
| Independent review | PASS after repair | Reviewer found one Important Today/resume inconsistency; fixed in `e9af24c`; re-review found no Critical/Important issues and returned Ready = Yes |
| Physical iOS / six-width matrix | DEFERRED | Required at TF-MVP-017; not represented as passed |

Lint warnings retained because they are outside this package:

- one unused import in the pre-existing canonical-design generator;
- two unused disable directives in generated Cloudflare declarations.

## Regression coverage

- TF-MVP-003 identity, consent, household, active-player, legacy migration, and child-safe projection tests remain green.
- Training actions, safety persistence, rest recovery, coach evaluation, advancement rules, curriculum coverage, API isolation, and production worker tests remain green.
- Old adult sample navigation remains functional while player navigation uses canonical labels and canonical query names.

## Review correction

Independent review found that an in-progress mission could return to Today with the old “Start today’s training” label. Root cause: the server result was not retained in the shell’s Today resolver. The fix stores the started mission ID in shell state and resolves Today’s CTA from that mission ID plus current activity completion. The affected focused tests, typecheck, full regression, and independent re-review passed.

## Deferred work and exact next dependency

- TF-MVP-005: extend `MissionInstance` to the complete NOT_STARTED → IN_PROGRESS ↔ PAUSED/INTERRUPTED → COMPLETED/ABANDONED state machine and add offline pending/sync reconciliation.
- TF-MVP-006: content eligibility, reviewed activity media, and deterministic mission generation.
- TF-MVP-015: analytics delivery, observability, KPI pipeline, and deployment build-version injection.
- TF-MVP-017: 320/375/390/430/tablet/desktop visual matrix, physical iOS, keyboard, screen reader, contrast, text reflow, and regression hardening.
- Human/legal youth-safety, privacy policy, retention, and parental-consent decisions remain their assigned release gates.

## Rollback

The implementation exists only on isolated branch `tf-mvp-v1-4`. Main and published Version 8 were not changed. The exact pre-package rollback/reference point is `d461154`.

## Exit-criteria trace

| Criterion | Result |
|---|---:|
| No undefined/dead-end GJ-01 branch within package scope | PASS |
| Reload/ambiguous retry without duplicate completion/events | PASS |
| Authorization and active-player context on every request | PASS |
| Today one dominant next action | PASS |
| Exactly four canonical player destinations | PASS |
| Once-only required GJ-01 events when allowed; none when declined | PASS |
| Build/type/lint/regression/diff/independent review | PASS |
| Published runtime unchanged | PASS |

**Next: proceed to TF-MVP-005 — Training State Machine + Offline.**
