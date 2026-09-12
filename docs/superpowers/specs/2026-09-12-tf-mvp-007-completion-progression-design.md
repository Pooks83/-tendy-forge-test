# TF-MVP-007 Completion and Progression Design

**Date:** 2026-09-12  
**Status:** Proposed implementation contract  
**Authority:** `00_START_HERE` v1.4 → Canonical Build Specification v1.4 → Readiness Control Plane v1.4  
**Dependencies:** TF-MVP-005 and TF-MVP-006  
**Scope:** Authoritative mission completion, XP, development-attribute credit, Journey advancement, and the first deterministic reward entitlement

## 1. Decision summary

TF-MVP-007 will use a server-authoritative, append-only progression ledger. A mission terminal transition and every consequence of that transition will be written atomically in one D1 batch.

The v1 rules are deliberately understandable:

- One completed prescribed minute earns one XP.
- A skipped activity earns zero XP and zero attribute credit.
- Extra volume cannot increase credit beyond the prescribed duration.
- Attribute credit is allocated only to canonical development attributes explicitly declared by the activity content version.
- A completed mission advances the Journey exactly once.
- The first eligible completed mission awards the `FIRST_SAVE` entitlement exactly once.
- XP, attributes, Journey position, and rewards represent development work and participation. They never claim to measure goalie ability or game performance.

The server is the only authority for calculations, ledger writes, advancement, and entitlements. Clients render returned projections and never calculate or award progression.

## 2. Authority-aligned model

The product keeps three concepts separate:

1. **Development work:** XP, development attributes, Journey position, consistency, and cosmetic entitlements.
2. **Measured training performance:** future baseline/retest results governed by TF-MVP-008.
3. **Technical game priority:** coach evaluation and development-plan inputs.

No aggregate “goalie rating,” composite skill score, or performance inference is created by TF-MVP-007.

## 3. Existing-state findings

The current implementation already performs mission-state, profile-state, audit, and idempotency writes in a single D1 batch. It intentionally awards no XP or reward before TF-MVP-007.

The current activity field named `attributeIds` contains operational mission tags such as `MOVE`, `SEE`, `REACT`, `RECOVER`, `THINK`, and `COMPETE`. These are not the canonical development attributes in section 11 of the build specification:

- Tracking
- Hands
- Balance
- Explosiveness
- Strength
- Mobility
- Conditioning
- Mindset

Therefore, the existing tags cannot be silently reinterpreted. TF-MVP-007 adds an explicit `developmentAttributeIds` content field while preserving existing operational tags under their current behavior. Candidate content without qualified human review remains blocked by the TF-MVP-006 content-review gate.

## 4. Rule configuration

All calculations reference one immutable configuration version stored with each ledger entry.

### `tf-progression-v1`

| Rule | Value |
|---|---:|
| XP per completed prescribed minute | 1 |
| Intensity coefficient | 1.0 |
| Completed activity multiplier | 1.0 |
| Skipped activity multiplier | 0.0 |
| Extra-volume multiplier | 0.0 |
| First eligible reward | `FIRST_SAVE` |

No client duplicates these constants. A future rule change creates a new configuration version; it never rewrites historical entries.

## 5. Completion calculation

Mission completion remains a terminal transition after every required activity is marked `COMPLETED` or `SKIPPED`.

For each activity:

- `creditedMinutes = prescribedMinutes` when status is `COMPLETED`.
- `creditedMinutes = 0` when status is `SKIPPED`.
- User-reported extra attempts, sets, or time do not increase credited minutes.

For the mission:

- `completedPrescribedMinutes = sum(creditedMinutes)`.
- `totalPrescribedMinutes = sum(all required activity prescribedMinutes)`.
- `completionMultiplier = completedPrescribedMinutes / totalPrescribedMinutes`, bounded to `[0, 1]`.
- `xp = completedPrescribedMinutes × 1.0`, represented as an integer.

