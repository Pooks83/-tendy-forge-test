# TF-MVP-006 Mission Generator and Content Eligibility Evidence

Date: 2026-09-12  
Authority: `00_START_HERE` v1.4 → Canonical Build Specification v1.4 → Readiness Control Plane v1.4  
Work package: TF-MVP-006 — Mission Generator + Content  
Dependencies: TF-MVP-003 through TF-MVP-005  
Golden journeys: GJ-02 daily development and GJ-05 continuity/interruption  
Pre-package reference: `af92f85`  
Implementation checkpoints: `f500177`, `5027a6d`, `6aa6c84`, `f6f5c03`, `452065e`, `c672f10`  
Published Version 8: unchanged

## Exit decision

**PASS — the TF-MVP-006 engineering exit criterion “Safe next action explainable” is satisfied within this package’s declared inputs and recovery paths.**

**LAUNCH REMAINS BLOCKED.** No candidate activity has the required human development review, qualified youth-training safety review, or reviewed instructional media. The production catalog therefore contains no assignable activity and correctly returns one adult-review action instead of generating a mission. Authoritative workload/readiness and optional physical-restriction persistence are also owned by later/upstream readiness work and are not represented as complete here.

This decision does not authorize publication, seeding candidate content as reviewed, or starting TF-MVP-007 without normal dependency control.

## Canonical outcome delivered

- A deterministic generator accepts 15, 25, or 35 minutes and produces exactly 3, 4, or 5 eligible activities.
- Normal generation makes no model call and uses stable family/version identity for tie-breaking.
- Hard precedence is safety/restrictions → recovery/workload → confirmed coach focus → one ACTIVE priority → due re-test → undertrained coverage → difficulty → variety → Journey packaging.
- More than one ACTIVE priority is rejected.
- A 25-minute ACTIVE-priority plan targets 40–60% of meaningful time when eligible content exists.
- Eligibility denies assignment for missing publication, age/level, equipment/substitution, space, restriction, safety, workload, required input, or objective compatibility.
- Only immutable versions with development reviewer, safety reviewer, and publication timestamps can enter the published catalog.
- All mission selection facts come from the server profile and persisted state; caller-supplied age, equipment, space, duration, or profile substitution is ignored or rejected.
- A generated plan is snapshotted at mission start. Ordinary catalog edits or retirement do not rewrite active/historical work.
- Completed generated missions feed family-level coverage and recent-variety history into the next deterministic plan.
- A safety retirement immediately blocks an unfinished activity. Only an eligible reviewed replacement is offered.
- Replacement adoption is an authenticated, owner-only, idempotent, revision-checked server action. Coaches cannot adopt it.
- Any acknowledged result from the withdrawn version is retained in the audit event. The replacement restarts cleanly without changing unrelated mission progress.
- Today exposes one dominant player action: start/resume, rest/recovery, or adult review. It shows exact duration, activity count, prescription, equipment/space, and approved substitution from the snapshot.

## Content and data contracts

| Contract | Implementation | Evidence |
|---|---|---|
| Versioned family catalog | `activity_families`, immutable `(activity_id, version)` rows, lifecycle/reviewer/publication fields | schema and content contract tests |
| Publication gate | `validateActivityVersion`, `isPublishedActivity`, fail-closed seed generator | false-publication and catalog-loading tests |
| Eligibility | Pure `evaluateActivity` / `eligibleActivities` with stable exclusion codes | table-driven canonical gate tests |
| Planning | Pure `generateMission` with stable ranking and explanation trace | deterministic/deep-equality tests |
| Training space | Persisted `available_spaces_json`; no inferred space for migrated profiles | onboarding and missing-space integration tests |
| Mission snapshot | generated plan stored in `execution_snapshot_json`; generator version in `content_version` | start/reload/catalog-change tests |
| Coverage/variety | family IDs retained in snapshots; last 20 completed generated missions counted | next-day non-repeat regression |
| Safety retirement | source-version safety withdrawal lookup plus fresh replacement eligibility | retirement/ineligible replacement tests |
| Replacement adoption | owner permission, revision/idempotency, snapshot update, activity reset, audit evidence | owner/coach/duplicate/partial-progress tests |

Migrations added by this package:

- `drizzle/0008_training_content.sql`
- `drizzle/0009_profile_training_space.sql`

Extended endpoint:

- `GET /api/mission` returns the active snapshot, a deterministic not-started plan, or one explainable unavailable state.
- `POST /api/mission` starts the server plan and supports the TF-MVP-005 execution actions plus owner-only `replace-retired-activity`.

