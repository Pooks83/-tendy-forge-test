# Goalie Forge canonical product experience specification

Revision 0.9 | 2026-09-06 | Normative design candidate; release gate in REVIEW.md.

## 1. Evidence and authority

Baseline: published Version 8 at https://goalie-forge.mbalta001.chatgpt.site, source commit 4fbe85543f93780f487d57ab250c6623ecf32a4a. The current live entry and parent setup were captured during this audit at 1363 × 936. Coach waiting and its Back control were also inspected. No real profile was created or private record changed for this design exercise. Current application behavior behind a populated profile is source-inspected, not a newly executed live journey. Authentication provider, iOS webview, mobile widths and assistive technology are not verified by desktop screenshots.

Authoritative source inspected: app/page.tsx, app/chatgpt-auth.ts, app/api/training/route.ts, app/training.css, components/goalie-forge/{training-app,auth-links,drill-map}.tsx, lib/{training,training-actions,training-navigation,training-request}.mjs, lib/training-store.ts and db/schema.ts. Earlier inventory and shell-repair documents are historical inputs, not approval evidence.

### Actual system inventory

| Existing surface | Implementation | Status and design disposition |
|---|---|---|
| Root and four views | `/`, `?view=train`, `?view=progress`, `?view=profile` | One client app; retain concepts, introduce explicit profile/workspace routes |
| Authentication | Dispatch-owned sign-in, callback, sign-out; top-level links | Keep provider ownership; unify authenticated account contract |
| First run | AccessShell → EmptyAccount → Setup or coach waiting | Reachable live; remove marketing-sized empty vertical space in target |
| Home | Session card, six drill rows, finish CTA, badge | Source-inspected; simplify into Today template |
| Train | 20-week list | Source-inspected; separate schedule from mastery; no false curriculum claims |
| Progress | Summary, six groups, history | Source-inspected; reuse detail templates and explain evidence |
| Profile | Identity, selector, expanded adult tools | Source-inspected; decomposed into explicit adult workspace destinations |
| Drill dialog | Instructions, generic diagram, dose, start, set, rest, easier version, stop | Source-inspected; full-page drill on all widths removes nested workflow |
| Evaluation | Ten sections inline in Profile; one cause and note; last three results | Source-inspected; replace with resumable evaluation and full history |
| Sharing | Email grant plus separately managed Site audience | Two independent permissions; no invitation is sent today |
| Persistence | training_profiles JSON state, revisions; training_coach_grants email keys | Existing durable records; not organization/season/relationship model |
| Feedback | Sonner toast plus simultaneous custom celebration; inline errors | Consolidate into one success event, persistent error panel |
| Confirmation | Inline permanent-delete controls | Replace with one accessible destructive confirmation |
| Other shared components | Dialog, Progress, Toaster; starter UI files | Only imported production primitives belong to product inventory; unused starter controls are not features |
| Required but missing | Organization/team/season directory, memberships, real player capability, adult re-entry, account settings, edit profile, persisted evaluation drafts, notifications inbox, enrollment acceptance, full history detail | Specified target; not represented as implemented |

No current standalone settings, password-reset form, organization admin page, notification center, team coach workspace, skill detail route or achievement detail route was found. No app-owned tooltip/popover/drawer is reachable today; native select menus and the drill dialog are the current overlays. Some starter files remain untracked; do not delete them automatically as part of a design task.

### Root-cause defects to prevent

| ID | Severity | Evidence/root cause | Normative correction |
|---|---|---|---|
| DEF-01 | P0 risk | Owner session can perform adult actions; player view only hides UI | Server-scoped player capability plus fresh adult reauthentication |
| DEF-02 | P1 | Source has only owner/coach grants and free-text team | Relationship-based authorization, organization/season/team models |
| DEF-03 | P1 | Profile contains unrelated training administration, evaluations and account actions | Role-appropriate shell and independent task routes |
| DEF-04 | P1 | Every block receives every weekly skill; mastery text uses generic prefixes | Explicit content-to-skill evidence graph; per-skill measurable rubric |
| DEF-05 | P1 | Path minutes grow but repetitions are unchanged | Honest time budget by instruction/practice/rest; no invented physical workload |
| DEF-06 | P1 | Dirty evaluation lives only in component state; repeat submission duplicates records | Server draft + idempotent finalization + immutable revisions |
| DEF-07 | P1 | Profile switch is local state; URLs lack profile/session identity | Canonical URL context; preserve selected profile across authorized reload |
| DEF-08 | P1 | 401 mapped to guest on load but mutation errors do not establish an auth boundary | Shared authentication state machine and safe return destination |
| DEF-09 | P2 | Errors reload all profiles, potentially discarding editing context | Local retry, conflict reconciliation and explicit draft preservation |
| DEF-10 | P2 | Broad brand selectors and shared setup/training shell caused prior regressions | Structural components, named slots, visual regression matrix |
| DEF-11 | P2 | Modal houses an entire training task; two simultaneous celebrations | Page workflow plus one reward announcement |
| DEF-12 | P1 | App helper accepts email as identity; API requires id plus email | One server-validated identity object, no partial signed-in state |

## 2. Product boundaries and requirements

REQ-01: At-home/off-ice only. No physical on-ice actions, butterfly/RVH drops, pad slides, diving or collisions. Hockey game situations may be taught through seated diagrams/video questions; tag these `concept`, never on-ice mastery.

REQ-02: Primary player audience 10–15. Under-10 examples in prior requests are not authorization to silently classify a nine-year-old as 10–12. Setup must show “This program is designed for ages 10–15.” Selecting outside range blocks prescribed sessions and offers “View a sample” and “Back.” Adding under-10 training requires a separately reviewed curriculum, not adjusted birth data.

REQ-03: Twenty curriculum weeks are a content cycle, not a mastery countdown or a guaranteed AHL pathway. Each path has stable weekly commitment: Foundation 3 × 30 minutes (90/week); Builder 3 × 45 (135/week); Performance 4 × 60 (240/week), including a low-impact fourth session. Proposed commitments retain current intent but require qualified youth-training approval. No extra repetitions to fill a time budget. Missed days never stack or increase tomorrow’s load.

REQ-04: Accomplishments, not attendance, unlock eligibility. All 30 skill IDs require valid evidence for the active rubric version; six groups each require evidence on two local dates. A completed week/session does not certify a skill. The next path starts only after guardian acceptance of the increased commitment; the final path offers maintenance, not an invented fourth path.

