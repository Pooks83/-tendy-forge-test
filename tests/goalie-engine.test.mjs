import assert from "node:assert/strict";
import test from "node:test";

import {
  completeMission,
  createInitialState,
  reportSafetyStop,
} from "../lib/goalie-engine.mjs";

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