This expresses the canonical partial-completion rule without awarding skipped work. A terminal mission containing only skipped activities records completion for history and Journey continuity but awards zero XP and no `FIRST_SAVE` entitlement.

## 6. Canonical attribute allocation

Each reviewed activity version must declare one or more `developmentAttributeIds` drawn from the eight canonical values. Mission generation copies the complete list into the immutable mission snapshot.

For a completed activity, its credited minutes are divided equally across its declared attributes. Storage uses integer milli-units (`1 XP = 1000 units`) so totals are deterministic. Division remainders are assigned one unit at a time in lexical attribute-ID order. The sum of attribute units always equals the activity’s XP units.

Skipped activities receive no attribute units.

An eligible non-legacy mission cannot enter terminal completion if a completed activity lacks canonical attribute declarations. The API returns `PROGRESSION_CONFIG_REQUIRED`; mission status, progression, Journey, and reward state remain unchanged.

## 7. Journey advancement

Journey position is the existing path/week/day/cycle position. Completing an eligible mission advances day/week/cycle once according to the authoritative schedule snapshot:

1. Advance to the next scheduled day in the current week.
2. At the end of the week, advance to the first scheduled day of the next week.
3. At the end of the configured program, advance the cycle and return to its first scheduled day.

TF-MVP-007 does not unlock or promote the goalie to a different development path. Path advancement remains evidence-gated and cannot be earned from volume alone.

The completion record stores both before and after positions. A duplicate request or replay returns the original result and cannot advance the Journey again.

## 8. Reward entitlement

`FIRST_SAVE` is a deterministic, non-athletic cosmetic entitlement.

Eligibility requires:

- the mission is eligible for v1 progression;
- at least one prescribed minute was completed;
- the profile does not already own `FIRST_SAVE`.

The entitlement ledger has a unique key on `(profileId, rewardId)`. Later eligible missions return the existing entitlement without creating another. Rewards never change XP, attributes, baseline results, coach evaluations, or path eligibility.

## 9. Persistence model

### Progression rule registry

Stores immutable configuration metadata: `version`, coefficients, multipliers, reward policy, creation time, and status.

### Mission completion ledger

One row per eligible terminal mission:

- completion ID
- mission instance ID (unique)
- profile ID
- content/schedule/progression versions
- completed and skipped prescribed minutes
- completion multiplier
- XP amount
- Journey before and after
- source idempotency key
- completion time

### XP ledger

Append-only entries keyed by logical source `mission:<missionInstanceId>`. The unique logical source prevents duplicate awards independently of request idempotency.

### Attribute ledger

Append-only milli-unit entries with a unique key on `(completionId, developmentAttributeId)`. Values are projected by summation.

### Reward entitlement ledger

Append-only unique entitlements keyed by `(profileId, rewardId)`, with source completion, configuration version, and award time.

Existing mission state, profile Journey state, audit records, idempotency response, completion ledger, XP entries, attribute entries, and entitlement entry are committed together in one D1 batch. Any validation or write failure commits none of them.

## 10. Read projections and UI contract

A child-safe authenticated progress endpoint returns only the selected profile’s projection:

- total XP
- canonical attribute totals
- current Journey position
- earned entitlement IDs and award dates
- recent credited mission summaries
- explicit explanatory copy that development credit is not an ability score

The existing Progress surface consumes this endpoint. It may show a post-mission acknowledgement, but it cannot calculate awards locally. Reopening or refreshing the acknowledgement never creates credit.

The completion response includes the persisted completion summary so the client can present:

- completed prescribed minutes
- skipped minutes
- XP earned
- attribute allocation
- Journey movement
- newly awarded entitlement, if any

Zero-XP completion copy must state that skipped work was saved but did not earn XP.

## 11. Legacy and migration policy

Historical Version 8 sessions and any mission snapshot without an eligible progression/content version do not receive invented XP, attribute credit, Journey advancement, or retroactive rewards.