REQ-05: Child copy is specific, short and concrete. Instructions show exact sets, attempts/reps/seconds, rest, space, equipment, cue, easier option and approved instructional media before Start. “Attempt” includes a miss; success benchmark is separate. No punitive streak, leaderboard, gambling-like rewards, random loot, paywall or time-on-screen incentive.

REQ-06: Identity, authorization, relationships and display mode are different concepts. No child email required. Guardian manages the player. Coach access is scoped. The app must never promise security by hiding buttons.

REQ-07: Safety pause overrides every progress action immediately, including offline. Never gate Stop behind a pending save. Persist locally for immediate safety behavior and reconcile to server; local pause is a fail-safe, not a substitute for permission checking. Guardian review is not medical clearance.

REQ-08: No live application changes while this package is being designed. All target screens are contracts, not claims of implementation. Content and human-review gates remain visible.

REQ-09: All critical state changes must be acknowledged from the server; no unconfirmed badge, deletion or mastery. No requests that record activity are triggered by route navigation alone.

REQ-10: WCAG 2.2 AA is the implementation target; target size is a product minimum of 48 CSS px for controls, not a claim that WCAG AA requires 48 px.

## 3. Canonical information architecture

One product, three shell templates. Access shell: brand → task heading → form/content → action → sign-out/help; no player nav or centered viewport distribution. Player shell: safe-area header → player context → page content → four-item bottom navigation. Adult shell: workspace context → role-specific four-item navigation → task content. Same tokens and components for all shells.

Player: Home, Train, Progress, Profile. Parent: Players, Development, Activity, Account. Goalie coach and team coach: Goalies, Evaluations, Plans, Account. Organization admin: Teams, People, Activity, Account. Account/role picker lists only actual memberships, never grants a role when selected. An adult with several roles selects a workspace; an adult with one role goes directly there. Player mode is entered deliberately for a chosen child, never automatically on every adult login.

Sitemap: `/access` → `/setup` → `/workspaces` → `/adult/players` OR `/coach/goalies` OR `/org/:org/teams`. Player entry `/p/:player/home`, siblings `/train`, `/progress`, `/profile`; drill `/p/:player/sessions/:session/drills/:drill`; session result `/p/:player/sessions/:session/result`; skill `/p/:player/skills/:skill`; history `/p/:player/history`; achievement `/p/:player/achievements/:achievement`. Adult development `/adult/players/:player`; evaluation `/evaluations/:evaluation`; plan `/plans/:plan`; account `/account`. Registry defines every template and parameterized child.

Templates, not duplicated screens: player/coach skill detail shares content with role-scoped actions; guardian/coach evaluation uses one editor; new/edit team share one form; new/edit plan share one form; denied/deleted/expired use one recovery page with truthful reason only after authorization.

### Routing rules

- Server resolves session, capabilities, membership and resource before returning private data. Check again on each write. URL identifiers are opaque, not names/emails.
- Preserve safe same-origin return routes through auth; reject external URLs and auth-loop routes. If not authorized, show SCR-SYSTEM-001. Do not silently load a different player.
- Browser Back follows history. In-app Back returns the defined logical parent if no same-workspace predecessor exists. Detail screens include the current player name. Navigation restores prior scroll per route/profile; new context begins at top and focuses h1.
- Changing tab creates history only if destination differs. Changing query filters replaces history; Search submit may push a single entry. Overlay open pushes one entry; close/back pops that entry, not arbitrary prior history.
- Unsaved form transition uses MOD-LEAVE-001. Draft saved → Back safely leaves. Mutation pending → navigation may leave but reconcile by operation ID before enabling a repeated submission. Never trap external browser closing; use beforeunload only for truly unsaved edits.
- Deep-link expired session is read-only history with “View current training”; never silently apply a result to current session. Deleted/unavailable resource gives “This item is no longer available” and logical parent. Unauthorized existence is not disclosed.
- Legacy `?view=` routes resolve to the selected authorized profile then replace with canonical route; if multiple profiles and none selected, open picker preserving intended view. Legacy `?drill=` without session maps only to current session after confirmation of profile; unknown drill returns Train with a visible message. Do not implement two navigation systems concurrently.

## 4. Roles, relationships and capability contract

| Capability | Player session | Guardian | Goalie coach | Team coach | Org admin |
|---|---|---|---|---|---|
| Read training/progress | Own selected player | Linked children | Explicit assigned players | Players on assigned active team, summary by default | Roster metadata only unless separately assigned |
| Record sets/answers | Own authorized session | Linked child in player workflow | No | No | No |
| Stop training | Own player | Linked child | Assigned player | Assigned player | No, unless additional role |
| Clear safety pause | No | Linked child, fresh adult check | No | No | No |
| Record observations/evaluation | No | Linked child, author tagged guardian | Assigned player | Assigned player, author tagged team coach | No |
| Propose plan priorities | No | Linked child | Assigned player | Assigned player | No |
| Activate higher commitment | No | Guardian confirmation | Recommend only | Recommend only | No |
| Edit profile/export/delete | No | Owning guardian; deletion excludes co-guardian unless owner | No | No | No |
| Manage teams/seasons/members | No | Request enrollment | No | Own team read roster | Scoped organization |
| Manage guardian access | No | Owner through verified invitation | No | No | No |
| Grant coach access | No | Owner, exact scope | No self-grant | No self-grant | Assign team staff; guardian consent still required for individual data |

Accounts have memberships `{accountId, orgId, role, teamIds, seasonId, status}`. Household ownership is explicit: `Household {householdId, ownerAccountId, revision}` and `HouseholdAdult {householdId, accountId, householdRole: owner|coGuardian, capabilities, acceptedAt, revokedAt}`. A player has exactly one active `householdId`; ownership transfer is a fresh-auth, two-party operation that appends an audit event and cannot leave a household ownerless. Player relationships for coaches are `{accountId, playerId, kind, capabilities, acceptedAt, revokedAt}` and never imply household ownership. Capability resolution is deny-first: revoked/expired relationship or membership denies; then resource household/team scope must match; then the exact capability must be present. Owner-only capabilities (`deletePlayer`, `manageGuardians`, `exportHousehold`) are never inherited by co-guardians. Safety clear is allowed to owner or an accepted co-guardian with explicit `clearSafety`, but export and deletion remain owner-only. Role picker is context only. A guardian may be a coach for a different child; do not union write privileges across profiles. Effective access = authenticated account ∩ Site audience ∩ active membership/relationship ∩ exact capability ∩ resource ownership/scope.

