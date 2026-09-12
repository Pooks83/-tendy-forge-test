# TF-MVP-006 Content Review Register

Date: 2026-09-12  
Authority: `00_START_HERE` v1.4 → Canonical Build Specification v1.4 sections 09–10 → Readiness Control Plane v1.4  
Catalog source: `lib/training-content.mjs` (`tf-content-candidates-v1`)  
Assignment status: **0 of 23 activity families approved or publishable**

## Review decision

The repository contains 23 structurally complete candidate activity families, which is within the canonical 20–30 launch target. They are not launch content. Every record remains `DEVELOPMENT_REVIEW`; development approval, qualified safety approval, and reviewed instructional media are absent. The publication gate correctly excludes all 23 from assignment.

Automated validation proves schema completeness and fail-closed lifecycle behavior. It does not constitute youth-development, medical, safety, coaching, or media approval.

## Common eligibility and review facts

| Field | Current candidate value | Release decision |
|---|---|---:|
| Age bands | 10–12 and 13–15 | HUMAN REVIEW REQUIRED |
| Development prescriptions | Levels 1, 2, and 3 | HUMAN REVIEW REQUIRED |
| Context | Off-ice only | STRUCTURALLY VALID |
| Required space | Adult-confirmed `small-indoor` | HUMAN REVIEW REQUIRED |
| Space substitution | None; a missing clear indoor space always fails eligibility | FAIL CLOSED |
| Equipment substitution | Candidate reduced setup where listed equipment is unavailable; still requires `small-indoor` | HUMAN REVIEW REQUIRED |
| Workload | Level-specific estimated minutes shown below; current engine cap is 10 minutes per activity | UPSTREAM READINESS SOURCE REQUIRED |
| Physical restrictions | Movement tags are evaluated against supplied restrictions | UPSTREAM RESTRICTION SOURCE REQUIRED |
| Primary cues | Maximum two | STRUCTURALLY VALID |
| Pain stop | Every candidate instructs immediate stop for pain, dizziness, or lost safe control and adult notification | HUMAN SAFETY REVIEW REQUIRED |
| Media | `candidate:*` identifiers are placeholders, not reviewed assets | NOT APPROVED |
| Development review | No reviewer or timestamp | NOT APPROVED |
| Safety review | No qualified reviewer or timestamp | NOT APPROVED |
| Publication | No `published_at`; lifecycle remains `DEVELOPMENT_REVIEW` | NOT APPROVED |

Technical skill IDs are the canonical 1–30 taxonomy. A child-facing ACTIVE priority registry does not yet exist; TF-MVP-010 owns priority derivation and TF-MVP-011 owns priority-to-mission adaptation. Therefore this register demonstrates candidate skill coverage, not approved P0 priority coverage.

## Candidate family register

