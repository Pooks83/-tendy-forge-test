# TF-MVP-003 Identity, Household & Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task-by-task. Every production behavior follows RED → GREEN → REFACTOR.

**Goal:** Implement the v1.4 parent account → consent → goalie setup → training plan → atomic child handoff foundation without regressing Version 8.

**Architecture:** Extend the existing Vinext/D1 application incrementally. Keep platform-provided ChatGPT identity as the authoritative adult account; add explicit guardian relationships, versioned consent/privacy records, idempotent onboarding, and server-authoritative active-player context. Preserve legacy profiles and training state, but require legacy setup review before canonical player handoff. Do not rewrite the application or add a new authentication provider.

**Tech stack:** Vinext, Next.js route handlers, React 19, TypeScript, Cloudflare D1, Drizzle, Node test runner.

**Spec:** Tendie Forge P0/P1 Canonical Build Specification v1.4; Readiness Control Plane v1.4 `TF-MVP-003 Contract`; TF-MVP-003 verification evidence dated 2026-09-10.

## Global constraints

- v1.4 authority hierarchy governs; current code is evidence only.
- Protect Version 8 header, first-run role separation, back/sign-out paths, export/delete, safety pause, and no-horizontal-overflow behavior.
- Use platform-provided ChatGPT identity headers; do not add app-owned auth.
- Do not collect child PII before required parental consent.
- Required consent is separate from optional analytics, notifications, and clip permissions.
- Support no-equipment setup and 15/25/35-minute plans.
- Account identity, player identity, and relationship grant remain separate concepts.
- Exactly one active player context per adult account; switching is server-authorized and atomic.
- Player responses exclude adult-only notes, grants, consent detail, and audit records.
- Existing profile/training history is preserved.
- No public profiles, leaderboards, open messaging, ads, exact DOB, precise location, or child email.
- Every mutation uses a stable idempotency key and canonical error code.
- No deployment until all automated, responsive, privacy, authentication, and production gates pass.

---

### Task 1: Canonical identity and onboarding domain contracts

**Files:**
- Create: `lib/identity-contract.mjs`
- Test: `tests/identity-contract.test.mjs`

**Produces:**
- `CONSENT_VERSION = 'tf-parent-consent-v1.4'`
- `normalizeOnboardingInput(input)`
- `buildPlayerProjection(profile, state)`
- `canonicalError(code, message, status)`

- [ ] **Step 1: Write failing contract tests**

```js
test('onboarding rejects child data unless required consent is accepted', () => {
  assert.throws(() => normalizeOnboardingInput({nickname:'Goalie', consentAccepted:false}), /CONSENT_REQUIRED/);
});

test('onboarding accepts no equipment and canonical duration values', () => {
  const value = normalizeOnboardingInput(validInput({equipment:[], missionMinutes:25}));
  assert.deepEqual(value.equipment, []);
  assert.equal(value.missionMinutes, 25);
});

test('player projection excludes adult-only data', () => {
  const result = buildPlayerProjection(profileFixture, stateFixture);
  assert.equal('grants' in result, false);
  assert.equal(JSON.stringify(result).includes('reviewedBy'), false);
});
```

- [ ] **Step 2: Run `node --test tests/identity-contract.test.mjs` and confirm failures are caused by missing exports.**
- [ ] **Step 3: Implement strict normalization for nickname, age band, catches, experience, equipment array, planned weekdays, mission minutes, required consent version, and optional permissions.**
- [ ] **Step 4: Implement a whitelist-based child projection; never remove fields by blacklist.**
- [ ] **Step 5: Run the focused test, then the existing non-build unit tests.**

### Task 2: Add append-only D1 schema for relationships, consent, context, audit, and idempotency

**Files:**
- Modify: `db/schema.ts`
- Create through Drizzle: `drizzle/0001_*.sql`
- Modify through Drizzle: `drizzle/meta/_journal.json`
- Create through Drizzle: `drizzle/meta/0001_snapshot.json`
- Test: `tests/schema-contract.test.mjs`