Player session: guardian selects child and taps “Start player mode.” Server mints a revocable player-only session and invalidates adult capability in that browser context. Adult re-entry uses provider reauthentication with freshness enforced server-side; no bypass PIN based on a date or an arithmetic quiz. If hosting identity cannot support scoped session and fresh reauthentication, block independent player mode release and label the present product “Adult-supervised training”; never imply a child security boundary. Revocation closes outstanding player capability. Shared-device sign-out clears only that account’s local private caches.

Organization access invitations are not automatic account creation. Named recipient sees organization, team, role and precise data scope before Accept. No/Decline makes no relationship. Site access pending is distinct from app invitation pending. If Site tools cannot verify access from app, display “Site access not verified” with owner instructions, never “Invitation sent.” Organization administration cannot grant itself access to household exports or private notes.

## 5. Data and state model

Organization → Season → Team. Household → owner/co-guardians → Player. Player can have multiple team enrollments by season; enrollment never duplicates the player. Account → organization membership and household/coach relationships. Player → development path enrollment → curriculum version → session → drill prescription → set/answer results. Player → observations/evaluation revisions → plan priorities → achievements. Audit event records actor, scope, operation ID, timestamp and reason; never record unnecessary sensitive free text in application logs.

Use immutable UUIDs, server timestamps, profile timezone, versioned rubrics/prescriptions and revision checks. Display local dates with timezone under historical records when ambiguous. Completed session retains prescription version. Corrections append a superseding record; they do not silently rewrite history. Mastery is derived from valid evidence, not a client-submitted boolean. Removing access preserves legitimate authored evidence with author attribution, but hides any private notes no longer authorized.

Persist on server: memberships, accepted relationships, settings, schedule preferences, draft evaluations/plans, results, safety state, observations, achievements and last authorized workspace/profile. Keep temporary in memory: open disclosure, selected media frame, focus/scroll and transient toast. Persist only non-sensitive preferences locally (reduced animation preference); no offline roster or coach-note cache. An active drill’s pending non-safety result may be purged on sign-out after reconciliation. A pending Stop uses encrypted device escrow containing only the consumed signed stopNonce, stopEventId and pseudonymous player/device binding; sign-out locks but does not delete it. The next online app launch reconciles safety escrow before any player session can start, then deletes the escrow only after server acknowledgement or an adult explicitly reviews a local-only stop. Do not save private draft text in URLs or unencrypted long-lived local storage.

Mutation contract: client creates operation UUID, sends resource/revision/action. Button becomes “Saving…” and cannot issue a second UUID for the same operation. Server enforces unique operation ID; retries return original result. Network timeout means unknown, not failure: GET operation status or reload the single resource before offering retry. 409 presents latest record and preserved draft; never overwrite silently. 401 locks private content and reauthenticates; 403/404 purge revoked context and do not retry automatically. 429 honors Retry-After; 5xx uses explicit retry, maximum one automatic safe GET retry. Never replay destructive or permission-changing operations automatically.

## 6. Shared state machine and exact recovery copy

All registry screens inherit these states according to state family; none are omitted silently. A state is either applicable with behavior below, or N/A with reason: read-only screens have no Saving/validation; access screens have no private populated data; static help has no server mutation. Each form additionally specifies field rules. Overlay content inherits the parent resource state.

| State ID | Render and controls | Exit/result |
|---|---|---|
| STATE-LOADING | Keep shell geometry. Skeleton matching content, no fake scores. aria-busy; “Loading…” after 1 second | Data → ready; after 10 seconds “Taking longer than usual” and Retry; at 30 seconds error panel |
| STATE-READY | Render current data, one primary action | Trigger defined in screen registry |
| STATE-EMPTY | Screen-specific heading, reason, next action; no zero-as-failure score | Create/select/change filter or Back |
| STATE-SAVING | Preserve inputs, disable duplicate action, “Saving…” status | Acknowledged → Success; uncertain → Network |
| STATE-SUCCESS | Inline saved state plus single polite announcement | Remain or defined next page; focus destination heading |
| STATE-VALIDATION | Error summary linked to fields and error text next to each invalid input | Correct on blur; submit validates all; do not erase input |
| STATE-NETWORK | “That change is not confirmed. Reconnect to check your saved progress.” No reward | Reconcile operation then Retry if definitively not applied |
| STATE-OFFLINE | “You’re offline. Saved progress cannot update yet.” Read loaded task; no next demanding set until sync; Stop always works | Online → fetch permissions and reconcile before edits |
| STATE-UNAUTHORIZED | “Your session ended. Ask an adult to sign in again.” Redact private content | Sign in → same authorized draft/route; Cancel → Access |
| STATE-DENIED | “You don’t have access to this item.” No names or hidden data | “Choose another workspace”; no self-grant |
| STATE-DELETED | “This item is no longer available.” Only reveal prior authorized context | Parent list, current session or workspace |
| STATE-STALE | “This changed on another device.” Latest value + draft, no automatic overwrite | “Use saved version” or “Review my changes”; fresh revision save |
| STATE-PARTIAL | Available sections remain; failed section has “This section didn’t load” + Retry | Section-only GET; never invent zero values |
| STATE-DISABLED | Capability/requirement explanation adjacent, not hover-only | Resolve reason or use alternate path; not a dead button with no explanation |
| STATE-WARNING | Amber icon and text; e.g. “Training is paused. Check in with an adult.” | Explicit safe next action; no auto-dismiss |
| STATE-EXPIRED | “This invitation expired” or “This session is from an earlier plan” | Request new invitation / view current session; no stale mutation |
| STATE-RETRY | Retain context and valid fields; status “Trying again…” | Same result rules; no new history loop |
| STATE-LONG | Wrap headings, labels, emails; preview text may clamp with “Read more” | Full content accessible without horizontal scroll |
| STATE-LIMIT | “You’ve reached the limit of 8 player profiles.” Existing records editable | Manage existing players; do not recommend deletion as default |
| STATE-MIGRATION | “We’re updating how your progress is organized.” Previous data read-only | Valid migrated record → ready; failure → support/reference code, never reset |

Priority when states collide: safety > permission/session > resource unavailable > migration/conflict > offline/network > validation > saving > partial > empty/ready > celebration. Stop is available during all applicable physical-task states. A revoked profile is never shown just because a prior successful fetch exists.

## 7. Component library and interaction contract