They remain visible as historical training records with an explicit `LEGACY_UNCREDITED` classification. No backfill occurs unless a future authority-approved migration can prove the original prescribed activity minutes and canonical attribute declarations.

## 12. Idempotency and concurrency

Progression is protected at four layers:

1. Existing request idempotency returns the stored response for a replayed key.
2. Optimistic mission revision checks reject stale transitions.
3. Unique completion and XP logical-source keys prevent duplicate credit under a different request key.
4. Unique reward entitlement keys prevent duplicate rewards across all missions.

Simultaneous terminal requests cannot produce two completion packages. The losing request returns the authoritative completed state without additional credit.

## 13. Streaks, plausibility, and PR bonuses

These canonical concepts are not fabricated in TF-MVP-007:

- **Streaks:** require an authoritative planned-date timezone and rest-day calendar. Those inputs do not yet exist in the reconciled contract. No streak counter is shown or awarded until they do.
- **Plausibility review:** rapid-completion review requires reliable elapsed/attempt evidence and approved thresholds. TF-MVP-007 records authoritative completion inputs but does not invent a pass/fail threshold.
- **PR bonus:** first-valid-PR bonuses require TF-MVP-008 baseline/retest validity. No PR bonus is awarded here.

These are explicit downstream dependencies, not silent omissions. The absence of these features must not block accurate v1 XP, attributes, Journey advancement, or `FIRST_SAVE` once content declarations are approved.

## 14. API errors

| Code | Meaning | Write result |
|---|---|---|
| `PROGRESSION_CONFIG_REQUIRED` | Eligible mission lacks a valid rule or canonical attribute declaration | No writes |
| `MISSION_NOT_READY` | Required activities are not terminal | No writes |
| `MISSION_STALE` | Revision lost an optimistic concurrency race | No writes; return current state |
| `MISSION_ALREADY_COMPLETED` | A different non-replay request targets a completed mission | No additional writes; return original completion summary |
| `FORBIDDEN` | Account lacks the selected-profile relationship | No writes |

## 15. Verification contract

TF-MVP-007 is not complete until automated evidence proves:

- exact one-XP-per-completed-minute calculation;
- skipped activities award zero;
- extra work cannot exceed prescribed credit;
- integer attribute allocation conserves every XP unit;
- only canonical declared attributes receive credit;
- missing declarations fail before any write;
- same-key replay returns the same completion package;
- different-key duplicate completion creates no additional ledger rows;
- concurrent terminal requests credit and advance once;
- day/week/cycle rollover is deterministic;
- path advancement is never triggered by mission volume;
- `FIRST_SAVE` is issued once and only after positive eligible work;
- cross-profile reads and writes are forbidden;
- legacy records receive no fabricated credit;
- transaction failure leaves mission, profile, audit, XP, attributes, Journey, reward, and idempotency unchanged;
- the Progress UI renders server projections and never presents an ability rating;
- the existing TF-MVP-001 through TF-MVP-006 gates remain green.

## 16. Human and downstream gates

Engineering can implement and verify the ledger machinery with reviewed test fixtures. Launch credit for real training content remains blocked until qualified human reviewers approve the content candidates and assign canonical development attributes under the TF-MVP-006 review register.

Youth-training/safety approval, authentication feasibility, and physical restriction persistence remain separate readiness gates. TF-MVP-007 must report these accurately and cannot convert an engineering pass into a launch-ready claim.

## 17. Exit criteria

TF-MVP-007 passes its engineering exit criteria only when:

1. A valid eligible mission completes in one atomic package.
2. XP, attribute credit, Journey advancement, audit, idempotency, and reward entitlement match `tf-progression-v1`.
3. Duplicate and concurrent completion are projection-safe.
4. The child-safe progress projection is relationship-authorized.
5. Legacy data receives no invented progression.
6. All focused and regression verification passes with evidence recorded under `docs/readiness/`.

Production launch remains blocked by any unresolved authority, human-review, security, safety, content, or runtime gate in the Readiness Control Plane.
