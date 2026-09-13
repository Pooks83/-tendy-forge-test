# TF-MVP-007 Completion and Progression Evidence

Date: 2026-09-13  
Authority: `00_START_HERE` v1.4 → Canonical Build Specification v1.4 → Readiness Control Plane v1.4  
Work package: TF-MVP-007 — Completion + Progression  
Dependencies: TF-MVP-005 and TF-MVP-006  
Golden journey: GJ-02 daily development  
Canonical capabilities: SCP-009 mission completion transaction, SCP-010 development XP + eight attributes, SCP-011 Journey + deterministic rewards  
Pre-package reference: `7f91fa9`  
Implementation checkpoints: `94160a8`, `da1e660`, `5f14f95`, `6e3229e`, `0dbc0b6`, `fd2096d`  
Published Version 8: unchanged

## Exit decision

**PASS — the TF-MVP-007 engineering exit criterion “Duplicate-safe projections” is satisfied.**

The completion transaction validates terminal mission state, records completion, awards capped XP and attribute progress, moves Journey state, grants the first deterministic reward, creates audit/idempotency evidence, and returns the authoritative projection exactly once. A duplicate or concurrent completion cannot create a second award.

**LAUNCH REMAINS BLOCKED.** The real candidate activity catalog still has no human-approved development/safety content or reviewed production media. Candidate activities also require explicit canonical development-attribute assignments before publication. Physical iOS, accessibility, and six-width visual certification remain later release gates.

This decision does not authorize merging, pushing, seeding candidate content as reviewed, or publishing a new runtime.

## Canonical progression contract

- Rule version: `tf-progression-v1`.
- XP represents completed prescribed development work, not goalie ability, game performance, mastery, or rank.
- One completed prescribed minute awards one XP under the stored coefficient of `1.0`.
- A skipped activity awards zero XP and zero attribute progress.
- Optional result volume cannot increase the completion multiplier or exceed the prescribed cap.
- Partial completion credit equals completed prescribed minutes divided by total prescribed minutes.
- Attribute progress is distributed only to explicit reviewed canonical attributes on each activity snapshot.
- Canonical attributes are Tracking, Hands, Balance, Explosiveness, Strength, Mobility, Conditioning, and Mindset.
- Attribute allocation uses integer milli-units, conserves the entire credited amount, and assigns indivisible remainders in deterministic lexical order.
- A valid mission completion advances Journey day, then week, then cycle. It never changes the development path.
- An all-skipped mission advances the schedule but awards no XP, attributes, or First Save reward.
- The first completion with positive credited work grants `FIRST_SAVE` once per player.
- Existing pre-TF-MVP-007 mission snapshots without canonical attribute metadata complete as `LEGACY_UNCREDITED`; no historical progression is invented.
- Missing or invalid progression configuration fails closed with `PROGRESSION_CONFIG_REQUIRED` and no partial write.

## Data, transaction, and API mapping

| Contract | Implementation | Evidence |
|---|---|---|
| Versioned rule | `progression_rule_versions` stores immutable config for `tf-progression-v1` | migration and schema contract tests |
| Completion ledger | one `mission_completion_ledger` row per mission instance | unique-index and duplicate-completion tests |
| XP ledger | one logical XP source per completion | unique-index and concurrent replay tests |
| Attribute ledger | one row per completion and canonical attribute in integer milli-units | conservation and schema tests |
| Reward entitlement | primary key `(profile_id, reward_id)` | repeated First Save test |
| Atomic completion | mission/profile/ledger/reward/audit/idempotency writes share one D1 batch | injected constraint failure rolls back the entire package |
| Authoritative projection | `GET /api/progress` derives totals, eight attributes, Journey, rewards, and recent history from server state | progress API tests |
| Active-child authorization | progress read resolves the server active player and current relationship | cross-child and revoked-relationship tests |
| Immutable activity attribution | mission snapshot carries explicit `developmentAttributeIds` | generator/content/progression tests |
| Legacy boundary | snapshots without reviewed canonical attributes are recorded as uncredited legacy completion | legacy completion integration test |

