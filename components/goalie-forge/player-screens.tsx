"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  Dumbbell,
  Eye,
  Flame,
  Footprints,
  HeartPulse,
  LockKeyhole,
  Map,
  PackageOpen,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import {
  applySubstitution,
  completeActivity,
  completeMission,
  createInitialState,
  reportSafetyStop,
  startMission,
  toggleMissionPause,
} from "@/lib/goalie-engine.mjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconBadge, ProgressRing, StatusPill } from "./ui";

type ForgeState = ReturnType<typeof createInitialState>;
type PlayerTab = "Home" | "Train" | "Progress" | "Profile";

type PlayerScreensProps = {
  activeTab: PlayerTab;
  state: ForgeState;
  updateState: (nextState: ForgeState) => void;
};

const activityIcon = (attribute: string) => {
  if (attribute === "Tracking") return Eye;
  if (attribute === "Balance") return Footprints;
  if (attribute === "Explosiveness") return Activity;
  if (attribute === "Mindset") return Sparkles;
  return Dumbbell;
};

const statusTone = (status: string) => {
  if (status === "Building") return "building" as const;
  if (status === "Needs Attention") return "attention" as const;
  return "holding" as const;
};

function MissionStatus({ state }: { state: ForgeState }) {
  const completed = state.mission.activities.filter((activity: { complete: boolean }) => activity.complete).length;
  const total = state.mission.activities.length;
  const percent = Math.round((completed / total) * 100);
  const isReady = state.mission.status === "ready";

  return (
    <div className="gf-mission-hero-meter">
      <ProgressRing
        value={isReady ? 71 : state.mission.status === "complete" ? 100 : percent}
        label={isReady ? "2" : `${total - completed}`}
        sublabel="drills left"
      />
      <p>
        <strong>Tracking</strong>{" "}
        {isReady ? "Start small. Feel ready in net." : "Every finished drill makes game day feel easier."}
      </p>
    </div>
  );
}