The registry uses CMP-SHELL, CMP-NAV, CMP-CONTEXT, CMP-FORM, CMP-LIST, CMP-DETAIL, CMP-DRILL, CMP-CHART, CMP-FEEDBACK and CMP-OVERLAY. They expand into these canonical primitives; no undocumented one-off variants.

| Primitive | States and behavior |
|---|---|
| Primary/secondary/danger button | Default, hover, visible focus, pressed, disabled, loading. 48px minimum height; auto height when wrapped. Enter/Space activate once. Loading retains width; label describes action. No nested buttons |
| Text input/textarea | Persistent visible label, helper and error IDs. 16px input font. Required indicated in text. Error after blur or submit, not first keystroke. Composition input supported; trimmed only on submit. Disabled distinct from readonly |
| Select/radio/checkbox | Native accessible semantics where possible. Radio for ≤5 visible choices; select/combobox for longer lists. Never changes permission on selection. Space toggles checkbox; arrow keys navigate radios. Label is clickable. Searchable list returns “No matches” with Clear search |
| Toggle | Only immediate reversible preference; selected state text “On/Off”. Pending acknowledged before success; failure restores previous state. Never use toggle for deletion or role grants |
| Card/list row | Noninteractive card has no hover affordance. Whole-row navigation uses one link; row trailing action is separate sibling control. Primary label + max two metadata lines + text status. List pagination 25/page; filtered count and Clear filters |
| Tabs/navigation | Real links with aria-current; section tabs use tablist only for same-page panels. Selected indicator includes weight/shape, not red alone. No swipe-only destinations |
| Progress/badge | Accessible name, actual numerator/denominator, separate task completion vs skill evidence. Empty not a progress ring at zero. Locked reward includes exact requirement in words |
| Avatar/context picker | Initials only, no child photos. Accessible name includes selected nickname and function. Picker groups by workspace/team, searchable above 8 options. No auto-select of first match on refresh |
| Chart | Six group progress bars or simple history trend; table/text equivalent always available. Not a radar chart implying comparable biological traits. No 3D/animation for precision data |
| Media instruction | Actual reviewed drill-specific sequence, 3 frames setup/move/finish. Caption names rep count convention, key joints and finish. Video poster with Play; no autoplay; pause, replay, captions, transcript, speed controls. Media unavailable → text/easier approved fallback; unsafe-to-understand movement cannot Start |
| Tooltip | Optional explanation only; focus/hover opens; Esc dismisses; content hoverable. Required instructions never tooltip-only. No delay-dependent child task |
| Toast | One announcement after acknowledged action, 4 seconds, no essential action inside. Not sole proof of saving; visible completed state remains. Pause dismissal on hover/focus; allow manual dismissal |

### Overlay catalogue

| ID | Purpose/trigger | Confirm | Cancel/Close/Back/Escape | Failure |
|---|---|---|---|---|
| MOD-CONTEXT-001 | Header context button | Select authorized workspace/player, refetch capabilities, destination h1 | Return unchanged, focus trigger | Keep old context; show Retry; denied selection removed |
| MOD-LEAVE-001 | Unsaved edits + internal navigation | “Save draft and leave” → server ack → intended destination | “Keep editing” returns form; “Discard changes” explicitly discards unsaved edits only | Save fails → remain with draft; no navigation |
| MOD-DELETE-001 | Owner chooses delete | “Delete player and records” after exact nickname confirmation; operation ID | “Keep player”; backdrop does not dismiss | Remain, “Deletion not confirmed”; reconcile, no blind retry |
| MOD-REVOKE-001 | Remove relationship | Show person, player/team and lost scope; “Remove access” | “Keep access”; no mutation | Preserve grant row, error; no fake removal |
| MOD-ADVANCE-001 | Eligible guardian accepts next path | Show old/new days × minutes, start date and retained history; “Start next path” | “Stay on this path”; mastery retained | Remain at current path until ack |
| MOD-SAFETY-001 | “Stop—something hurts” | Stop is immediate BEFORE overlay. “Tell an adult” acknowledgement closes to paused Home | Any dismissal leaves safety paused | Offline text confirms local pause; never invites continuing |
| MOD-INVITE-SEND-001 | Sender reviews invitation | “Send invitation” uses exact recipient/scope and creates pending only after confirmed delivery | “Edit details” returns form; Close creates nothing | “Invitation not sent”; Retry same operation after status check |
| MOD-INVITE-RECEIVE-001 | Recipient reviews access | “Accept access” binds authenticated exact intended recipient | “Decline”; closing leaves pending, no acceptance | Expired/identity mismatch → recovery, never silently reassign |
| MOD-HELP-001 | “How this works” optional help | None; links navigate with dirty guard | “Close”; focus trigger | Text fallback; no blocking spinner |

Dialogs: one modal at a time; autofocus title for reading, first invalid field after validation, Cancel for destructive dialog. Inert background, focus trap, accessible title/description, restore focus. Confirmation max-width 440px; content max-height calc(100dvh - 32px), internal scroll, actions remain in flow. At ≤599px selectors become bottom sheets with 16px top radius and safe-area bottom padding; critical confirmations remain compact dialogs. Drill and evaluation are pages, never nested modal stacks. No swipe-to-confirm, drag-only dismissal or backdrop-close on dirty forms.

## 8. Design foundations and responsive specification

Visual thesis: a clear athletic training companion. White/light-gray surfaces, Saints red for identity/primary action, restrained success green; no maroon/black atmosphere, glow or decorative dashboards. No cartoon mascot. Badge imagery is equipment-inspired and optional, never blocks training.

Tokens: canvas #F5F7FA, surface #FFFFFF, text #182536, secondary #526174, brand #B31330, brand-hover #941027, border-control #768395, border-decorative #DFE5EC, success #16643B on #E5F4ED, warning #704600 on #FFF4DD, danger #A1122D on #FFF2F4, focus #175F9B. These are proposed tokens; computed contrast validation is a release check. Do not use decorative border color as an input's only visible boundary.

Typography: system/ui-sans stack; body 16/24 regular; field labels 16/24 medium; secondary 14/20; caption 12/18 only nonessential metadata; h1 28/34 mobile, 36/42 desktop; h2 22/28; h3 18/24. No uppercase paragraph copy. User names never forced nowrap. Text can enlarge 200%; fixed heights forbidden on text containers.

