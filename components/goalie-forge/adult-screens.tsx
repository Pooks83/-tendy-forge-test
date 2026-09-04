"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileLock2,
  LockKeyhole,
  MessageSquareText,
  PauseCircle,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UsersRound,
} from "lucide-react";

import {
  acknowledgeSafetyStop,
  createInitialState,
  setCoachFocus,
  setCoachLink,
  updateParentPreferences,
} from "@/lib/goalie-engine.mjs";
import { Switch } from "@/components/ui/switch";
import { IconBadge, StatusPill } from "./ui";

type ForgeState = ReturnType<typeof createInitialState>;
type AdultRole = "parent" | "coach";

type AdultScreensProps = {
  role: AdultRole;
  state: ForgeState;
  updateState: (nextState: ForgeState) => void;
};

const coachFocuses = [
  "Tracking through traffic",
  "Rebound control",
  "Balance in the set position",
  "Calm reset after a goal",
];

const feedbackOptions = [
  "Keep finding the puck first. Your next save starts before the shot.",
  "Your reset was calm. Carry that into the next rep.",
  "Choose quality over speed—strong setup first.",
];

const scheduleDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ParentScreen({ state, updateState }: Omit<AdultScreensProps, "role">) {
  const [notice, setNotice] = useState<string | null>(null);
  const schedule = state.parent.schedule as string[];
  const toggleDay = (day: string) => {
    const nextSchedule = schedule.includes(day)
      ? schedule.filter((scheduledDay) => scheduledDay !== day)
      : [...schedule, day];
    updateState(updateParentPreferences(state, { schedule: nextSchedule }));
  };

  return (
    <section className="gf-adult-workspace gf-parent-workspace">
      <div className="gf-adult-heading">
        <div><p className="gf-eyebrow">HOUSEHOLD CONTROLS</p><h1>Development without pressure.</h1><p>Henry can train, play, and grow. You keep the boundaries in place.</p></div>
        <StatusPill tone="building"><ShieldCheck size={13} /> Guardian controls active</StatusPill>
      </div>

      {state.parentActionRequired ? (
        <article className="gf-parent-safety-card" aria-live="polite">
          <IconBadge icon={ShieldAlert} tone="red" />
          <div><p className="gf-eyebrow">SAFETY CHECK-IN</p><h2>Physical training was stopped.</h2><p>Henry reported a reason to pause. Check in together before deciding what&apos;s next.</p></div>
          <div className="gf-parent-safety-actions"><button className="gf-secondary-action" type="button" onClick={() => updateState(acknowledgeSafetyStop(state, "Rest day selected"))}><PauseCircle size={16} /> Choose rest day</button><button className="gf-primary-action" type="button" onClick={() => updateState(acknowledgeSafetyStop(state, "Mindset recovery selected"))}>Try calm recovery</button></div>
        </article>
      ) : null}

      <div className="gf-adult-grid">
        <article className="gf-adult-card gf-weekly-summary">
          <div className="gf-card-heading"><div><p className="gf-eyebrow">THIS WEEK</p><h2>Small, real wins.</h2></div><IconBadge icon={BadgeCheck} tone="cyan" /></div>
          <div className="gf-summary-metrics"><div><strong>{state.journey.completedSessions}</strong><span>planned sessions</span></div><div><strong>+14%</strong><span>tracking marker</span></div><div><strong>{state.player.streak}</strong><span>protected-day run</span></div></div>
          <p className="gf-card-note">Progress rewards completed training, not minutes on the app. Rest protects the run.</p>
        </article>

        <article className="gf-adult-card">
          <div className="gf-card-heading"><div><p className="gf-eyebrow">TRAINING RHYTHM</p><h2>Plan the week</h2></div><IconBadge icon={CalendarDays} tone="gold" /></div>
          <div className="gf-day-picker" aria-label="Training days">
            {scheduleDays.map((day) => <button key={day} type="button" className={schedule.includes(day) ? "is-selected" : ""} aria-pressed={schedule.includes(day)} onClick={() => toggleDay(day)}>{day}</button>)}
          </div>
          <div className="gf-setting-row"><div><Clock3 size={17} /><span><strong>Quiet hours</strong><small>20:00–07:00; no nudges</small></span></div><Switch checked={state.parent.quietHours} onCheckedChange={(quietHours) => updateState(updateParentPreferences(state, { quietHours }))} aria-label="Toggle quiet hours" /></div>
          <div className="gf-setting-row"><div><MessageSquareText size={17} /><span><strong>Parent summaries</strong><small>One weekly development recap</small></span></div><Switch checked={state.parent.notifications} onCheckedChange={(notifications) => updateState(updateParentPreferences(state, { notifications }))} aria-label="Toggle parent summaries" /></div>
        </article>

        <article className="gf-adult-card gf-coach-link-card">
          <div className="gf-card-heading"><div><p className="gf-eyebrow">COACH CONNECTION</p><h2>{state.coach.linked ? state.coach.name : "Coach access is off"}</h2></div><IconBadge icon={UserCheck} tone={state.coach.linked ? "cyan" : "slate"} /></div>
          <p>{state.coach.linked ? "The coach can see high-level training signals and set one focus for the next safe mission boundary." : "No coach can view Henry&apos;s training signals until you approve the link again."}</p>
          <button className={state.coach.linked ? "gf-secondary-action" : "gf-primary-action"} type="button" onClick={() => updateState(setCoachLink(state, !state.coach.linked))}>{state.coach.linked ? "Revoke coach access" : "Approve coach access"}</button>
        </article>

        <article className="gf-adult-card gf-privacy-card">
          <div className="gf-card-heading"><div><p className="gf-eyebrow">PRIVACY &amp; ACCOUNT</p><h2>Parent-controlled by design</h2></div><IconBadge icon={FileLock2} tone="gold" /></div>
          <ul className="gf-privacy-list"><li><Check size={15} /> No public player profile or rankings</li><li><Check size={15} /> No direct coach-to-child messages</li><li><Check size={15} /> No ads, purchases, or social sharing</li></ul>
          <div className="gf-privacy-actions"><button type="button" className="gf-text-action" onClick={() => setNotice("A parent data export would be prepared here. This demo never sends or stores real child data.")}><Download size={15} /> Request data export</button><button type="button" className="gf-text-action gf-delete-link" onClick={() => setNotice("A deletion request would be confirmed with the parent here. This demo uses device-local sample state only.")}><Trash2 size={15} /> Request deletion</button></div>
        </article>
      </div>
      {notice ? <div className="gf-inline-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice">×</button></div> : null}
    </section>
  );
}