**Produces tables:**
- `guardian_player(account_id, profile_id, relationship, status, created_at, revoked_at)`
- `consent_records(id, account_id, profile_id, consent_version, purposes_json, policy_version, accepted_at, revoked_at)`
- `privacy_preferences(profile_id, analytics_allowed, notifications_allowed, clips_allowed, updated_at)`
- `active_player_context(account_id, profile_id, updated_at)`
- `deletion_requests(id, account_id, profile_id, status, requested_at, completed_at)`
- `audit_events(id, actor_account_id, profile_id, event_type, metadata_json, created_at)`
- `idempotency_records(account_id, operation_key, operation, response_json, created_at)`

**Profile columns added as nullable or constant-default D1-safe deltas:** `catches`, `experience`, `equipment_json`, `planned_days_json`, `mission_minutes`, `setup_status`, `updated_at`.

- [ ] **Step 1: Write a failing schema behavior test that applies all migrations to an empty SQLite database and verifies tables, indexes, uniqueness, and foreign-key behavior.**
- [ ] **Step 2: Add Drizzle declarations with only indexes required by actual access patterns: guardian by account, guardian by profile, active context by account primary key, consent by profile, audit by profile/time, and idempotency by account/key primary key.**
- [ ] **Step 3: Generate the migration once with `npm run db:generate`; inspect that prior migrations remain unchanged and all added columns have D1-safe defaults/nullability.**
- [ ] **Step 4: Run the schema test and inspect `EXPLAIN QUERY PLAN` for accessible-profile and active-context queries.**

### Task 3: Implement relationship-scoped authorization and idempotent onboarding service

**Files:**
- Create: `lib/account-identity.ts`
- Create: `lib/household-store.ts`
- Create: `lib/idempotency-store.ts`
- Create: `app/api/onboarding/route.ts`
- Test: `tests/onboarding-api.test.mjs`

**Interfaces:**

```ts
export type AdultIdentity = { id: string; email: string; name?: string };
export async function requireAdultIdentity(): Promise<AdultIdentity>;
export async function createGoalieSetup(db, identity, input, operationKey): Promise<{profileId:string; setupStatus:'ready'}>;
export async function listHousehold(db, identity): Promise<HouseholdSummary>;
```

- [ ] **Step 1: Write failing tests for `UNAUTHENTICATED`, `CONSENT_REQUIRED`, unsupported age/catches/experience/duration/day values, duplicate operation key, and the eight-player limit.**
- [ ] **Step 2: Write failing integration behavior showing one request atomically creates profile, guardian relationship, consent, privacy preferences, active context, audit event, and idempotency response.**
- [ ] **Step 3: Move identity parsing into `account-identity.ts` and make existing APIs consume the shared identity adapter without weakening current checks.**
- [ ] **Step 4: Implement `POST /api/onboarding` with same-origin, JSON, and request-size enforcement; validate before every write.**
- [ ] **Step 5: Use a D1 batch as the transaction boundary; return the stored response for duplicate operation keys without duplicate profiles or consent records.**
- [ ] **Step 6: Implement `GET /api/onboarding` as an adult-only household/setup summary containing no complete training-state blob.**
- [ ] **Step 7: Run focused and existing API tests.**

### Task 4: Implement atomic active-player context and child-safe projection

**Files:**
- Create: `app/api/player-context/route.ts`
- Create: `app/api/player/route.ts`
- Modify: `lib/household-store.ts`
- Test: `tests/player-context-api.test.mjs`

**Interfaces:**

```ts
export async function setActivePlayer(db, identity, profileId, operationKey): Promise<PlayerProjection>;
export async function getActivePlayer(db, identity): Promise<PlayerProjection | null>;
```

