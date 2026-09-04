# Goalie Forge MVP Design

## Goal

Build a responsive, local-first product prototype that lets a youth hockey goalie complete a safe off-ice mission, see credible personal development, advance a career story, and receive parent- and coach-controlled guidance.

The prototype must make the full V1 product behavior tangible. It is not a marketing site, a generic fitness dashboard, or a claim of production child-account infrastructure.

## MVP boundary

The build provides realistic seeded data and device-local persistence. It demonstrates the product's data and permission model in the interface, but it does not claim to implement real authentication, legal verification, regulated consent collection, cloud retention, or external coach identity verification.

### Included

- Mobile-first player experience: Today, Journey, Progress, Locker, Profile.
- Parent controls: household view, schedule, notifications, coach access, data controls.
- Responsive coach console: action-needed roster, player review, weekly focus assignment.
- Structured mission loop: start, activity completion, result capture, substitution, safety stop, reward, progression.
- Story, XP, streak, rest, personal-record and re-test states.
- Local persistence, restart/reset demo controls, accessibility/reduced-motion styling.
- Offline-style and edge-case states surfaced as real UI behavior.

### Excluded from this prototype

- Real identity, parental verification, external coach verification, cloud storage, export generation, legal deletion execution, analytics transmission, push delivery, video/form analysis, wearables, social features, commerce, ads, and payments.

## Architecture

Use a Vinext/React single-page application with client-side state and localStorage persistence. Keep product rules in a pure JavaScript engine so they are testable outside the interface.

### Modules

- `lib/goalie-engine.mjs`: seeded player, mission and coach data; pure rules for mission completion, XP caps, reward entitlement, focus selection, safety stop, and derived status.
- `components/goalie-forge/`: isolated presentation components for player surfaces, parent controls, coach console, and application shell.
- `app/page.tsx`: client state coordinator, local persistence, navigation, and dialog state.
- `app/globals.css`: intentional Forge visual system and responsive behavior.

## Visual direction

**Forge the next save.** The player surface should feel like a premium hockey control room: midnight/navy surfaces, ice-white space, electric cyan for forward momentum, red for intensity/safety, and warm gold for earned milestones. Large type and purposeful motion create energy; rewards must not overpower the next real-world training action.

The desktop surface uses a command-center layout. Mobile prioritizes Today and a thumb-reachable tab bar. Parent and coach views use calmer, denser working surfaces.

## Primary product rules

1. Real-world development is the game input; no passive screen-time rewards.
2. Daily XP cannot exceed prescribed mission XP.
3. Rest, safety, and parent limits override streaks, story gates, and coach focus.
4. Player comparison is personal only; no ranking, percentile, or outcome prediction.
5. Child data is private by default; coach access is role-limited and parent-revocable.
6. A reported safety concern ends affected physical work and exposes a parent action.
7. All reward entitlements are deterministic, with duplicate rewards converted into disclosed tokens.
8. Mission completion and local reconciliation must be idempotent in the product model.

## Primary interaction flows

### Player mission

1. Player opens Today and sees mission, time, equipment, attributes, story stakes and one Start action.
2. Player starts the mission and works through activities with cues, timer/counter and completion control.
3. Player may substitute an activity, pause/resume, or report pain.
4. Completion calculates allowed XP, attributes, personal record, unlock/reward, and next action.
5. The reward moment is skippable and returns to a clear daily state.

### Safety

1. Player reports pain/dizziness.
2. Physical activity pauses and a parent action is shown.
3. Replacement is limited to recovery/mindset content.
4. Coach receives only a non-medical safety-pause signal.

### Parent

1. Parent sees household status, guardian control and child plan.
2. Parent can change schedule, quiet-hours setting, coach access and privacy settings.
3. Parent can demonstrate export/deletion/revocation behavior with clear prototype notices.

### Coach

1. Coach opens exception-first roster.
2. Coach selects goalie and reviews seven-day trend, adherence and current focus.
3. Coach chooses an approved weekly focus.
4. Future mission state updates locally at the next safe boundary.

## Major states to demonstrate

- Active training day, rest day, re-test due, mission complete, offline cached, no eligible physical mission.
- Partial activity, substituted activity, reported safety stop and pending sync.
- Building/Holding/Needs Attention/Insufficient Data attribute status.
- Coach linked/disconnected, consent/version state, export/deletion request.
- Reward earned, duplicate conversion, story lock/unlock, streak protected/at-risk.

## Quality bar

- First viewport has an immediately actionable player surface.
- All controls provide feedback and update the demo state.
- The app works at mobile and desktop widths without horizontal overflow.
- Keyboard-accessible controls, semantic labels, visible focus, and readable contrast.
- Pure gameplay rules have automated tests before implementation.
- Existing rendered HTML validation remains green with product metadata updated.

## Definition of done

The deployed prototype lets a reviewer act as player, parent, and coach; complete a mission, choose a substitute, trigger a safety pause, see progress/reward/story changes, set a coach focus, adjust parent controls, and understand how privacy is controlled. It is visually polished, responsive, built successfully, tested, and privately deployed.