function CoachScreen({ state, updateState }: Omit<AdultScreensProps, "role">) {
  const [draftFocus, setDraftFocus] = useState(state.coach.focus ?? coachFocuses[0]);
  const [notice, setNotice] = useState<string | null>(null);
  const setFeedback = (presetMessage: string) => {
    updateState({ ...state, coach: { ...state.coach, presetMessage } });
    setNotice("Preset feedback is staged for the next summary. No direct child message was sent.");
  };

  if (!state.coach.linked) {
    return (
      <section className="gf-adult-workspace gf-coach-workspace">
        <div className="gf-adult-heading"><div><p className="gf-eyebrow">COACH CONSOLE</p><h1>Access is parent-controlled.</h1><p>This player&apos;s guardian has not approved coach access.</p></div><StatusPill tone="holding"><LockKeyhole size={13} /> Access unavailable</StatusPill></div>
        <article className="gf-access-card"><IconBadge icon={LockKeyhole} tone="slate" /><h2>No player details are visible.</h2><p>Once a guardian approves the link, you can see high-level development signals, set one weekly focus, and use preset feedback.</p></article>
      </section>
    );
  }

  return (
    <section className="gf-adult-workspace gf-coach-workspace">
      <div className="gf-adult-heading"><div><p className="gf-eyebrow">COACH CONSOLE</p><h1>See the goalie who needs your eye.</h1><p>Exception-first signals—not activity surveillance or a direct message channel.</p></div><StatusPill tone="building"><UsersRound size={13} /> {state.roster.length} goalies linked</StatusPill></div>
      <div className="gf-coach-grid">
        <article className="gf-adult-card gf-roster-card">
          <div className="gf-card-heading"><div><p className="gf-eyebrow">ROSTER SIGNALS</p><h2>Start with exceptions</h2></div><IconBadge icon={Eye} tone="cyan" /></div>
          <div className="gf-roster-list">{state.roster.map((goalie: { id: string; nickname: string; signal: string; detail: string; tone: "attention" | "building" | "holding"; focus: string }) => <div className="gf-roster-row" key={goalie.id}><div className="gf-roster-avatar">{goalie.nickname[0]}</div><div><strong>{goalie.nickname}</strong><span>{goalie.detail}</span></div><StatusPill tone={goalie.tone}>{goalie.signal}</StatusPill></div>)}</div>
          <p className="gf-card-note">No body comparisons, medical inferences, or public performance rankings.</p>
        </article>
        <article className="gf-adult-card gf-focus-card">
          <div className="gf-card-heading"><div><p className="gf-eyebrow">ONE WEEKLY FOCUS</p><h2>Henry&apos;s next safe boundary</h2></div><IconBadge icon={ClipboardCheck} tone="gold" /></div>
          <label className="gf-select-label" htmlFor="coach-focus">Choose a development focus</label>
          <select id="coach-focus" className="gf-focus-select" value={draftFocus} onChange={(event) => setDraftFocus(event.target.value)}>{coachFocuses.map((focus) => <option key={focus} value={focus}>{focus}</option>)}</select>
          <p>Current focus: <strong>{state.coach.focus}</strong></p>
          <button className="gf-primary-action" type="button" onClick={() => { updateState(setCoachFocus(state, draftFocus)); setNotice("Focus staged for the next safe mission boundary."); }}>Stage focus <ChevronRight size={17} /></button>
        </article>
        <article className="gf-adult-card gf-feedback-card">
          <div className="gf-card-heading"><div><p className="gf-eyebrow">PRESET FEEDBACK</p><h2>Support, don&apos;t pressure</h2></div><IconBadge icon={MessageSquareText} tone="cyan" /></div>
          <p className="gf-current-preset">“{state.coach.presetMessage}”</p>
          <div className="gf-feedback-options">{feedbackOptions.map((message) => <button type="button" key={message} className={state.coach.presetMessage === message ? "is-selected" : ""} onClick={() => setFeedback(message)}>{message}</button>)}</div>
          <p className="gf-card-note">Feedback appears in a parent-visible summary. Free-form coach-to-child chat is intentionally unavailable.</p>
        </article>
      </div>
      {notice ? <div className="gf-inline-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice">×</button></div> : null}
    </section>
  );
}

export function AdultScreens({ role, state, updateState }: AdultScreensProps) {
  return role === "parent" ? <ParentScreen state={state} updateState={updateState} /> : <CoachScreen state={state} updateState={updateState} />;
}