Migration added by this package:

- `drizzle/0010_completion_progression.sql`

Endpoint added:

- `GET /api/progress` returns only the authenticated account's server-authoritative active-player projection.

Extended endpoint:

- `POST /api/mission` completion now returns a persisted `completionSummary` and performs the complete progression transaction.

## Exit-criteria evidence

| TF-MVP-007 criterion | Result | Evidence |
|---|---:|---|
| Dependencies TF-MVP-005 and TF-MVP-006 retained | PASS | full regression preserves mission lifecycle, offline reconciliation, eligibility, generation, snapshots, and safety stops |
| Completion is authoritative and terminal | PASS | incomplete activities are rejected; valid completion persists once; later reads return the stored result |
| XP is capped at prescribed work | PASS | completed minutes earn once; skips and extra recorded volume earn zero additional XP |
| Eight-attribute projection is deterministic | PASS | canonical set always returned; milli-unit allocation conserves credited work with stable remainder order |
| XP cannot be represented as goalie ability | PASS | API meaning contract and UI regression prohibit ability/rating language |
| Journey advances exactly once without changing path | PASS | day/week/cycle boundary tests and end-of-program rollover integration test |
| Deterministic reward is once-only | PASS | First Save requires positive credited work and unique player entitlement |
| Duplicate/concurrent completion cannot duplicate awards | PASS | completion, XP, attribute, reward, audit, event, and idempotency assertions |
| Transaction failure cannot partially award progress | PASS | forced D1 trigger failure leaves mission, Journey, XP, attributes, reward, audit, and idempotency unchanged |
| Active-player projection cannot leak another child | PASS | same-household cross-child and revoked-relationship tests |
| Legacy data does not receive invented progression | PASS | `LEGACY_UNCREDITED` completion leaves XP/reward/Journey unchanged |
| Loading, error, empty, zero-XP, reward, and offline feedback are explicit | PASS | server-rendered progression component tests |
| Deterministic-first / no model dependency | PASS | progression rule, store, endpoint, and UI contain no model or inference call |
| Production build, full regression, type, lint, and diff gates | PASS | exact results below |

## Golden-journey evidence

### GJ-02 within TF-MVP-007 scope

1. The player completes or safely skips every ordered prescribed activity.
2. The server rejects premature completion and validates the immutable mission snapshot.
3. The server calculates credited/skipped prescribed minutes and the bounded completion multiplier.
4. One transaction writes completion, XP, attributes, Journey movement, eligible reward, audit, event, and idempotency evidence.
5. The response renders exact earned XP, skipped time, attribute progress, Journey destination, and any new reward.
6. Reload derives the same projection from append-only ledgers.
7. Repeated or concurrent completion returns the original result without another award.
8. A forced write failure produces no partial completion or progression.

### Adversarial branches

| Branch | Result |
|---|---:|
| Double tap / same operation retry | PASS — original authoritative response replays |
| Different-key concurrent completion | PASS — stored first completion is returned; no second ledger package |
| Incomplete activity | PASS — completion rejected with no write |
| All activities skipped | PASS — zero XP/attributes/reward; schedule advances once |
| Extra recorded attempts/repetitions | PASS — no XP above prescribed minutes |
| Missing canonical attribute assignment | PASS — fails closed; no partial write |
| Forced database constraint failure | PASS — entire transaction rolls back |
| Same account requests another child | PASS — server active context controls projection |
| Revoked relationship | PASS — access denied and no projection leak |
| Old mission snapshot | PASS — completion retained as uncredited legacy history |
| End of week/cycle | PASS — deterministic rollover; path unchanged |
| Offline completion feedback | PASS at web queue boundary — UI distinguishes pending sync from confirmed award |

## Verification results

