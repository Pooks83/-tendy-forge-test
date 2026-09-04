const initialState = {
  player: {
    nickname: "Henry",
    ageBand: "8–10",
    archetype: "The Tracker",
    tier: "Prospect",
    level: 7,
    totalXp: 1280,
    xpToday: 0,
    forgeTokens: 84,
    streak: 4,
    streakState: "Protected",
    ownedRewardIds: ["mask-northstar"],
  },
  mission: {
    id: "mission-blue-line",
    title: "Own the Blue Paint",
    storyStakes: "Your first Prospect showcase starts with seeing the next shot earlier.",
    duration: 25,
    xpCap: 180,
    status: "ready",
    safetyStopped: false,
    nextBoundaryFocus: null,
    activities: [
      {
        id: "wall-ball",
        name: "Wall Ball: Find the Puck",
        attribute: "Tracking",
        duration: 8,
        equipment: "Ball + wall",
        complete: false,
      },
      {
        id: "single-leg-holds",
        name: "Set Position Holds",
        attribute: "Balance",
        duration: 6,
        equipment: "Open floor",
        complete: false,
      },
      {
        id: "lateral-bounds",
        name: "Crease Pushes",
        attribute: "Explosiveness",
        duration: 7,
        equipment: "Open floor",
        complete: false,
      },
      {
        id: "reset-breathing",
        name: "Next Shot Reset",
        attribute: "Mindset",
        duration: 4,
        equipment: "None",
        complete: false,
      },
    ],
  },
  attributes: [
    { name: "Tracking", status: "Building", trend: "+12%", score: 78 },
    { name: "Hands", status: "Holding", trend: "+4%", score: 69 },
    { name: "Balance", status: "Building", trend: "+9%", score: 74 },
    { name: "Explosiveness", status: "Needs Attention", trend: "Re-test due", score: 54 },
    { name: "Strength", status: "Building", trend: "+7%", score: 63 },
    { name: "Mobility", status: "Holding", trend: "Consistent", score: 67 },
    { name: "Conditioning", status: "Insufficient Data", trend: "2 more sessions", score: 0 },
    { name: "Mindset", status: "Building", trend: "+15%", score: 82 },
  ],
  coach: {
    linked: true,
    name: "Coach Jeremy",
    focus: "Tracking through traffic",
    presetMessage: "Keep finding the puck first. Your next save starts before the shot.",
  },
  journey: {
    chapter: "Prospect",
    completedSessions: 3,
    requiredSessions: 5,
    nextUnlock: "Earn the crease call",
  },
  reward: null,
  offline: {
    status: "synced",
    lastMissionAvailable: true,
  },
  parent: {
    quietHours: true,
    notifications: true,
    schedule: ["Tue", "Thu", "Sat"],
    privacyStatus: "Parent controlled",
  },
  safety: {
    active: false,
    visibility: null,
    category: null,
  },
  parentActionRequired: false,
};

const clone = (value) => structuredClone(value);

export function createInitialState(overrides = {}) {
  const next = clone(initialState);
  return {
    ...next,
    ...overrides,
    player: { ...next.player, ...(overrides.player ?? {}) },
    mission: { ...next.mission, ...(overrides.mission ?? {}) },
    coach: { ...next.coach, ...(overrides.coach ?? {}) },
    parent: { ...next.parent, ...(overrides.parent ?? {}) },
  };
}

export function completeMission(state) {
  const next = clone(state);
  if (next.mission.status === "complete" || next.mission.safetyStopped) {
    return next;
  }
  next.mission.status = "complete";
  next.mission.activities = next.mission.activities.map((activity) => ({
    ...activity,
    complete: true,
  }));
  next.player.xpToday = next.mission.xpCap;
  next.player.totalXp += next.mission.xpCap;
  next.journey.completedSessions = Math.min(
    next.journey.requiredSessions,
    next.journey.completedSessions + 1,
  );
  const rewardId = "mask-northstar";
  if (next.player.ownedRewardIds.includes(rewardId)) {
    next.player.forgeTokens += 15;
    next.reward = {
      id: rewardId,
      type: "duplicate-conversion",
      amount: 15,
      label: "15 Forge Tokens",
    };
  } else {
    next.player.ownedRewardIds.push(rewardId);
    next.reward = {
      id: rewardId,
      type: "cosmetic",
      amount: 0,
      label: "Northstar Mask Finish",
    };
  }
  next.attributes = next.attributes.map((attribute) =>
    attribute.name === "Tracking"
      ? { ...attribute, status: "Building", trend: "+14%", score: Math.min(100, attribute.score + 4) }
      : attribute,
  );
  return next;
}

export function startMission(state) {
  const next = clone(state);
  if (next.mission.status === "ready") {
    next.mission.status = "active";
  }
  return next;
}

export function toggleMissionPause(state) {
  const next = clone(state);
  if (next.mission.status === "active") {
    next.mission.status = "paused";
  } else if (next.mission.status === "paused") {
    next.mission.status = "active";
  }
  return next;
}

export function completeActivity(state, activityId) {
  const next = clone(state);
  if (next.mission.status !== "active" || next.mission.safetyStopped) return next;
  next.mission.activities = next.mission.activities.map((activity) =>
    activity.id === activityId ? { ...activity, complete: true } : activity,
  );
  return next;
}

export function applySubstitution(state, activityId) {
  const next = clone(state);
  const substitutions = {
    "wall-ball": {
      name: "Puck Path Visualizer",
      equipment: "None",
      duration: 6,
      cue: "Trace the puck from release to save with your eyes before your hands move.",
    },
    "single-leg-holds": {
      name: "Set Position Visual Reset",
      equipment: "None",
      duration: 4,
      cue: "Picture your feet arriving under your hips before the shot.",
    },
    "lateral-bounds": {
      name: "Crease Read & React",
      equipment: "None",
      duration: 5,
      cue: "Read the shooter and name the next save choice before the release.",
    },
  };
  const substitute = substitutions[activityId];
  if (!substitute) return next;

  next.mission.activities = next.mission.activities.map((activity) =>
    activity.id === activityId
      ? {
          ...activity,
          ...substitute,
          substituted: true,
          originalActivityId: activityId,
        }
      : activity,
  );
  return next;
}

export function reportSafetyStop(state) {
  const next = clone(state);
  next.mission.status = "safety-paused";
  next.mission.safetyStopped = true;
  next.safety = {
    active: true,
    visibility: "parent-only",
    category: "Physical activity paused",
  };
  next.parentActionRequired = true;
  return next;
}
