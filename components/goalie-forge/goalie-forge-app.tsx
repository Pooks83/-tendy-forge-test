"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  CircleHelp,
  Flame,
  Gamepad2,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { createInitialState } from "@/lib/goalie-engine.mjs";
import { IconBadge, ProgressRing, StatusPill } from "./ui";

type Role = "player" | "parent" | "coach";

const playerTabs = ["Today", "Journey", "Progress", "Locker", "Profile"];

export function GoalieForgeApp() {
  const [state, setState] = useState(() => createInitialState());
  const [role, setRole] = useState<Role>("player");
  const [activeTab, setActiveTab] = useState("Today");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("goalie-forge-demo-state");
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        window.localStorage.removeItem("goalie-forge-demo-state");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem("goalie-forge-demo-state", JSON.stringify(state));
    }
  }, [hydrated, state]);

  const resetDemo = () => {
    const next = createInitialState();
    setState(next);
    window.localStorage.setItem("goalie-forge-demo-state", JSON.stringify(next));
  };

  const selectRole = (nextRole: Role) => {
    setRole(nextRole);
    if (nextRole === "player") setActiveTab("Today");
  };

  const mission = state.mission;

  return (
    <main className="gf-app-shell">
      <div className="gf-ambient gf-ambient-left" />
      <div className="gf-ambient gf-ambient-right" />
      <header className="gf-topbar">
        <div className="gf-brand" aria-label="Goalie Forge">
          <span className="gf-brand-mark" aria-hidden="true"><Gamepad2 size={18} /></span>
          <span>GOALIE <b>FORGE</b></span>
        </div>
        <div className="gf-role-switch" aria-label="Choose workspace">
          <button className={role === "player" ? "is-active" : ""} onClick={() => selectRole("player")}>
            <Gamepad2 size={15} /> Player
          </button>
          <button className={role === "parent" ? "is-active" : ""} onClick={() => selectRole("parent")}>
            <ShieldCheck size={15} /> Parent
          </button>
          <button className={role === "coach" ? "is-active" : ""} onClick={() => selectRole("coach")}>
            <UsersRound size={15} /> Coach
          </button>
        </div>
        <button className="gf-reset" onClick={resetDemo} aria-label="Reset demo state">
          <RotateCcw size={15} /> <span>Reset demo</span>
        </button>
      </header>

      {role === "player" ? (
        <div className="gf-player-layout">
          <aside className="gf-player-nav" aria-label="Player navigation">
            <div className="gf-profile-stub">
              <div className="gf-avatar">H</div>
              <div>
                <strong>{state.player.nickname}</strong>
                <span>{state.player.archetype}</span>
              </div>
            </div>
            <nav>
              {playerTabs.map((tab) => (
                <button
                  key={tab}
                  className={activeTab === tab ? "is-active" : ""}
                  onClick={() => setActiveTab(tab)}
                >
                  <span>{tab}</span>
                  {tab === "Today" ? <span className="gf-nav-dot" /> : null}
                </button>
              ))}
            </nav>
            <div className="gf-nav-footnote">
              <LockKeyhole size={15} /> Parent-controlled profile
            </div>
          </aside>

          <section className="gf-workspace">
            {activeTab === "Today" ? (
              <>
                <div className="gf-context-row">
                  <div>
                    <p className="gf-eyebrow">TODAY&apos;S MISSION</p>
                    <h1>Build the save before the puck moves.</h1>
                  </div>
                  <div className="gf-streak">
                    <Flame size={18} /> <strong>{state.player.streak}</strong><span>day run</span>
                  </div>
                </div>

                <section className="gf-mission-hero">
                  <div className="gf-mission-hero-copy">
                    <StatusPill tone="building"><Sparkles size={13} /> Prospect Chapter 1</StatusPill>
                    <h2>{mission.title}</h2>
                    <p>{mission.storyStakes}</p>
                    <div className="gf-mission-meta">
                      <span>{mission.duration} min</span>
                      <span>{mission.activities.length} activities</span>
                      <span>{mission.xpCap} max XP</span>
                    </div>
                    <button className="gf-primary-action" type="button">
                      <Play size={18} fill="currentColor" /> Start mission <ChevronRight size={17} />
                    </button>
                  </div>
                  <div className="gf-mission-hero-meter">
                    <ProgressRing value={71} label="71%" sublabel="Mission ready" />
                    <p><strong>Tracking</strong> is your best chance to grow today.</p>
                  </div>
                </section>

                <section className="gf-panel-grid">
                  <article className="gf-panel">
                    <div className="gf-panel-heading">
                      <div><p className="gf-eyebrow">MISSION PLAN</p><h3>Train with purpose</h3></div>
                      <CircleHelp size={18} aria-label="Each activity has setup and safety cues" />
                    </div>
                    <div className="gf-activity-list">
                      {mission.activities.map((activity: { id: string; name: string; attribute: string; duration: number; equipment: string }) => (
                        <div className="gf-activity" key={activity.id}>
                          <IconBadge icon={activity.attribute === "Mindset" ? Sparkles : Gamepad2} tone={activity.attribute === "Mindset" ? "gold" : "cyan"} />
                          <div><strong>{activity.name}</strong><span>{activity.attribute} · {activity.duration} min · {activity.equipment}</span></div>
                          <ChevronRight size={18} />
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="gf-panel gf-next-up">
                    <p className="gf-eyebrow">NEXT UNLOCK</p>
                    <h3>Earn the crease call.</h3>
                    <p>Complete 2 more planned sessions to unlock your first game-night story moment.</p>
                    <div className="gf-mini-progress"><span style={{ width: "60%" }} /></div>
                    <small>3 of 5 planned sessions</small>
                  </article>
                </section>
              </>
            ) : (
              <section className="gf-placeholder-panel">
                <IconBadge icon={Sparkles} tone="cyan" />
                <p className="gf-eyebrow">{activeTab.toUpperCase()}</p>
                <h2>{activeTab} is ready to forge.</h2>
                <p>This working area is connected in the next product slice.</p>
              </section>
            )}
          </section>
        </div>
      ) : (
        <section className="gf-adult-placeholder">
          <IconBadge icon={role === "parent" ? ShieldCheck : UsersRound} tone={role === "parent" ? "gold" : "cyan"} />
          <p className="gf-eyebrow">{role === "parent" ? "HOUSEHOLD CONTROLS" : "COACH CONSOLE"}</p>
          <h1>{role === "parent" ? "Development without pressure." : "See the goalie who needs your eye."}</h1>
          <p>Role-specific controls are connected in the next product slice.</p>
        </section>
      )}

      <p className="gf-prototype-note">Prototype demo · Device-local state only · No real child data or account access.</p>
    </main>
  );
}
