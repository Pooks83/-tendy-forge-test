# Goalie Forge

Goalie Forge is the St. Clair Shores Saints’ mobile-first, adult-managed training companion for goalies ages 10–15. Every assigned activity is at-home and off-ice.

## Product architecture

- `/` renders one role-aware application for guests, parents/guardians, players using an adult-managed profile, and authorized coaches.
- `/api/training` is the authenticated data boundary for profiles, drills, evaluations, skill evidence, coach grants, exports, and deletion.
- ChatGPT sign-in establishes adult identity. The private Site audience controls entry; profile ownership and coach grants are enforced separately by the API.
- D1 stores training profiles, optimistic revisions, progress, and coach relationships.
- Home, Train, Progress, and Profile use one responsive navigation and shared design system.

## Training model

- Three accomplishment-based paths: 3 × 30 minutes, 3 × 45 minutes, and 4 × 60 minutes per week.
- Each path keeps its workload constant until the player advances.
- Twenty planned weeks cover all 30 goalie-development skills through physical drills and seated reading tasks.
- Advancement requires adult-observed evidence for every skill and observations on at least two days in each development group. Elapsed time alone never advances a player.
- Physical activities use bodyweight movement, soft balls, floor markers, a wall, or stable household equipment. No on-ice drill is assigned.

## Privacy and permissions

- A parent/guardian owns each player profile.
- A coach must have both private Site access and a profile-specific grant.
- Coaches may record evaluations and skill evidence; they cannot complete player drills, resume a safety-stopped session, advance a path, share access, export data, or delete a profile.
- The product does not collect child email addresses, exact birth dates, photos, public profiles, rankings, or direct messages.

## Development

Requires Node.js `>=22.13.0`.

- `npm run dev` starts the local application.
- `npm run build` creates the deployable Worker bundle.
- `npm test` builds and runs all unit, component, rendered-output, authorization, persistence, and Worker tests.
- `npm run lint` checks source quality.
- `npm exec tsc -- --noEmit` verifies TypeScript.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, and `/callback`; do not create application routes at those paths. The app starts sign-in with a top-level link so embedded mobile browsers hand control to the authentication flow correctly.