Spacing tokens 4,8,12,16,24,32,48. Card radius 16, control 12, small status 8, pill only for compact status. Border 1px; focus 3px with 3px offset. Elevation only overlays: 0 12px 32px rgba(24,37,54,.16). Icons 20/24 stroke, with text for unfamiliar meaning. Motion 120–180ms opacity/translation ≤8px; reward ≤600ms, no flashes; reduced-motion removes movement. No autoplay sound/haptics by default.

| Width | Geometry and navigation | Detail/forms/media |
|---|---|---|
| 320 | 12px gutters, 296px content; stacked cards, 4 equal nav cells ≥48px, short labels | Full-page drills; dose stacked; actions full width; long labels wrap |
| 375 | 16px gutters, 343px content | 3 dose facts wrap to 2 rows; full-width CTA |
| 390 | 16px gutters, 358px content | Same rules, not a separate hard-coded breakpoint |
| 430 | 16px gutters, 398px content | No extra column; preserve reading width |
| Tablet 768 | 24px gutters; bottom navigation; content minmax(0,1fr) | One-column form ≤640px; list/detail remains one column until ≥900px |
| Desktop 1280 | Max 1200px shell, 200px side nav, content minmax(0,1fr); 32px gutters | Form ≤640px; detail ≤760px; dashboard 2 columns only for independent content |

Header is normal flow, content-height driven, minimum 64px plus safe-area top. Not vertically centered by auto margins across full viewport. Mobile nav min 64px plus safe-area bottom; main bottom padding equals nav measured height +24px. Keyboard open: hide bottom nav, scroll focused input and error into view, keep submit in document flow. Viewport meta width=device-width, initial-scale=1, viewport-fit=cover; never disable zoom. Do not mask overflow with clip as a substitute for fixing child width. Grid tracks minmax(0,1fr); flex children min-width:0; media max-width:100%; long tokens overflow-wrap:anywhere.

Instruction images: one reviewed figure with full-width frame controls on small screens; three simultaneous frames only when each has ≥220px width. Text alternative contains the same mechanics. Charts become labeled horizontal bars; data tables become label/value list cards on small screens, with sorting/filtering controls preserved. No essential horizontally scrollable tables.

### Accessibility acceptance

Target WCAG 2.2 AA. Authoritative reference: https://www.w3.org/TR/WCAG22/ and https://www.w3.org/WAI/WCAG22/understanding/. Validate normal text contrast ≥4.5:1, large text ≥3:1, essential UI boundaries/states ≥3:1. Product touch target 48px; keyboard reachability, visible non-obscured focus, skip link, one main landmark, h1 once, named regions and labeled controls. Support 200% text resize and 320px reflow. Status messages announced politely, errors assertively once; countdown is not read every second. Offer textual time remaining on focus and announce rest ready once. No forced memory puzzle in app auth; allow password manager/paste in provider flows. Captions/transcripts for all instructional video, meaningful alt text, text-independent symbols for success/warning. Automated checks alone do not prove compliance; manual keyboard, VoiceOver/Safari and NVDA/Chrome tests remain required.

## 9. Training, evaluation and rewards contracts

### Drill record must be complete before it can be assigned

`drillId, contentVersion, name, playerCue, offIce=true, movementType, exactSkillIds, ageBand, pathVariant, sets, doseUnit, dosePerSet, perSideRule, attemptsIncludeMisses, restSeconds, setupMinutes, workMinutes, learningMinutes, restMinutes, reflectionMinutes, equipment, floorSpace, supervision, setupSteps, movementSteps, finishCheck, easierVariantId, safetyStopRules, mediaAssetId, transcript, reviewerId, reviewedAt`.

Current generic diagrams and generic per-path rubric prefixes are not approved final assets. Every drill requires mechanics-specific review, and every skill needs a measurable observation protocol. Production content stays blocked if a media asset or appropriate fallback is absent. No five-second generic animation can prove how to perform a different movement.

Example approved-format copy (illustrative, pending qualified content review): “Wall ball: two-hand catch”; “3 sets • 10 throws each set • Rest 30 seconds”; “A miss still counts as one throw.” Setup: “Use a soft ball. Stand two big steps from a solid wall. Keep people and glass away.” Do: “Throw gently below shoulder height. Watch the ball into both hands. Reset your feet. Count 10 throws.” Finish: “You made 10 throws. Tap Finished set 1.” Easier: “Let the ball bounce once before catching.” Safety: “Stop if anything hurts. Tell an adult.” Media must show this exact throw/catch, not generic wall arrows.

Session state: planned → ready check → active drill → acknowledged set → rest (minimum, extendable) → next set → drill complete → next drill → session review → acknowledged completion → badge. No timers imply “keep exercising until time runs out.” Pause saves rest remaining. Closing a drill does not reset sets or award completion. Wrong reading answer gives explanation and “Try again”; a valid chosen response plus explanation acknowledgement completes the learning task, not mastery. Do not require repeated guessing to unlock progress.

Home after every drill: “Save made. Wall ball complete.” + visible completed row; one CTA “Next drill.” Last drill: “All drills complete. Finish session.” Finishing is idempotent. First reward: “First Save — your first complete session.” Repeated sessions earn a dated session record, not unlimited duplicate First Save badges. Progress shows scheduled sessions completed this week, not consecutive-day streak. Rest day: “Recovery counts. Your next session is Wednesday.” No shame, expiring reward or push prompt at celebration.

Schedule is a set of planned local dates, not an enforcement that prohibits rest. Completing early never queues a second demanding session for the same day. Guardians can reschedule without changing total commitment; two demanding sessions cannot share a date, and at least one recovery day separates them. Performance fourth low-impact session must be explicitly tagged and reviewed. School/team sport workload is considered at guardian confirmation. If safe schedule cannot fit, remain in current path and explain why.

Twenty-week coverage matrix must map every session block to the skills it actually practices. “Skill mentioned in weekly question” ≠ physical practice or accomplishment. Skills 17–30 use off-ice perception scenarios, gentle ball tasks or behavior evidence; save selection and post technique remain conceptual. Do not claim on-ice competence, professional readiness, or predictive athletic outcomes.

### Evaluation

Single 50-minute target protocol: warm-up 5, footwork 5, tracking 5, hand-eye 5, lateral 5, seated release/decision scenarios 7, recovery 5, scanning 4, ball control/communication 4, quality/reset 3, transitions 2. Stop/pause allowed; record actual elapsed separately, never count duration as quality. Behavior is observed throughout and summarized in final section. No on-ice movements from earlier supplied coach routine are prescribed here.