## Requirement traceability

| Canonical ID | Package result | Evidence | Remaining dependency |
|---|---|---|---|
| SCP-004 Today / next-best action | PASS | Today resolver and UI tests prove one dominant start/resume/recovery/adult action | TF-MVP-007/008/009 later add completion, re-test, and game branches |
| SCP-005 15/25/35-minute missions | PASS | generator and API tests prove 3/4/5 activities from persisted duration | Real content approval required |
| SCP-006 SHOW → SAY → DO | CONDITIONAL PASS | snapshot contains visual ID/caption/alt, max two cues, dominant start control and exact steps | Reviewed media and human content validation required |
| SCP-013 rest/recovery/workload protection | PASS at engine boundary | safety/workload dominance and eligibility tests; TF-MVP-005 rest execution | Authoritative workload and restriction persistence not yet integrated |
| SCP-017 one active priority | PASS at generator boundary | multiple ACTIVE priorities fail closed; allocation trace stored | TF-MVP-010 owns authoritative priority creation |
| SCP-018 priority → mission adaptation | PASS at generator boundary | mapped intervention weighting and missing-map recovery tested | TF-MVP-011 owns live priority integration |

## Golden-journey evidence

### GJ-02 within TF-MVP-006 scope

1. Today requests the current plan using server-held player facts.
2. Missing reviewed content or training space returns one adult action and creates no empty mission.
3. Eligible fixture content produces a deterministic 15/25/35-minute plan with 3/4/5 exact activity versions.
4. Start persists the complete plan and ordered activity rows.
5. Drill uses the snapshot’s setup, dose, rest, cues, safety, media metadata, and substitution.
6. TF-MVP-005 executes and reloads the immutable mission.
7. Completion history informs the next plan without changing completed snapshots.
8. TF-MVP-007 remains responsible for atomic XP, attributes, Journey movement, rewards, and anti-grind ledgers.

### GJ-05 continuity and content change

| Branch | Result |
|---|---:|
| Reload active generated mission | PASS — exact versioned snapshot restores |
| Ordinary catalog edit/retirement | PASS — active snapshot remains unchanged |
| Safety retirement | PASS — unfinished activity blocks immediately |
| Eligible reviewed replacement | PASS — owner can adopt once; mission revision advances |
| Ineligible/unreviewed replacement | PASS — no replacement offered; adult-content review remains the action |
| Coach attempts adoption | PASS — server returns owner-permission denial and makes no write |
| Partial withdrawn-version result | PASS — prior status/result retained in audit; replacement starts cleanly |
| Duplicate adoption tap/retry | PASS — stored response replays; one audit event |
| Subsequent replacement result | PASS — normal bounded result schema and execution continue |

## Safety, privacy, authorization, and AI

- Candidate content is not silently grandfathered. The real catalog loader sees zero assignable versions until authorized reviewers publish records.
- Safety and workload exclusions are evaluated before lower-order planning preferences.
- Missing space fails closed. Equipment substitution must independently satisfy the current equipment and space context.
- Replacement eligibility is re-evaluated against the current player facts; database publication status alone is insufficient.
- Replacement adoption requires `training_profiles.owner_id` to match the authenticated adult. Coach UI hiding is not treated as authorization.
- Active player/profile relationship and request profile context remain server-authoritative.
- Explanation traces contain activity IDs, versions, rule codes, counts, duration, and allocation only; no child name, email, coach note, or private free text.
- Repository search found no network/model call in content validation, eligibility, generator, catalog, or mission-store modules.

## Independent-review corrections

| Finding | Root correction | Regression evidence |
|---|---|---|
| Coverage history used session IDs, so activity families could repeat | Persist family ID in generated snapshots and derive coverage/variety only from completed generated missions | next-day family non-repeat test |
| Safety replacement was shown but could not be adopted | Added explicit owner review surface and idempotent server adoption action | component and API adoption tests |
| Published replacement was not rechecked against current eligibility | Run the complete eligibility engine before offering/adopting | ineligible replacement returns null |
| Coach could call the adoption API despite hidden UI | Added server owner check before any replacement mutation | coach 403/no-write test |
| Partial withdrawn-version result could be lost or corrupt the live result schema | Preserve prior status/result in audit metadata; reset live activity result before restart | partial-progress → adoption → new-result test |
| Completed history query could include legacy snapshots without family IDs | Scope history to generator `content_version`; ignore snapshots without stable family IDs | generated-history integration test |