| Gate | Result | Evidence |
|---|---:|---|
| Production-equivalent build | PASS | Vinext five-stage build completed; `/api/progress` and all existing routes bundled |
| Full automated regression | PASS | `npm test`: 177/177 tests passed |
| Focused activity eligibility | PASS | 5/5 tests passed after aligning the test publication fixture with the canonical attribute contract |
| Focused progression UI | PASS | 17/17 component tests passed |
| TypeScript | PASS | `npx tsc --noEmit`: exit 0 |
| Lint | PASS | 0 errors; 3 unrelated pre-existing/generated warnings |
| Diff hygiene | PASS | `git diff --check`: exit 0 |
| Base-to-head code review | PASS (self-review) | no unresolved P0/P1 finding across authorization, transaction, idempotency, rollback, legacy, projection, or UI contracts; independent agent review was not performed because delegation was not authorized in this session |
| Browser/device visual inspection | UNVERIFIED | available cloud browser cannot reach the local production worker; no unsafe public tunnel used |
| Physical iOS / six-width matrix | DEFERRED | TF-MVP-017 release gate |
| Human content, media, and safety review | BLOCKED | 0/23 candidate activities approved |

Retained lint warnings are outside this package: one unused import in the pre-existing canonical-design generator and two unused disable directives in generated Cloudflare declarations.

## Launch blockers and owning work

| Blocker | Classification | Required next action / owner |
|---|---|---|
| Development accuracy, age-appropriate dose, and canonical attribute assignment for 23 candidates | HUMAN_REVIEW | qualified goalie/youth-development reviewer completes TF-MVP-006 review register |
| Physical safety, contraindications, substitutions, and pain-stop wording | HUMAN_REVIEW | qualified youth-training safety reviewer independently approves or rejects each version |
| Production instructional media and accessibility text | HUMAN_REVIEW | produce and approve media before activity publication |
| Authoritative baseline/re-test measurement loop and PR bonus qualification | DEPENDENCY | TF-MVP-008; current rule intentionally grants no PR bonus |
| Persisted workload/readiness and optional physical restrictions | DEPENDENCY / EXTERNAL_DECISION | define adult-controlled source and safe defaults before launch integration |
| Plausibility review thresholds for rapid fake completion | DEPENDENCY / EXTERNAL_DECISION | define evidence-backed thresholds; current prescribed cap prevents unlimited XP but does not claim human-reviewed fraud thresholds |
| Auth/player-session feasibility for installed iOS target | REPO_FACT / DEPENDENCY | validate native/hybrid session behavior in the release package |
| Physical device, accessibility, responsive, and offline termination evidence | DEPENDENCY | TF-MVP-017 performs supported-iPhone, VoiceOver, Dynamic Type, reduced-motion, and interruption certification |

## Scope and change-control boundaries

Not implemented or claimed here:

- Human approval or publication of any candidate training activity.
- Production instructional media.
- Ability, mastery, hockey rank, or game-performance scoring.
- Streak rewards without authoritative timezone, planned-day, rest, and recovery facts.
- PR bonus before TF-MVP-008 supplies eligible validated re-test evidence.
- TF-MVP-008 baseline/re-test scheduling and truthful change presentation.
- TF-MVP-009 through TF-MVP-011 game evidence, priority derivation, and live priority adaptation.
- TF-MVP-015 production analytics delivery, monitoring, and alerting.
- TF-MVP-017 physical device and accessibility certification.
- Merge, push, deployment, publication, or any change to published Version 8.

## Rollback and runtime boundary

All work remains on isolated branch `tf-mvp-v1-4`. The exact pre-package reference is `7f91fa9`. Reverting the TF-MVP-007 commit range restores the verified TF-MVP-006 source. Main, repository remote, Sites access policy, and published Version 8 were not changed.

## Final verdict

**TF-MVP-007: PASS.** Its control-plane exit criterion, **Duplicate-safe projections**, is met with automated transaction, authorization, idempotency, rollback, legacy, UI-state, and full-regression evidence.

**Product launch: BLOCKED.** The immediate release blocker remains qualified human review and approval of the 23 candidate activity families and their media. The next code work package is TF-MVP-008 — Baseline / Re-test / Progress, while the content-review track should proceed in parallel under its human owners.