Each section: task-specific standard attempts, equipment, illustration/scenario ID, watch-for checklist, 0 Not observed / 1 Needs support / 2 Sometimes controlled / 3 Consistently controlled, attempts/successes where relevant, reason not observed, specific evidence note, and optional missed-task events. Every missed-task event stores exactly one primary cause: positioning, tracking, movement, save selection, execution, decision-making. “None” applies only to no missed event, not an unknown cause. Uncertain cause is explicitly `unclassified` and requires review; never guess to fill a dropdown.

Draft auto-save 1 second after idle or blur; visible “Draft saved at 10:42.” Only finalized evaluation enters progress. Finalize requires all ten sections either rated or marked not observed with reason; evidence plus one next step. Entirely unobserved review cannot finalize. Editor may pause and resume; no session timer blocks saving. Snapshot protocol/rubric version on creation. Finalized record immutable; “Correct this review” creates revision with reason and preserves previous. Each observed evaluation section maps to zero or more exact skill/criterion IDs in the versioned protocol. Before finalization the evaluator explicitly marks each mapped criterion “Achieved,” “Keep practicing,” or “Not enough evidence”; a numeric section rating never sets that outcome. Finalization creates one EvidenceRecord per mapped criterion with that explicit outcome and `sourceType=evaluationSection`. “Not enough evidence” remains visible history but is ineligible for mastery. The evaluator must have `recordEvidence`; otherwise the evaluation may finalize as narrative but creates no mastery evidence and says so before confirmation. Guardian and coach records are clearly attributed and may disagree; retain both, flag disagreement for review, do not average to a false pass.

Plan: maximum three priorities, each with exact skill, evidence reference, cue, approved drill, success criterion and review condition. Every coach proposal requires guardian acceptance; load or schedule changes additionally require commitment review. Priorities select within prescribed session budget, never append unbounded extra work. Plan changes affect future sessions; active session keeps its snapshot. “Ready for next path” is eligibility, not an automatic move.

## 10. Forms and validation

Setup: nickname 1–24 Unicode characters after trim; team selection required only for organization enrollment, household training allowed with “Not on a team yet”; age choices Under 10 / 10–12 / 13–15 / 16 or older, with no default. Unsupported selection blocks new prescription with “This program is designed for ages 10–15. We can’t assign this training for the age you selected.” Offer View a sample / Back. Existing unsupported-age edit preserves history but suspends active/future prescribed sessions. Guardian affirmation unchecked by default and required. No exact birth date, medical history or child email. Client/server use same validation and accessible field errors. Maximum 8 household players are enforced atomically.

Team name 1–60; season label 1–40; start/end ISO dates with end after start, organization timezone required. Staff email trimmed and normalized for lookup; verification is exact authenticated recipient binding, not regex alone. Never disclose whether an arbitrary email has an account. Observation note 8–600; evaluation section note ≤600 and next-step note 8–600; reason for correction 8–300. Plan title 1–80, cue 1–160; choose 1–3 priorities. Search max 100 characters; clearable. Submission focus errors in DOM order, never only color/toast.

Profile edits show impact: nickname updates display, historical evidence remains same player ID; age-band change affects future prescriptions after guardian review, not prior records. Team move creates new enrollment with end/start dates. Deleting a team archives its memberships, not household training. Deleting organization is outside in-app release scope; administrators contact support to prevent cascading family-data deletion. Organization name/team/season configuration is explicit setup, not hard-coded Saints team data.

## 11. Branch rules used by every flow

Each flow in registry references a start, ordered screens and completion. Every action has one of these branch contracts, with screen-specific destinations:

- YES/Confirm: validate permissions and inputs, execute once, acknowledge, then completion destination. Network/conflict cannot fall through to completion.
- NO/Decline: no mutation except an explicitly named decline record; return logical parent. Higher path refusal preserves all mastery.
- CANCEL/CLOSE/Escape: read-only closes and restores focus; dirty editor uses MOD-LEAVE-001. Invitation Close leaves pending. Safety Close remains paused. Deletion Close keeps record.
- BACK: history/logical parent with dirty guard. No direct state setter that fails to update URL. Auth provider Back returns to Access with retry, no redirect loop.
- SKIP: optional preferences and optional team membership only. Required guardian consent, safety review and sets cannot be skipped; disabled state explains requirement. Not-observed evaluation is not a hidden Skip.
- RETRY: reconcile operation status, retain scoped draft, retry same UUID only if necessary. Retry never grants access or loses selected child.
- LEAVE: preserve acknowledged draft/results. Unacknowledged field text remains in memory during internal navigation guard; closing browser cannot guarantee persistence. Explain unsaved status honestly before departure when possible. Player rest timer resumes from saved server deadline, not an arbitrary reset.

## 12. Edge-case acceptance matrix

| ID | Attack | Expected result / regression scope |
|---|---|---|
| EDGE-01 P0 | Child changes route to adult tools or sends adult API action | Server denies; private UI redacted; every adult mutation tested |
| EDGE-02 P0 | Coach edits/deletes another team’s goalie | No data leaked, 403/404, membership refreshed |
| EDGE-03 P0 | Revocation while editor open | Stop reads/writes, purge cached private fields, recovery screen |
| EDGE-04 P0 | Stop tapped during offline save or duplicated tap | Immediate physical pause; one persistent safety event; no continue path |
| EDGE-05 P1 | Two devices finish same set/session | One result and badge; reconcile operation/revision |
| EDGE-06 P1 | Slow create with retry/back | Same profile ID or recover original; never duplicated household child |
| EDGE-07 P1 | Session expires during evaluation | Draft saved to server stays, redact; reauth same account resumes, other account cannot |
| EDGE-08 P1 | Profile switch with drill open/dirty evaluation | Close/guard, new context explicit; no old set saved against new profile |
| EDGE-09 P1 | Daylight saving or timezone change during rest | Server timestamp duration stable; display local schedule without duplicate day advancement |
| EDGE-10 P1 | Week 20 complete without mastery | Maintenance content cycle, retained evidence, no forced level-up |
| EDGE-11 P1 | Level eligibility while active session | Finish or leave existing snapshot; guardian selects next-path start, no mixed prescriptions |
| EDGE-12 P1 | No safe equipment/space or missing media | Approved easier alternative or not-ready; no unsafe forced activity |
| EDGE-13 P1 | All evaluation sections unobserved | Save draft; cannot finalize; tell user which observation is needed |
| EDGE-14 P1 | Old five-section review/missing skill IDs | Preserve legacy history; exclude from new mastery unless reviewed/mapped; never assign fabricated evidence |
| EDGE-15 P1 | Current session content retired for safety | Halt that drill, show approved replacement preserving prior evidence; no stale replay |
| EDGE-16 P1 | Invite wrong email, expired or forwarded | Verify recipient; do not reveal player until acceptance/authorization; resend via owner |
| EDGE-17 P1 | Organization membership ends but guardian still owns child | Organization context closes; household history remains accessible |
| EDGE-18 P1 | Zero profiles or all deleted | Access/Players empty, Create player; no inert training shell |
| EDGE-19 P2 | 24-character nickname, 60-char team, long email | Wrapping, accessible full text; no off-canvas action |
| EDGE-20 P2 | Hundreds of goalies/teams, 20 years of history | Server pagination/filter, 25/page, preserve query and count; no render-all wall |
| EDGE-21 P1 | Export/delete response lost | Reconcile exact operation; no phantom success or repeated destructive call |
| EDGE-22 P1 | Duplicate/malformed migrated state | Validate/quarantine broken sections, preserve original backup; no silent reset |
| EDGE-23 P2 | 200% text, keyboard covers action | Reflow, document scroll, no fixed-height truncation |
| EDGE-24 P1 | Coach/guardian disagree on achievement | Attributed evidence, review request, no automatic rank average |
| EDGE-25 P1 | Parent changes age outside supported range | No new prescription; history remains; safe back to profile |
| EDGE-26 P2 | Audio off, reduced motion, screen reader | Equivalent visible/text success; no loss of instruction |