| Candidate version | Activity | Skill IDs / attributes | Equipment; space | Candidate substitution | Workload by level | Media | Development | Safety | Publish |
|---|---|---|---|---|---|---|---:|---:|---:|
| ready-stance-hold v1 | Balanced ready stance | 1, 2 / MOVE | None; small-indoor | Reduced stance; still needs small-indoor | L1 3m; L2 4m; L3 5m | candidate:ready-stance-hold:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| quiet-side-steps v1 | Quiet side steps | 2, 3 / MOVE | cones; small-indoor | No cones, smaller steps; still needs small-indoor | L1 4m; L2 5m; L3 6m | candidate:quiet-side-steps:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| single-leg-balance v1 | Supported single-leg balance | 2 / MOVE | wall-space; small-indoor | Fingertip support setup; still needs small-indoor | L1 3m; L2 4m; L3 5m | candidate:single-leg-balance:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| small-jump-quiet-land v1 | Small jump quiet landing | 4, 5 / MOVE | cones; small-indoor | Toe rise without jumping; still needs small-indoor | L1 4m; L2 5m; L3 6m | candidate:small-jump-quiet-land:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| chair-sit-stand v1 | Chair sit and stand | 7 / MOVE | None; small-indoor | Full sit with light support; still needs safe chair and small-indoor | L1 4m; L2 5m; L3 6m | candidate:chair-sit-stand:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| wall-push v1 | Wall push-up | 7 / MOVE | wall-space; small-indoor | Stand closer; still needs a safe wall and small-indoor | L1 3m; L2 4m; L3 5m | candidate:wall-push:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| heel-slide v1 | Supine heel slide | 8 / MOVE | None; small-indoor | Shorter slide; still needs clear floor/mat space | L1 3m; L2 4m; L3 5m | candidate:heel-slide:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| ankle-rock v1 | Supported ankle rock | 9 / MOVE | wall-space; small-indoor | Smaller range; still needs safe wall and small-indoor | L1 3m; L2 4m; L3 5m | candidate:ankle-rock:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| two-hand-wall-catch v1 | Wall ball two-hand catch | 10, 11 / SEE | tennis-ball, wall-space; small-indoor | Allow floor bounce; catalog model proposes no equipment, pending review | L1 5m; L2 5m; L3 6m | candidate:two-hand-wall-catch:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| alternate-hand-wall-catch v1 | Alternating-hand wall catch | 10, 11, 18 / SEE, REACT | tennis-ball, wall-space; small-indoor | Two-hand receive; catalog model proposes no equipment, pending review | L1 5m; L2 5m; L3 6m | candidate:alternate-hand-wall-catch:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| find-step-reset v1 | Find step reset | 16, 21 / RECOVER | tennis-ball, cones; small-indoor | Short reach setup; catalog model proposes no equipment, pending review | L1 4m; L2 5m; L3 6m | candidate:find-step-reset:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| scan-card-reset v1 | Scan card and reset | 17 / SEE | cones/cards; small-indoor | Point instead of naming; catalog model proposes no equipment | L1 3m; L2 4m; L3 5m | candidate:scan-card-reset:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| sightline-window v1 | Find the viewing window | 24 / SEE | stable chair/target; small-indoor | Increase target clearance; still needs safe setup | L1 3m; L2 4m; L3 5m | candidate:sightline-window:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| soft-ball-target-roll v1 | Soft-ball target roll | 12, 14, 25 / REACT, THINK | tennis-ball, cones; small-indoor | Wider/closer target; catalog model proposes no equipment | L1 4m; L2 4m; L3 5m | candidate:soft-ball-target-roll:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| walk-breathe-reset v1 | Walk breathe reset | 16, 28, 30 / RECOVER, COMPETE | None; small-indoor | Seated breathing/reflection | L1 3m; L2 3m; L3 4m | candidate:walk-breathe-reset:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| rush-depth-choice v1 | Rush depth choice | 13, 20, 26 / THINK | Reviewed diagram required; small-indoor | Adult reads choices aloud | L1 4m; L2 5m; L3 6m | candidate:rush-depth-choice:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| release-cue-choice v1 | Release cue choice | 18, 20 / REACT, THINK | Reviewed sequence cards required; small-indoor | Two-frame obvious cue | L1 4m; L2 5m; L3 6m | candidate:release-cue-choice:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| pattern-clue-choice v1 | Pattern clue choice | 19, 27 / THINK | Reviewed play cards required; small-indoor | Two-card repeated clue | L1 4m; L2 5m; L3 6m | candidate:pattern-clue-choice:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| call-before-roll v1 | Call before the roll | 12, 15, 25 / COMPETE, THINK | tennis-ball, cones; small-indoor | Point/call/hand-roll closer; catalog model proposes no equipment | L1 4m; L2 5m; L3 6m | candidate:call-before-roll:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| controlled-march-stop v1 | Controlled march and stop | 3, 6 / MOVE | cones; small-indoor | Slower, shorter march without markers | L1 4m; L2 5m; L3 6m | candidate:controlled-march-stop:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| chaos-update-choice v1 | Broken-play update | 22, 26 / REACT, THINK | Reviewed diagram required; small-indoor | One obvious two-frame change | L1 4m; L2 5m; L3 6m | candidate:chaos-update-choice:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| behind-net-threat-choice v1 | Behind-net threat choice | 23, 26 / THINK, SEE | Reviewed rink diagram required; small-indoor | One carrier and one marked threat | L1 4m; L2 5m; L3 6m | candidate:behind-net-threat-choice:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |
| quality-reset-reflection v1 | Quality reset reflection | 28, 29, 30 / COMPETE, RECOVER | Reviewed examples required; small-indoor | Two examples with obvious control change | L1 4m; L2 5m; L3 6m | candidate:quality-reset-reflection:v1 | NOT APPROVED | NOT APPROVED | NOT APPROVED |

## Structural coverage

- Candidate family count: 23 of required 20–30.
- Canonical technical skill IDs represented: 30 of 30.
- Candidate versions with all required section-10 schema fields: 23 of 23.
- Candidate versions with human development approval: 0 of 23.
- Candidate versions with qualified safety approval: 0 of 23.
- Candidate versions with reviewed media: 0 of 23.
- Candidate versions eligible for publication: 0 of 23.
- Approved child-facing priority mappings: 0; priority definitions and evidence are not yet authoritative.

## Required human review sequence

For each candidate, a qualified reviewer must verify the development purpose, age bands, Level 1/2/3 dose, success and plausibility rules, equipment/space facts, substitutions, movement steps, cues, common mistake, harder/easier versions, and all media. A qualified youth-training safety reviewer must independently approve the physical demands, environment, contraindications, safety copy, and pain-stop rule. Only then may an authorized content owner set the immutable version to `PUBLISHED` with both reviewer identities and timestamps.

The current publication seed refuses any record that claims `PUBLISHED` without both reviews and a valid publication time.