- [ ] **Step 1: Write failing tests for cross-household ID substitution, revoked relationship, missing context, duplicate context mutation, and two-child switching.**
- [ ] **Step 2: Add a test that switches A → B and proves the single response contains only B-derived state and no A identifiers or adult notes.**
- [ ] **Step 3: Implement server-authorized upsert of one active profile per account plus audit/idempotency writes in one D1 batch.**
- [ ] **Step 4: Implement `GET /api/player` using the whitelist projection from Task 1.**
- [ ] **Step 5: Standardize errors: `UNAUTHENTICATED` 401, `PLAYER_CONTEXT_REQUIRED` 409, `FORBIDDEN` 403, `RELATIONSHIP_REVOKED` 403, `DUPLICATE_REQUEST` resolved by returning stored success.**
- [ ] **Step 6: Run focused and existing authorization tests.**

### Task 5: Implement the parent setup and handoff screens

**Files:**
- Create: `components/tendie-forge/onboarding-flow.tsx`
- Create: `components/tendie-forge/player-handoff.tsx`
- Create: `lib/onboarding-state.mjs`
- Modify: `app/page.tsx`
- Modify: `app/training.css`
- Test: `tests/onboarding-state.test.mjs`
- Test: `tests/ui-components.test.mjs`
- Test: `tests/rendered-html.test.mjs`

**State:** `WELCOME → ADULT_ACCOUNT → PARENT_PERMISSION → CREATE_GOALIE → GEAR → TRAINING_PLAN → HANDOFF`.

- [ ] **Step 1: Write failing reducer tests for Next, Back, Cancel, retry, reload from saved setup, optional-permission denial, and duplicate submit.**
- [ ] **Step 2: Write failing render tests proving no player navigation appears before handoff, child fields are absent before permission, one dominant action appears per step, and sign-out/back paths remain available.**
- [ ] **Step 3: Implement the seven-step parent flow with production copy from `UX-003-01` through `UX-003-07`.**
- [ ] **Step 4: Submit child data only once required consent has been accepted; send one idempotent setup request at `BUILD SETUP`/completion boundary.**
- [ ] **Step 5: Support `No equipment`, catches, experience, age band, planned weekdays, and 15/25/35 minutes.**
- [ ] **Step 6: Set active context, show `I'M {NAME}`, and enter the child-safe surface using the server projection.**
- [ ] **Step 7: Preserve Version 8 header structure, sign-out, responsive safe areas, focus order, 44px minimum touch targets, and reduced motion.**
- [ ] **Step 8: Run focused component/render tests at 320, 375, 390, 430, tablet, and desktop layout contracts.**

### Task 6: Legacy-profile reconciliation and TF-MVP-003 release gate

**Files:**
- Create: `lib/legacy-profile.mjs`
- Modify: `app/api/onboarding/route.ts`
- Test: `tests/legacy-profile.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write failing tests that legacy profiles retain IDs, training state, session history, coach grants, export, and delete access.**
- [ ] **Step 2: Implement `legacy-review-required` setup status; owners complete missing catches/equipment/experience/schedule/consent without overwriting history.**
- [ ] **Step 3: Ensure legacy coach access never creates guardian rights and cannot activate player handoff.**
- [ ] **Step 4: Run all unit/API tests, production build, TypeScript, and lint.**
- [ ] **Step 5: Run authorization attack tests: ID substitution, cross-household access, revoked relationship, stale revision, direct-route bypass, logout/login isolation, and duplicate request.**
- [ ] **Step 6: Inspect the production-equivalent worker and six responsive widths; validate keyboard order, visible focus, reflow, contrast, announcements, and no horizontal overflow.**
- [ ] **Step 7: Update README with the real identity/relationship/consent architecture and known external privacy approvals.**
- [ ] **Step 8: Request code review and resolve all P0/P1 findings before branch integration.**

## Completion boundary

TF-MVP-003 implementation passes only when the data migration, authorization attacks, consent transaction, two-child isolation, child-safe projection, legacy preservation, responsive setup flow, production build, and full regression suite pass. Passing this package does not authorize deployment; TF-MVP-004 first challenge/Today remains the next dependency.