## 13. Deprecation and engineering contract

Deprecate inline ProfilePanel adult mega-screen, duplicated celebration+toast, generic drill diagram as final instruction, week-derived blanket skill labels, local-only profile identity, generic benchmarks, free-text team as organization relation, auth helper/API disagreement, inline destructive confirmation and date-based unlock language. Preserve legitimate existing records. Reuse shared Dialog/Progress/Toaster when appropriate, not a second primitive library.

Implementation order after design approval: authorization/data contracts → route/shell primitives → access/relationship journeys → training and safety → evidence/evaluations/plans → progress/rewards → organization tools → responsive/accessibility/content QA. Feature migration must use one route adapter; no parallel old/new screen selectable by users. Record migration counts and retain rollback data outside UI. Never deploy a capability whose gate is unmet with a fake working control.

Every implementation change includes design IDs, changed shared pattern, affected consumers, state transitions and acceptance scenarios. If implementation exposes ambiguity, change registry/spec, rerun review and then code. CI checks route registry, action capability matrix, content media/rubric completeness, idempotent saves, migration fixtures and screenshot comparisons at all six widths. A screenshot check that only looks for a CSS selector is not responsive testing.

## 14. Coverage gate and evidence hierarchy

Count identified templates, flows, action records, overlays, state families and unresolved findings mechanically. Do not count permutations that were never designed as tested. A parameterized screen is one template, not thousands of fabricated designs. Registry completeness proves references and required fields only. Acceptance requires all primary actions specified, all critical edge cases resolved in design, all required instructional media/rubrics supplied, six responsive widths visually exercised, keyboard/screen-reader tests and four review perspectives closed. “Engineering rarely needs to invent UX” is not met while content and identity contracts remain unverified dependencies.

Source evidence outranks prior prose claims about what exists. Normative specification outranks historical implementation when choosing what to build next. Human-approved safety/privacy policy and hosting capability limits constrain both. Unresolved material decisions are release blockers, not hidden assumptions.

## 15. Independent review resolutions — binding clarifications

### Safety event ordering (ENG-01 / QA-01)

Stop has an immutable stopEventId, server safetyRevision and one-time pre-signed `stopNonce` minted in a small batch with the player session. Each nonce binds nonce ID, player, device session, grant issue/expiry and server signature; the client cannot mint IDs that validate. On Stop, the client consumes one nonce and stores it in encrypted escrow. Server accepts an unused validly signed nonce up to 24 hours after its embedded grant expiry, even after sign-out/revocation, only as a safety event: it can pause training, cannot alter results or reveal data, and is idempotent by nonce ID. Later or missing-nonce events remain local-only and require adult review on that device. This bounded rule uses server-signed issuance/expiry, never a claimed client creation time. Local pause is always immediate. Guardian clear acknowledges exact known stopEventIds and current safetyRevision after displaying latest events. Server rejects a changed revision: “Another stop was recorded. Review it before clearing the pause.” A delayed unreviewed authorized Stop always re-pauses. Duplicate delivery of the SAME reviewed nonce is idempotent, not a new stop. Set/finish can never clear safety. SCR-SAFETY-001 receives the latest stopEventIds and safetyRevision from the server and submits both with the clear operation. Reconnect checks safety before reconciling pending training results. Test offline Stop A → clear B → A reconnect; 23-hour vs 25-hour delivery; reused/tampered nonce; revoked grant; wrong device/account binding; clear/Stop race; finish response after Stop. Client clocks cannot order safety decisions.

### Initial schedule and missed work (PD-01 / ENG-02 / QA-02)

Profile creation leads to SCR-SCHEDULE-001. New players start Foundation, never a higher path based on age. Confirm timezone (device suggested), start date, three training weekdays and the next 14-day preview. Check “I reviewed this alongside school and team activities.” Atomically activate enrollment and create session IDs, then enable player mode. Back leaves resumable setup. Schedule edits use the same screen.

Missed work stays the next uncompleted curriculum item; move it to the next valid planned date without stacking. Seven local days overdue prompts guardian plan review before resuming demanding sessions. Validate adjacent weeks, at least one local recovery day between demanding sessions, and unchanged weekly commitment. Low-impact session may be adjacent only when reviewed. Conflict copy: “These days leave no recovery day between demanding sessions. Choose different days or stay on this path.” Keep accepted schedule unchanged on failure.

### Plan proposal lifecycle (PD-02 / ENG-04 / QA-03)

