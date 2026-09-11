# Tendie Forge

Tendie Forge is an iOS-first, adult-managed development companion for goalies approximately ages 8–14. The current web Worker is the reconciled Version 8 baseline while native packaging remains a later release work package.

## Product architecture

- `/` renders access, parent setup/review, player first-value, player, and adult/coach states.
- ChatGPT/Sites authentication establishes the adult account. It is not the player identity or a relationship grant.
- `/api/onboarding` creates or reconciles an adult-owned player, versioned consent, privacy preferences, active context, audit event, and idempotency result.
- `/api/player-context` authorizes one active goalie at a time; `/api/player` and `/api/player-action` expose only a whitelisted child-safe projection.
- `/api/first-challenge` persists the versioned 60-second first-challenge state and result exactly once.
- `/api/training` remains the adult/coach boundary for profile administration, evidence, evaluation, export, deletion, and legacy training actions.
- D1 separately stores profiles, guardian relationships, consent, privacy preferences, active context, deletion requests, audit events, idempotency records, first-challenge results, and legacy coach grants.
- Player navigation is Today, Journey, Progress, and Profile. Adult data is not fetched before a valid child context chooses the player surface.

## Training model

- Three accomplishment-based paths: 3 × 30 minutes, 3 × 45 minutes, and 4 × 60 minutes per week.
- Each path keeps its workload constant until the player advances.
- Twenty planned weeks cover all 30 goalie-development skills through physical drills and seated reading tasks.
- Advancement requires adult-observed evidence for every skill and observations on at least two days in each development group. Elapsed time alone never advances a player.
- Physical activities use bodyweight movement, soft balls, floor markers, a wall, or stable household equipment. No on-ice drill is assigned.

## Privacy and permissions

- A parent/guardian relationship is stored separately from the adult account and player profile.
- A coach must have both private Site access and a profile-specific grant.
- Coaches may record evaluations and skill evidence; they cannot complete player drills, resume a safety-stopped session, advance a path, share access, export data, or delete a profile.
- The product does not collect child email addresses, exact birth dates, photos, public profiles, rankings, or direct messages.
- Required parental permission is versioned and stored separately from optional analytics, notification, and clip preferences. Declining an optional preference does not block core training.
- Legacy Version 8 profiles retain their IDs, history, revisions, export/delete access, and coach grants, but require parent consent/setup review before child handoff.

## Release gates

Implementation does not constitute legal or safety approval. Launch remains blocked until qualified reviewers approve youth-training content and safety language, privacy/parental-consent handling, production disclosures and vendors, and the required real-device/TestFlight evidence. No unreviewed activity or unsupported age selection may receive a training prescription.

## Development

Requires Node.js `>=22.13.0`.

- `npm run dev` starts the local application.
- `npm run build` creates the deployable Worker bundle.
- `npm test` builds and runs all unit, component, rendered-output, authorization, persistence, and Worker tests.
- `npm run lint` checks source quality.
- `npm exec tsc -- --noEmit` verifies TypeScript.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, and `/callback`; do not create application routes at those paths. The app starts sign-in with a top-level link so embedded mobile browsers hand control to the authentication flow correctly.
