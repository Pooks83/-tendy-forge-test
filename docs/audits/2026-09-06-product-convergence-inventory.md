# Goalie Forge product convergence inventory

Baseline: published Version 6 (`d316ffd6cc392b108eb7d8985c0e74660398f633`) and the matching source checkout.

## Product map

- `/`: one responsive application with guest, signed-in-empty, player, parent-owner, and coach-grantee states.
- `/api/training`: authenticated profile, training, evaluation, sharing, export, and deletion operations.
- Dispatch-owned authentication: `/signin-with-chatgpt`, `/callback`, and `/signout-with-chatgpt`.
- Player destinations: Home, Train, Progress, Profile.
- Parent and coach tools: nested inside Profile > Adult/Coach workspace.
- Drill flow: session list > drill dialog > instructions > set completion/rest > celebration > session completion.
- Persistence: D1 `training_profiles` plus `training_coach_grants`; optimistic revisions protect concurrent writes.

## Prioritized issues

| Priority | Issue and location | User | Root cause | Best systemic correction | Regression risk |
|---|---|---|---|---|---|
| P1 | Coach evaluation captures five generic ratings, not the complete repeatable protocol (`training-app.tsx`, `training-actions.mjs`) | Coach, parent | MVP form replaced the supplied evaluation with a summary | Shared ten-section off-ice evaluation model, validated server-side and rendered from one definition | Existing saved five-rating records need backward-compatible display |
| P1 | Path advancement can be earned from six group checks without evidence across all 30 declared skills (`training.mjs`) | Player, parent, coach | Skills and accomplishment checks use different identifiers | Record a skill ID with every check and require all current-path skills plus distinct-day group evidence | Existing checks remain history but cannot falsely satisfy new mastery |
| P1 | Coach with no shared profiles lands in parent profile creation without a clear coach empty state (`training-app.tsx`) | Coach | Empty account has no declared intent or relationship state | Explicit parent setup and coach-waiting choices without inventing a child role or bypassing grants | Must preserve multi-relationship accounts |
| P1 | Coach grant can be created without the coach having private Site access (`training-app.tsx`) | Parent, coach | Data permission and Site audience permission are separate systems | Make both requirements explicit at grant time and show a truthful pending-access state | Cannot automate workspace access from app code |
| P2 | Browser back/deep links do not reflect tabs or open drills (`training-app.tsx`) | All | UI state is component-only | One URL-state adapter for view and drill; popstate closes/restores UI | Avoid hydration mismatch and invalid drill IDs |
| P2 | Physical drill image is a floor map, not a mechanics sequence (`drill-map.tsx`) | Player | One generic diagram abstraction is doing two jobs | Responsive three-step instructional figure driven by the shared drill model | Must not imply unsafe or on-ice movement |
| P2 | Fixed mobile header height and body minimum width can amplify embedded-view spacing/overflow (`training.css`, `globals.css`) | Mobile users | Desktop dimensions and legacy global constraints remain | Safe-area-aware header, no forced document width, explicit mobile viewport, overflow checks | Header and bottom navigation must not overlap content |
| P2 | Parent/coach tools are hidden behind a generic Profile screen (`training-app.tsx`) | Adult, coach | Child navigation and adult work are mixed | Clear role-appropriate workspace entry and heading while retaining four-item player navigation | Avoid exposing privileged controls to coach/player states |
| P2 | Request parsing assumes every error is JSON (`training-app.tsx`) | All | Transport and domain errors are conflated | Shared tolerant response parser with useful retry copy | Do not hide server validation details |
| P2 | Current product coexists with a complete obsolete demo and 360+ lines of obsolete CSS (`goalie-forge-app.tsx`, `player-screens.tsx`, `adult-screens.tsx`, `goalie-engine.mjs`, `globals.css`) | Engineering/release | Successive implementations were preserved instead of converged | Delete unmounted implementation, its tests, and legacy style system; retain only shared primitives actually used | Confirm no live imports before removal |
| P2 | Production UI calls itself a private development build (`training-app.tsx`) | All | Release copy was never converged | Replace prototype disclaimers with accurate safety/privacy language | Legal and training review remain external launch gates |
| P3 | Setup team is free text and age options do not explain intended range (`training-app.tsx`) | Parent | Minimal MVP model | Normalize/trim values and improve field help; do not invent an organization roster | Organization directory is not yet available |

## Constraints and verification limits

- The production access gate and SIWC redirect were observed. Post-authentication live UI is currently unverified because the secure OpenAI login rejected the supplied credential and the one-time-code flow was not completed.
- The exact deployed source is available, so UI, API, persistence, authorization, and responsive behavior can be tested against the same commit in the production-equivalent Worker runtime.
- Youth training safety, parental-consent compliance, and movement instruction accuracy require qualified human review and cannot be truthfully certified by automated product tests.