SCR-PLAN-003 is parent Development and coach Plans landing. Create selects authorized player and creates one server draft ID, then editor. States draft → proposed → acceptedPendingCommitment → active / declined / changesRequested / superseded. All coach proposals require guardian decision; guardian-authored changes also pass review. Accept revalidates exact proposal revision, evidence/content and guardian capability. Unchanged-load acceptance activates atomically for the next unstarted session. Higher-load acceptance creates one idempotent `commitmentOperationId` and `acceptedPendingCommitment`; the current active plan remains effective while Schedule and MOD-ADVANCE-001 are completed. Schedule Save and commitment confirmation are one atomic server operation that revalidates proposal, safety, evidence, curriculum, recovery and guardian capability, then marks the proposal active, supersedes the old plan, creates future sessions and returns the new revision. Cancel, timeout or failed validation leaves `acceptedPendingCommitment` resumable and the old plan/schedule active; guardian may explicitly Decline to close it. A 409 reloads the latest proposal and schedule without activation. Active session snapshot remains unless content is retired for safety. Request changes requires a specific note, returning draft to author. Editing submitted proposal creates a superseding revision; old acceptance link cannot activate. No unbounded extra work.

### Evidence validity, disputes and visibility (PD-04/05 / ENG-05 / QA-04)

Canonical `EvidenceRecord` fields are `evidenceId, playerId, sourceType: observation|evaluationSection, sourceId, skillId, rubricVersion, criterionId, attempts, successes, outcome, observedLocalDate, profileTimezone, actorAccountId, actorRole, playerFeedback (≤160), sharePlayerFeedback, adultEvidence (8–600), status, revision`. Standalone observations create one record. For evaluation source, the editor renders a separate criterion row for every section→criterion mapping; attempts/successes are entered or confirmed per criterion (optional only when the rubric declares a non-count conceptual criterion), outcome is explicit, and adultEvidence 8–600 is separately confirmed per criterion. The UI may prefill a section note into each row, but the evaluator must review it and the stored record contains the final criterion-specific value; no apportioning or implicit numeric conversion. Finalization creates one record per eligible criterion row and links all records to the immutable evaluation revision. The observation form labels two separate fields: “Cue the goalie can see” with an explicit Share with player checkbox default OFF, and “Adult evidence note” required and never player-visible. Player projection exposes skill, criterion, date, author ROLE, achieved/practicing/reviewing status and playerFeedback only when `sharePlayerFeedback=true`. It excludes adultEvidence, identities/emails, missed-task details and adult discussion. SCR-EVIDENCE-002 is player-safe; SCR-EVIDENCE-003 is the canonical adult detail route for both evidence sources and links to the source evaluation where authorized. Guardian sees linked child finalized evidence. Author coach sees own draft; assigned other coach/team coach sees authorized finalized evidence, not another author’s draft. Admin without a separate relationship sees no evidence. There is no unmodeled private-note field.

Valid mastery evidence is finalized, achieved, current exact rubric, not superseded/disputed and authored with valid capability at observation. Later misses do not automatically erase legitimate accomplishment. An explicit adult dispute identifies record and rationale and excludes that evidence from eligibility. The owner or co-guardian with `resolveEvidence` resolves non-safety disputes in SCR-EVIDENCE-001: uphold / replace with corrected evidence / invalidate; record immutable rationale and attribution. A “qualified assigned coach” must satisfy both an active player/team relationship with `contributeSafetyEvidence` and `CoachQualification {accountId, qualificationType: youthGoalieSafetyReviewer, issuerId, issuedAt, expiresAt, revokedAt, status}`. Qualification is issued/revoked by a separately designated organization compliance owner or product operator; ordinary org admin membership and self-assertion cannot issue it. Expiry/revocation is checked on request, submission and guardian resolution. A safety-sensitive dispute enters `awaitingCoachInput`; the guardian sends a request to one such coach, who can submit a criterion-scoped recommendation and rationale but cannot resolve. The guardian then resolves with the recommendation visible. Conflicting coach recommendations keep evidence excluded and require a second named qualified reviewer or invalidate; if no qualified coach is available after 14 days, the only safe resolution is invalidate or keep under review—never uphold for advancement. Activity events notify requester and reviewer without exposing adult notes to the player. Distinct group dates are observed dates captured with profile timezone among valid records; offline earlier-date evidence requires adult confirmation/audit annotation. No fabricated backdating from client time.

Invalidation before advancement blocks acceptance. After advancement freeze future higher-load sessions, retain historical enrollment, show guardian review and approved lower-impact maintenance; no silent downgrade or deletion. Restore higher load only after guardian/qualified coach readiness review. All safety pauses still dominate.

### Exact adult tab and URL context (ENG-03)

Adult role-dependent routes require validated `?workspace=:membershipId`; team/season filters add `&team=:teamId&season=:seasonId`. Missing context resolves saved authorized workspace or picker, then replaces URL. Query parameters never create permissions. Org path must match membership. Evaluation/plan ID resolves scope server-side; reject mismatched context rather than showing another player. Account is global but retains return workspace.

Parent: Players `/adult/players`, Development `/plans`, Activity `/activity`, Account `/account`. Coach: Goalies `/coach/goalies`, Evaluations `/evaluations`, Plans `/plans`, Account `/account`. Admin: Teams `/org/:org/teams`, People `/org/:org/people`, Activity `/activity`, Account `/account`. Append workspace to all; preserve authorized filters on reload/back. Lists show all authorized records when no player filter; Create always has explicit authorized player selection. Player URLs use required player ID, and session IDs for drill/results.

### Invitation patterns (DS-03)

MOD-INVITE-SEND-001: “Review this invitation”; recipient, scope and delivery state; Send invitation / Edit details. Close creates nothing. Only confirmed delivery yields Pending acceptance; failure says “Invitation not sent” with Retry. MOD-INVITE-RECEIVE-001: “Review your access”; Accept access / Decline. Close leaves pending. Recipient acceptance never sends another invitation. Both guardian and organization staff senders use the sender overlay. Delivery provider configuration is a release gate; current non-inviting grant implementation cannot claim Send.

### Continuous responsive rules (DS-05)

Ranges: 0–599 compact, 600–899 medium, ≥900 wide. Bottom nav remains through 899; ≥900 uses 200px sidebar +24px gap and minmax(0,1fr) content. At 768 there is bottom navigation, superseding earlier conditional sidebar suggestion. Form width is universally min(100%,640px), not a separate 600px tablet cap. Compact selector uses sheet; medium/wide uses dialog. Test 599/600 and 899/900 as well as six requested widths. These are target rules, not executed product viewport checks.

### Applicability (DS-01/04 / QA-05)

Registry declares shell independently of role; access shell has no app nav. Forms/training include Empty. Mutation-bearing read templates inherit Saving, Success, Stale, Validation and Disabled. The registry counts inherited behavioral contracts, not state screenshots. Permission/destructive/safety/finalization mutations also require their specific overlay and reconciliation contract. No generated coverage metric is accessibility or usability certification.