function TodayScreen({ state, updateState }: Omit<PlayerScreensProps, "activeTab">) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const mission = state.mission;
  const selected = mission.activities.find((activity: { id: string }) => activity.id === selectedId);
  const completedActivities = mission.activities.filter((activity: { complete: boolean }) => activity.complete).length;
  const allActivitiesComplete = completedActivities === mission.activities.length;
  const missionActive = mission.status === "active";
  const missionPaused = mission.status === "paused";
  const missionComplete = mission.status === "complete";
  const safetyPaused = mission.status === "safety-paused";
  const playerTeam = state.organization.teams.find((team: { id: string }) => team.id === state.player.teamId);

  const handleCompleteMission = () => {
    updateState(completeMission(state));
    setRewardOpen(true);
  };

  return (
    <>
      <div className="gf-context-row">
        <div>
          <p className="gf-eyebrow">SCS SAINTS · {playerTeam?.label ?? "GOALIE DEVELOPMENT"}</p>
          <h1>{missionComplete ? "Nice work. Your crease is stronger." : "Ready to get better today?"}</h1>
        </div>
        <div className="gf-streak" title="A rest day protects your run">
          <Flame size={18} /> <strong>{state.player.streak}</strong><span>day run</span>
        </div>
      </div>

      {safetyPaused ? (
        <section className="gf-safety-card" aria-live="polite">
          <IconBadge icon={ShieldAlert} tone="red" />
          <div>
            <p className="gf-eyebrow">PHYSICAL WORK PAUSED</p>
            <h2>Good call. Tell your parent or guardian now.</h2>
            <p>Your run is protected. Training can wait until a parent checks in.</p>
          </div>
          <span className="gf-safety-status"><LockKeyhole size={14} /> {state.parentActionRequired ? "Parent action needed" : "Recovery plan protected"}</span>
        </section>
      ) : (
        <section className="gf-mission-hero">
          <div className="gf-mission-hero-copy">
            <StatusPill tone={missionComplete ? "building" : "building"}>
              <Sparkles size={13} /> {missionComplete ? "Training complete" : "Level 1: Protect the Crease"}
            </StatusPill>
            <h2>{missionComplete ? "You finished today's training." : "Today's goalie session"}</h2>
            <p>{missionComplete ? "Come back tomorrow and keep stacking great goalie habits." : "A few focused reps to help you see the puck, move well, and feel ready in net."}</p>
            <div className="gf-mission-meta">
              <span>{mission.duration} min</span>
              <span>{mission.activities.length} activities</span>
              <span>{completedActivities === mission.activities.length ? "All drills done" : `${Math.max(0, mission.activities.length - completedActivities - 2)} warm-up drills`}</span>
            </div>
            {mission.status === "ready" ? (
              <button className="gf-primary-action" type="button" onClick={() => updateState(startMission(state))}>
                <Play size={18} fill="currentColor" /> Start today&apos;s training <ChevronRight size={17} />
              </button>
            ) : null}
            {missionActive ? (
              <div className="gf-mission-actions">
                <button className="gf-secondary-action" type="button" onClick={() => updateState(toggleMissionPause(state))}>
                  <Pause size={16} /> Pause training
                </button>
                <button className="gf-text-action gf-safety-link" type="button" onClick={() => setSafetyOpen(true)}>
                  Not feeling right?
                </button>
              </div>
            ) : null}
            {missionPaused ? (
              <div className="gf-mission-actions">
                <button className="gf-primary-action" type="button" onClick={() => updateState(toggleMissionPause(state))}>
                  <Play size={17} fill="currentColor" /> Resume training
                </button>
                <button className="gf-text-action gf-safety-link" type="button" onClick={() => setSafetyOpen(true)}>
                  End physical work
                </button>
              </div>
            ) : null}
            {missionActive && allActivitiesComplete ? (
              <button className="gf-primary-action gf-finish-action" type="button" onClick={handleCompleteMission}>
                <Trophy size={18} /> Finish &amp; collect reward <ArrowRight size={17} />
              </button>
            ) : null}
          </div>
          <MissionStatus state={state} />
        </section>
      )}

      <section className="gf-panel-grid">
        <article className="gf-panel">
          <div className="gf-panel-heading">
            <div><p className="gf-eyebrow">YOUR DRILLS</p><h3>{missionActive ? "Keep going" : missionComplete ? "All done for today" : "2 drills left today"}</h3></div>
            <span className="gf-activity-count">{completedActivities}/{mission.activities.length}</span>
          </div>
          <div className="gf-activity-list">
            {mission.activities.map((activity: { id: string; name: string; attribute: string; duration: number; equipment: string; complete: boolean; substituted?: boolean }) => {
              const ActivityIcon = activityIcon(activity.attribute);
              return (
                <button
                  className={`gf-activity ${activity.complete ? "is-complete" : ""}`}
                  key={activity.id}
                  type="button"
                  onClick={() => setSelectedId(activity.id)}
                  disabled={safetyPaused}
                >
                  <IconBadge icon={activity.complete ? Check : ActivityIcon} tone={activity.attribute === "Mindset" ? "gold" : "cyan"} />
                  <span className="gf-activity-copy"><strong>{activity.name}</strong><small>{activity.attribute} · {activity.duration} min · {activity.equipment}{activity.substituted ? " · adjusted" : ""}</small></span>
                  {activity.complete ? <span className="gf-complete-mark">Done</span> : <ChevronRight size={18} />}
                </button>
              );
            })}
          </div>
        </article>
        <article className="gf-panel gf-next-up">
          <p className="gf-eyebrow">NEXT REWARD</p>
          <h3>Unlock the Saints Redline mask.</h3>
          <p>Finish two more training days and it is yours to wear in your locker.</p>
          <div className="gf-mini-progress"><span style={{ width: `${(state.journey.completedSessions / state.journey.requiredSessions) * 100}%` }} /></div>
          <small>{state.journey.completedSessions} of {state.journey.requiredSessions} planned sessions</small>
        </article>
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="gf-dialog" showCloseButton>
          {selected ? (
            <>
              <DialogHeader>
                <div className="gf-dialog-icon"><IconBadge icon={activityIcon(selected.attribute)} tone={selected.attribute === "Mindset" ? "gold" : "cyan"} /></div>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>{selected.attribute} · {selected.duration} minutes · {selected.equipment}</DialogDescription>
              </DialogHeader>
              <div className="gf-activity-detail">
                <p><strong>Today&apos;s cue</strong>{selected.cue ?? "Move with control. Quality reps beat rushed reps."}</p>
                <p><strong>Safety check</strong>Clear your space. If you feel pain, dizziness, or unsafe, stop and tell a parent.</p>
              </div>
              <DialogFooter className="gf-dialog-footer">
                {!selected.complete && missionActive ? (
                  <button className="gf-secondary-action" type="button" onClick={() => updateState(applySubstitution(state, selected.id))}>
                    <RotateCcw size={15} /> Need a no-equipment version
                  </button>
                ) : null}
                {selected.complete ? <StatusPill tone="building"><Check size={13} /> Rep complete</StatusPill> : null}
                {!selected.complete && missionActive ? (
                  <button className="gf-primary-action" type="button" onClick={() => { updateState(completeActivity(state, selected.id)); setSelectedId(null); }}>
                    <Check size={16} /> Mark rep complete
                  </button>
                ) : null}
                {!missionActive && !selected.complete ? <p className="gf-dialog-hint">Start or resume the mission to mark this rep complete.</p> : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={safetyOpen} onOpenChange={setSafetyOpen}>
        <DialogContent className="gf-dialog gf-safety-dialog" showCloseButton>
          <DialogHeader>
            <div className="gf-dialog-icon"><IconBadge icon={HeartPulse} tone="red" /></div>
            <DialogTitle>Stop if something feels wrong.</DialogTitle>
            <DialogDescription>Pain, dizziness, or an unsafe space means physical work stops now.</DialogDescription>
          </DialogHeader>
          <div className="gf-activity-detail"><p>Your streak stays protected. A parent or guardian will need to decide what happens next.</p></div>
          <DialogFooter className="gf-dialog-footer">
            <button className="gf-secondary-action" type="button" onClick={() => setSafetyOpen(false)}>I&apos;m okay to continue</button>
            <button className="gf-danger-action" type="button" onClick={() => { updateState(reportSafetyStop(state)); setSafetyOpen(false); }}>
              <ShieldAlert size={16} /> Stop &amp; tell a parent
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
        <DialogContent className="gf-dialog gf-reward-dialog" showCloseButton>
          <DialogHeader>
            <div className="gf-dialog-icon gf-reward-icon"><Trophy size={24} /></div>
            <DialogTitle>Mission forged.</DialogTitle>
            <DialogDescription>You completed a planned session and strengthened your path to the crease call.</DialogDescription>
          </DialogHeader>
          <div className="gf-reward-reveal">
            <PackageOpen size={34} />
            <strong>{state.reward?.label ?? "Saints Redline Mask Finish"}</strong>
            <span>{state.reward?.type === "duplicate-conversion" ? "You already own this cosmetic, so it became Forge Tokens." : "A new locker cosmetic is ready."}</span>
          </div>
          <DialogFooter className="gf-dialog-footer"><button className="gf-primary-action" type="button" onClick={() => setRewardOpen(false)}>Keep forging <ArrowRight size={17} /></button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function JourneyScreen({ state }: Omit<PlayerScreensProps, "activeTab" | "updateState">) {
  const progress = Math.round((state.journey.completedSessions / state.journey.requiredSessions) * 100);
  const chapters = [
    { name: "Prospect", label: "Learn the reads", status: "active" },
    { name: "Earn the Net", label: "Build reliable habits", status: progress >= 100 ? "next" : "locked" },
    { name: "Starter", label: "Own game moments", status: "locked" },
    { name: "Showcase", label: "Bring your game to the rink", status: "locked" },
  ];

  return (
    <>
      <div className="gf-context-row"><div><p className="gf-eyebrow">SAINTS CREASE PATH</p><h1>Every real rep moves the story.</h1></div><StatusPill tone="building"><Map size={13} /> Chapter 1</StatusPill></div>
      <section className="gf-journey-hero">
        <div><p className="gf-eyebrow">SAINTS GOALIE ROOM</p><h2>Earn the crease call.</h2><p>Show up for the fundamentals. The squad notices goalies who can reset, track, and move with purpose.</p></div>
        <ProgressRing value={progress} label={`${progress}%`} sublabel={`${state.journey.completedSessions}/${state.journey.requiredSessions} sessions`} />
      </section>
      <section className="gf-journey-path" aria-label="Goalie career path">
        {chapters.map((chapter, index) => (
          <article key={chapter.name} className={`gf-journey-node is-${chapter.status}`}>
            <div className="gf-journey-number">{chapter.status === "locked" ? <LockKeyhole size={16} /> : index + 1}</div>
            <div><p className="gf-eyebrow">{chapter.status === "active" ? "IN PROGRESS" : chapter.status === "next" ? "UP NEXT" : "FUTURE CHAPTER"}</p><h3>{chapter.name}</h3><span>{chapter.label}</span></div>
            {chapter.status === "active" ? <Check size={18} /> : null}
          </article>
        ))}
      </section>
      <section className="gf-story-note"><Sparkles size={18} /><p><strong>Story beats come from training.</strong> No screen-time XP, random win streaks, or pressure to play when rest is the right call.</p></section>
    </>
  );
}

function ProgressScreen({ state }: Omit<PlayerScreensProps, "activeTab" | "updateState">) {
  const strongest = useMemo(() => state.attributes.reduce((best: { score: number }, attribute: { score: number }) => attribute.score > best.score ? attribute : best, state.attributes[0]), [state.attributes]);
  return (
    <>
      <div className="gf-context-row"><div><p className="gf-eyebrow">DEVELOPMENT BOARD</p><h1>See what your reps are building.</h1></div><StatusPill tone="neutral"><Target size={13} /> No rankings</StatusPill></div>
      <section className="gf-progress-hero"><div><p className="gf-eyebrow">STRONGEST RIGHT NOW</p><h2>{strongest.name}</h2><p>{strongest.trend} since your first baseline. This is your own development—never a comparison to another goalie.</p></div><ProgressRing value={strongest.score} label={`${strongest.score}`} sublabel="growth marker" /></section>
      <section className="gf-attribute-grid">
        {state.attributes.map((attribute: { name: string; status: string; trend: string; score: number }) => (
          <article className="gf-attribute-card" key={attribute.name}>
            <div className="gf-attribute-top"><IconBadge icon={activityIcon(attribute.name)} tone={attribute.status === "Needs Attention" ? "gold" : "cyan"} /><StatusPill tone={statusTone(attribute.status)}>{attribute.status}</StatusPill></div>
            <h3>{attribute.name}</h3>
            <div className="gf-attribute-bar"><span style={{ width: `${attribute.score}%` }} /></div>
            <p>{attribute.trend}</p>
          </article>
        ))}
      </section>
      <p className="gf-progress-disclaimer">Growth markers guide the next practice. They are not body scores, medical assessments, or predictions about future hockey.</p>
    </>
  );
}

function ProfileScreen({ state }: Omit<PlayerScreensProps, "activeTab" | "updateState">) {
  return (
    <>
      <div className="gf-context-row"><div><p className="gf-eyebrow">PLAYER PROFILE</p><h1>Your goalie story, protected.</h1></div><StatusPill tone="building"><LockKeyhole size={13} /> {state.parent.privacyStatus}</StatusPill></div>
      <section className="gf-profile-grid">
        <article className="gf-profile-card gf-profile-player"><div className="gf-avatar gf-avatar-large">H</div><div><h2>{state.player.nickname}</h2><p>{state.player.ageBand} · {state.player.archetype}</p><span>{state.player.tier} · Level {state.player.level}</span></div></article>
        <article className="gf-profile-card"><p className="gf-eyebrow">YOUR TRAINING RHYTHM</p><h3>{state.parent.schedule.join(" · ")}</h3><p>Parent sets the plan, quiet hours, and coach connection.</p></article>
        <article className="gf-profile-card"><p className="gf-eyebrow">WHAT STAYS PRIVATE</p><h3>No public profile. No rankings.</h3><p>Your parent controls sharing. Coaches see only training signals that help them support you.</p></article>
      </section>
    </>
  );
}

export function PlayerScreens({ activeTab, state, updateState }: PlayerScreensProps) {
  if (activeTab === "Train") return <JourneyScreen state={state} />;
  if (activeTab === "Progress") return <ProgressScreen state={state} />;
  if (activeTab === "Profile") return <ProfileScreen state={state} />;
  return <TodayScreen state={state} updateState={updateState} />;
}
