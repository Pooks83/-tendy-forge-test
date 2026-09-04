import type { LucideIcon } from "lucide-react";

type StatusTone = "building" | "holding" | "attention" | "neutral" | "safety";

const statusClasses: Record<StatusTone, string> = {
  building: "border-red-300/35 bg-red-300/10 text-red-100",
  holding: "border-slate-500/40 bg-slate-500/15 text-slate-200",
  attention: "border-white/30 bg-white/10 text-white",
  neutral: "border-white/10 bg-white/5 text-slate-300",
  safety: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span className={`gf-status ${statusClasses[tone]}`}>{children}</span>
  );
}

export function IconBadge({
  icon: Icon,
  tone = "cyan",
}: {
  icon: LucideIcon;
  tone?: "cyan" | "gold" | "red" | "slate";
}) {
  return (
    <span className={`gf-icon-badge gf-icon-badge-${tone}`} aria-hidden="true">
      <Icon size={18} strokeWidth={2.2} />
    </span>
  );
}

export function ProgressRing({
  value,
  label,
  sublabel,
}: {
  value: number;
  label: string;
  sublabel?: string;
}) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div className="gf-progress-ring" style={{ "--progress": `${normalized * 3.6}deg` } as React.CSSProperties}>
      <div className="gf-progress-ring-inner">
        <strong>{label}</strong>
        {sublabel ? <span>{sublabel}</span> : null}
      </div>
    </div>
  );
}
