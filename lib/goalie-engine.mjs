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
  next.mission.status = "complete";
  next.mission.activities = next.mission.activities.map((activity) => ({
    ...activity,
    complete: true,
  }));
  next.player.xpToday = next.mission.xpCap;
  next.player.totalXp += next.mission.xpCap;
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
