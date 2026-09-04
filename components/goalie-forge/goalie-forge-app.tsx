"use client";

import { useEffect, useState } from "react";
import { Gamepad2, LockKeyhole, RotateCcw, Shield, ShieldCheck, UsersRound } from "lucide-react";

import { createInitialState, selectOrganizationTeam } from "@/lib/goalie-engine.mjs";
import { AdultScreens } from "./adult-screens";
import { PlayerScreens } from "./player-screens";

type Role = "player" | "parent" | "coach";

const playerTabs = ["Today", "Journey", "Progress", "Locker", "Profile"];
const storageKey = "scs-saints-goalie-forge-demo-state";

export function GoalieForgeApp() {
  const [state, setState] = useState(() => createInitialState());
  const [role, setRole] = useState<Role>("player");
  const [activeTab, setActiveTab] = useState("Today");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restore = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          setState(createInitialState(JSON.parse(saved)));
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(restore);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [hydrated, state]);

  const resetDemo = () => {
    const next = createInitialState();
    setState(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const selectRole = (nextRole: Role) => {
    setRole(nextRole);
    if (nextRole === "player") setActiveTab("Today");
  };

  const playerTeam = state.organization.teams.find((team: { id: string }) => team.id === state.player.teamId);

  return (
    <main className="gf-app-shell">
      <div className="gf-ambient gf-ambient-left" />
      <div className="gf-ambient gf-ambient-right" />
      <header className="gf-topbar">
        <div className="gf-brand" aria-label="SCS Saints Goalie Forge">
          <span className="gf-brand-mark" aria-hidden="true"><Shield size={18} /></span>
          <span className="gf-brand-wordmark"><small>SCS Saints</small><span>GOALIE <b>FORGE</b></span></span>
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
        <div className="gf-topbar-actions">
          {role === "coach" ? (
            <label className="gf-team-scope">
              <span>Coach team view</span>
              <select value={state.organization.activeTeamId} onChange={(event) => setState(selectOrganizationTeam(state, event.target.value))} aria-label="Choose Saints team">
                <option value="all">All Saints teams</option>
                {state.organization.teams.map((team: { id: string; label: string; division: string }) => <option key={team.id} value={team.id}>{team.label} · {team.division}</option>)}
              </select>
            </label>
          ) : (
            <div className="gf-player-team-chip"><ShieldCheck size={14} /><span>{playerTeam?.label ?? "Saints goalie"}</span></div>
          )}
          <button className="gf-reset" onClick={resetDemo} aria-label="Reset demo state">
            <RotateCcw size={15} /> <span>Reset demo</span>
          </button>
        </div>
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

      <p className="gf-prototype-note">SCS Saints · Organization-wide goalie development · Private prototype demo · Device-local state only · No real child data or account access.</p>
    </main>
  );
}
