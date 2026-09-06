# Goalie Forge canonical design review and completeness gate

Revision 0.9 • 6 September 2026 • Review candidate, not an application release.

## Verdict

The package is the canonical design contract for future implementation. Its registry is structurally complete and the final four-perspective review has no unresolved P0/P1 **design-contract** finding. This does not make the running application production-ready. The published Version 8 was not changed, and the validation gates below still block implementation release claims.

## Evidence inspected

- Published Version 8 entry and parent setup at 1363 × 936; coach waiting and Back behavior.
- Current source routes, authentication boundary, training API/store, schema, application shell, drill map, evaluation and shared primitives.
- Generated registry/atlas validation.
- Independent Principal Product Designer, Design Systems Lead, Staff Front-End Engineer and adversarial QA reviews, followed by amendment re-review.

The live screenshots prove only the observed desktop states. Populated private journeys were source-inspected, not executed with real player data. The cloud browser refused the local atlas file URL, so the generated atlas was not visually exercised in that browser. No claim of atlas or target-product visual validation is made.

## Critical findings and binding resolutions

| Finding | Root cause | Resolution | Status |
|---|---|---|---|
| Adult actions exposed through player display mode | UI hiding was mistaken for authorization | Player-only server capability, fresh adult re-auth, adult/player route and shell split | Design closed; platform feasibility unverified |
| Household ownership undefined | Relationship model could not represent owner/co-guardian decisions | Explicit Household/HouseholdAdult model, deny-first capability precedence, owner-only operations | Design closed |
| Offline Stop race/revocation/sign-out | Client time and transient local state could erase or forge safety ordering | One-time server-signed stop nonces, encrypted escrow, bounded server-verifiable delivery, revision/event acknowledgement | Design closed |
| Higher-load acceptance non-atomic | Accepted and effective states were conflated | proposed → acceptedPendingCommitment → active, one idempotent atomic plan/schedule/session commit | Design closed |
| Initial prescription missing | Profile creation had no safe schedule commitment | Schedule screen, Foundation default, recovery validation, 14-day preview and resumable draft | Design closed |
| Evidence visibility/dispute unclear | One generic note mixed child and adult data; no resolution lifecycle | Canonical EvidenceRecord, explicit player share default off, adult/player projections, immutable dispute and qualified-coach contribution | Design closed |
| Evaluation ratings implied mastery | Section score had no criterion-level conversion contract | Explicit per-criterion outcome, attempts/successes and evidence note; no numeric auto-pass | Design closed |
| Shell and route cross-contamination | Player routes admitted adult roles | Dedicated adult drill/skill/history templates and adult-only flow references | Design closed |
| Invite behavior overloaded | Sender and recipient used one ambiguous modal | Separate SEND/RECEIVE overlays and confirmed-delivery contract | Design closed |
| Responsive/state contracts conflicted | Later amendments did not normalize earlier tables/registry | One 0–599/600–899/≥900 rule, exhaustive state applicability plus N/A reasons | Design closed |

## Mechanical coverage

| Coverage item | Result | Meaning |
|---|---:|---|
| Screen templates | 47 / 47 | Identity, route, role, purpose, entry, layout order, actions, exit, shell, states and traceability present |
| Flows | 33 / 33 | Ordered screens, completion, alternatives and global Yes/No/Cancel/Back/Close/Skip/Retry/Leave contract present |
| Primary interactions | 47 / 47 | Exactly one primary action per screen template |
| Action contracts | 159 / 159 | Trigger labels and resulting system state specified |
| State definitions | 20 / 20 | Global behavior defined; 758 applicable screen/state pairs inherited |
| State applicability | 47 / 47 screens exhaustive | Every state is applicable or has a recorded N/A reason |
| Overlays | 9 / 9 | Trigger, confirm, dismissal and failure behavior specified |
| Component families | 10 / 10 | Shared component domains referenced |
| Structural registry checks | Passed | IDs, references, shells, actions, state exhaustiveness and bidirectional flow links validated |

These counts are structural coverage, not 758 visual designs or runtime tests.

## Final adversarial review

| Perspective | Final result |
|---|---|
| Principal Product Designer | No unresolved P0/P1 after schedule, proposal, age, evidence and plan-flow amendments |
| Design Systems Lead | No unresolved P0/P1 after shell/route split, state normalization, invite split and responsive normalization |
| Staff Front-End Engineer | No unresolved P0/P1 after ownership, safety nonce, plan atomicity, qualification and criterion-level evidence contracts |
| QA / adversarial tester | No unresolved P0/P1 design ambiguity after safety escrow, schedule lifecycle, evaluation conversion and registry symmetry fixes |

## Release-blocking validation still required

1. Qualified youth goalie training/safety reviewer approves all load rules, 30 skill rubrics, evaluation protocols and at-home/off-ice prescriptions.
2. Every assigned drill has reviewed mechanics-specific image/video, captions/transcript and safe text fallback; the current generic diagrams are not approved assets.
3. Identity/hosting proves revocable player-only sessions, fresh adult re-authentication, invitation delivery and Site-audience integration.
4. Authorization and privacy tests cover owner/co-guardian/coach/team/admin capability matrices, field projections, revocation, exports and deep links.
5. Data migrations and rollback fixtures prove organization, season, team, household, relationship, evidence, plan and audit models against existing records.
6. Target implementation is visually tested at 320, 375, 390, 430, 768 and 1280 px plus 599/600 and 899/900 seams; current result is 0 target screens validated at those widths.
7. Computed contrast, keyboard, 200% reflow, VoiceOver/Safari and NVDA/Chrome tests pass; current accessibility status is specified but unverified.
8. End-to-end runtime tests cover first launch, return, setup, player mode, training, Stop/offline races, evaluation, evidence, plan acceptance, organization membership, refresh and session expiry.

## Deprecated implementation patterns

Remove during implementation migration: adult mega-panel inside Profile, `?view=` as the primary router, UI-only player/adult role switching, duplicate celebration plus toast, generic diagram as final instruction, week-derived blanket mastery labels, free-text team as relationship, inline destructive confirmation, local-only profile identity and date-based progression. Preserve real historical records through versioned migration.

## Change control

Implementation must cite affected requirement, flow, screen, component and state IDs. If a new ambiguity is discovered, update `SPECIFICATION.md` and `registry.mjs`, regenerate the atlas, identify every consumer, re-run the four relevant reviews, then implement. No local code patch may silently create a new pattern.
