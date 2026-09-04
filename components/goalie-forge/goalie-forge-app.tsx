"use client";

import { useEffect, useState } from "react";
import { Gamepad2, LockKeyhole, RotateCcw, ShieldCheck, UsersRound } from "lucide-react";

import { createInitialState } from "@/lib/goalie-engine.mjs";
import { AdultScreens } from "./adult-screens";
import { PlayerScreens } from "./player-screens";

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
            <PlayerScreens activeTab={activeTab as "Today" | "Journey" | "Progress" | "Locker" | "Profile"} state={state} updateState={setState} />
          </section>
        </div>
      ) : <AdultScreens role={role} state={state} updateState={setState} />}

      <p className="gf-prototype-note">Prototype demo · Device-local state only · No real child data or account access.</p>
    </main>
  );
}