## Verification results

| Gate | Result | Evidence |
|---|---:|---|
| Production-equivalent build | PASS | Vinext five-stage build completed and worker/API routes bundled |
| Full automated regression | PASS | `npm test`: 162/162 tests passed |
| Focused TF-MVP-006 suite | PASS | 55/55 content, eligibility, planner, API, UI, GJ-02 and GJ-05 tests passed before final adversarial additions; final affected tests also passed |
| TypeScript | PASS | `npx tsc --noEmit --incremental false`: exit 0 |
| Lint | PASS | 0 source errors; 3 unrelated pre-existing/generated warnings |
| Diff hygiene | PASS | `git diff --check`: exit 0 |
| Model-call absence | PASS | focused repository search returned no model/network call in planning modules |
| Supported browser visual inspection | UNVERIFIED | local worker is unreachable from the available cloud browser; unsafe public dev tunnel was rejected |
| Physical iOS / six-width matrix | DEFERRED | TF-MVP-017 |
| Human content and safety review | BLOCKED | 0/23 candidates approved |
| Reviewed instructional media | BLOCKED | 0/23 candidates have reviewed production media |

Retained lint warnings are outside this package: one unused import in the pre-existing canonical-design generator and two unused disable directives in generated Cloudflare declarations.

## Launch blockers and owning work

| Blocker | Classification | Required next action / owner |
|---|---|---|
| Development accuracy and age-appropriate dose for 23 candidates | HUMAN_REVIEW | Qualified goalie/youth-development reviewer completes the register |
| Physical safety, contraindications, substitutions, and pain-stop wording | HUMAN_REVIEW | Qualified youth-training safety reviewer independently approves or rejects each version |
| Instructional images/video/diagrams and accessibility text | HUMAN_REVIEW | Produce and review media before publication |
| No authoritative child-facing priority registry | DEPENDENCY | TF-MVP-009/010 create evidence-supported priorities; TF-MVP-011 connects them |
| Workload/readiness and optional physical restrictions are temporary foundation inputs | DEPENDENCY / EXTERNAL_DECISION | Define and persist authoritative adult-controlled facts before launch integration; do not infer them from absence |
| Live responsive/browser evidence unavailable in this environment | ENVIRONMENT / DEPENDENCY | TF-MVP-017 performs six-width, keyboard, screen-reader, reflow, contrast, and physical iOS validation |

## Scope and change-control boundaries

Not implemented or claimed here:

- Human approval or publication of any training activity.
- Production media assets.
- TF-MVP-007 XP, progression, rewards, or anti-grind accounting.
- TF-MVP-008 baseline/re-test persistence and scheduling.
- TF-MVP-009/010 game evidence and authoritative priority derivation.
- TF-MVP-011 live priority-to-mission persistence.
- TF-MVP-012 complete parent workload/restriction settings.
- TF-MVP-013 persisted coach focus.
- TF-MVP-017 device/accessibility certification.
- Merge, push, deployment, publication, or any change to published Version 8.

## Rollback and runtime boundary

All work remains on isolated branch `tf-mvp-v1-4`. The exact pre-package reference is `af92f85`. Reverting the TF-MVP-006 commit range restores the verified TF-MVP-005 source. Main, repository remote, Sites access policy, and published Version 8 were not changed.

## Exit-criteria trace

| TF-MVP-006 criterion | Result |
|---|---:|
| Dependencies TF-MVP-003 through TF-MVP-005 retained | PASS |
| Eligibility is deny-by-default and explainable | PASS |
| Deterministic 15/25/35 planning produces 3/4/5 activities | PASS |
| Safety/recovery outrank focus, priority, re-test, coverage, and variety | PASS |
| One ACTIVE priority maximum and mapped allocation contract | PASS at generator boundary |
| Started mission snapshots are versioned and immutable except audited safety replacement | PASS |
| Missing/unreviewed content produces one safe adult action | PASS |
| Safety retirement and replacement recovery have no package-level dead end | PASS |
| Build, full regression, type, lint, and diff gates | PASS |
| Human-reviewed launch catalog and media | BLOCKED — explicit launch prerequisite, not an engineering-pass claim |
| Browser/device visual evidence | UNVERIFIED/DEFERRED — explicit TF-MVP-017 gate |

**Next dependency: qualified content/media review is the immediate release blocker. The next code work package after that governance gate is TF-MVP-007 — Completion + XP/Progression/Rewards.**
