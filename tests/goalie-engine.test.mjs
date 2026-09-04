import assert from "node:assert/strict";
import test from "node:test";

import {
  applySubstitution,
  completeActivity,
  completeMission,
  createInitialState,
  reportSafetyStop,
  setCoachFocus,
  setCoachLink,
  startMission,
  toggleMissionPause,
} from "../lib/goalie-engine.mjs";
import * as goalieEngine from "../lib/goalie-engine.mjs";

test("mission completion caps awarded XP at prescribed mission XP", () => {
  const next = completeMission(createInitialState());

  assert.equal(next.player.xpToday, next.mission.xpCap);
  assert.equal(next.mission.status, "complete");
});

test("safety stop blocks physical work and creates parent action", () => {
  const next = reportSafetyStop(createInitialState());

  assert.equal(next.mission.safetyStopped, true);
  assert.equal(next.mission.status, "safety-paused");
  assert.equal(next.parentActionRequired, true);
  assert.equal(next.safety.visibility, "parent-only");
});

test("duplicate reward converts to Forge Tokens", () => {
  const state = createInitialState({
    player: { ownedRewardIds: ["mask-northstar"] },
  });
  const next = completeMission(state);

  assert.ok(next.player.forgeTokens > state.player.forgeTokens);
  assert.equal(next.reward.type, "duplicate-conversion");
});

test("valid activity substitution retains the primary attribute", () => {
  const next = applySubstitution(createInitialState(), "wall-ball");

  assert.equal(next.mission.activities[0].attribute, "Tracking");
  assert.equal(next.mission.activities[0].substituted, true);
  assert.equal(next.mission.activities[0].equipment, "None");
});

test("mission player can start, pause, resume and complete an activity", () => {
  const started = startMission(createInitialState());
  const paused = toggleMissionPause(started);
  const resumed = toggleMissionPause(paused);
  const completed = completeActivity(resumed, "wall-ball");

  assert.equal(started.mission.status, "active");
  assert.equal(paused.mission.status, "paused");
  assert.equal(resumed.mission.status, "active");
  assert.equal(completed.mission.activities[0].complete, true);
});

test("coach focus is staged at the next safe mission boundary", () => {
  const next = setCoachFocus(createInitialState(), "Rebound control");

  assert.equal(next.coach.focus, "Rebound control");
  assert.equal(next.mission.nextBoundaryFocus, "Rebound control");
});

test("removing a coach link revokes access immediately", () => {
  const next = setCoachLink(createInitialState(), false);

  assert.equal(next.coach.linked, false);
});

test("Saints team selection changes the active organization context", () => {
  const selectOrganizationTeam = goalieEngine.selectOrganizationTeam ?? ((state) => state);
  const next = selectOrganizationTeam(createInitialState(), "2016-aa");

  assert.equal(next.organization?.name, "St. Clair Shores Saints");
  assert.equal(next.organization?.activeTeamId, "2016-aa");
});

test("coach roster shows only the goalies on the active Saints team", () => {
  const selectOrganizationTeam = goalieEngine.selectOrganizationTeam ?? ((state) => state);
  const selected = selectOrganizationTeam(createInitialState(), "2016-aa");
  const getSelectedTeamRoster = goalieEngine.getSelectedTeamRoster ?? (() => []);

  assert.deepEqual(
    getSelectedTeamRoster(selected).map((goalie) => goalie.nickname),
    ["Mia", "Nate"],
  );
});
