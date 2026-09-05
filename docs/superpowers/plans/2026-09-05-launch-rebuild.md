# Goalie Forge launch rebuild

Approved brief: complete at-home off-ice training product for ages 10–15, using the supplied evaluation plus advanced skills 17–30. White and Saints red. No on-ice assignments. Twenty-week coverage is separate from accomplishment-based path advancement.

## Execution
- [x] Curriculum module `lib/training.mjs`: 20 topics, fixed 30/45/60-minute paths, explicit off-ice blocks, clear dose and safety notes, idempotent set completion. Validate every scheduled session and skill coverage in `tests/training.test.mjs`.
- [x] Player `components/goalie-forge/training-app.tsx`: responsive compact header, four navigation destinations, drill dialog, floor setup diagrams, set counter, durable pause/resume rest timer, save status, accessible celebrations, recorded-only progress. Old demo components are preserved but not mounted.
- [x] Persistence: D1 profiles and coach grants; dispatch-authenticated adult ownership; revision-checked updates, action validation, no client-selected role authorization. Built Worker + isolated D1 tests verify cross-owner isolation, coach restrictions, revocation, exports, deletes, and stale revision rejection.
- [x] Parent/coach UI: setup, profile switch, explicit coach sharing/revocation, evidence checks, five-question evaluation with six cause categories, export/delete and schedule explanation. Children do not need ChatGPT accounts; adult account supervision is required.
- [x] Development verification: build, typecheck, automated tests; 390px-wide mobile browser interaction, dialog heading autofocus, keyboard close, paused timer survives popup close, resume, set completion celebration and count update. This is not child usability testing or real-device certification.

## Open launch requirements
- The 20-week scaffold tags all 30 skill categories but does not yet implement all listed subskills or age-specific measurable development benchmarks.
- Floor setup diagrams are not movement-mechanics demonstrations. Each physical drill still needs an accurate instructional image sequence or coach-reviewed demonstration video.
- The 30/45/60-minute schedules are planned blocks; qualified review must validate dose, recovery, age suitability, progression criteria and integration with each child's total sport workload.
- The five-question record is an off-ice adaptation, not the complete standardized 45–60 minute evaluation protocol supplied by the user.
- Verified family consent/authentication, privacy notices and retention decisions, human youth-coach review, and supervised child usability testing remain required for launch.
- New D1 schema and live account behavior have been tested in a local Worker runtime, not yet deployed. Existing published version remains unchanged.

## Independent review fixes
- Coach observations are append-only; two adults' same-day notes no longer overwrite each other. Advancement still counts distinct observed dates.
- The drill controls now show save errors and a reload action within the dialog, including explicit stop-regardless-of-save-status guidance.
- Finishing week 20 permits another practice cycle on the same path with unique session IDs. No automatic level or workload increase; all earlier history remains intact.

## Release boundaries
Current hosting uses adult ChatGPT authentication, not a verified parent-consent system. No claim that off-ice scores measure on-ice proficiency. Existing audience remains unchanged. User asked to build; deployment requires a publish request. Media demonstration and legally reviewed child data flows must be accurately reported, never implied complete by a passing build.
