"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

/**
 * Shared chrome for every /admin queue page: the "← The Circle" back link, big title + blurb,
 * section labels, and the three-column review card (who/what · evidence · actions). Keeping the
 * layout here is what makes the queues read as one system.
 */

export const HEAD = "font-[family-name:var(--font-heading)]";
export const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;

export const TONE = {
  good: "#8fe0a5",
  warn: "#f0c069",
  bad: "#ef7f7f",
  info: "#6fa8ff",
  neutral: "var(--sage)",
} as const;
export type Tone = keyof typeof TONE;

export function QueuePage({ title, blurb, wide, children }: { title: string; blurb: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`mx-auto ${wide ? "max-w-6xl" : "max-w-5xl"} px-6 py-12 sm:py-16`}>
      <Link href="/admin" className="text-[15px] font-medium text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]">← The Circle</Link>
      <h1 className={`${HEAD} mt-4 text-[40px] font-black leading-none tracking-[-0.03em] text-[var(--cream)] sm:text-[48px]`}>{title}</h1>
      <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-[var(--sage)]">{blurb}</p>
      {children}
    </div>
  );
}

export function SectionLabel({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <div className={`text-[12px] font-bold uppercase tracking-[0.18em] ${className}`} style={{ color: tone === "neutral" ? "var(--sage-dim)" : TONE[tone] }}>{children}</div>;
}

/** Small uppercase chip next to a card title (reason, tier, ×N submitted …). */
export function Tag({ children, tone = "warn" }: { children: ReactNode; tone?: Tone }) {
  const c = TONE[tone];
  return <span className="shrink-0 rounded-md px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>{children}</span>;
}

/** One evidence line: emoji glyph + text. `tone` colours the text; children may mix <b> and plain spans. */
export function Fact({ icon, tone = "neutral", children }: { icon: string; tone?: Tone; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[15px] leading-snug" style={{ color: tone === "neutral" ? "var(--sage)" : TONE[tone] }}>
      <span className="w-5 shrink-0 text-center text-[15px] leading-snug">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function Card({ children, accent, dim }: { children: ReactNode; accent?: "bad" | "warn"; dim?: boolean }) {
  return (
    <div className={`rounded-3xl bg-white/[0.035] p-8 ${accent === "bad" ? "ring-1 ring-[#ef7f7f]/40" : accent === "warn" ? "ring-1 ring-[#f0c069]/30" : ""} ${dim ? "opacity-70" : ""}`}>
      {children}
    </div>
  );
}

/** The three-column body: identity · evidence · actions. Collapses to one column on small screens. */
export function CardGrid({ left, middle, right }: { left: ReactNode; middle: ReactNode; right: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_200px]">
      <div className="min-w-0">{left}</div>
      <div className="min-w-0 space-y-3">{middle}</div>
      <div className="lg:pt-1">{right}</div>
    </div>
  );
}

/** Title + chip on one line, then a sage meta line. */
export function CardTitle({ title, tag, meta }: { title: ReactNode; tag?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className={`${HEAD} text-[24px] font-bold leading-tight text-[var(--cream)]`}>{title}</h3>
        {tag}
      </div>
      {meta && <div className="mt-1.5 text-[15px] text-[var(--sage-dim)]">{meta}</div>}
    </div>
  );
}

/** Person line — name, @handle, email (mailto) — and their quoted reason under it. */
export function Requester({ name, username, email, emailMissing, quote }: { name?: string; username?: string; email?: string; emailMissing?: boolean; quote?: string }) {
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px]">
        <span className="font-bold text-[var(--cream)]">{name || "Unknown"}</span>
        {username && <span className="text-[var(--sage-dim)]">@{username}</span>}
        {email && !emailMissing
          ? <><span className="text-[var(--sage-dim)]">·</span><a href={`mailto:${email}`} className="text-[var(--sage-dim)] hover:text-[var(--gold)] hover:underline">{email}</a></>
          : <><span className="text-[var(--sage-dim)]">·</span><span className="font-semibold" style={{ color: TONE.bad }}>no email on file</span></>}
      </div>
      {quote && <p className="mt-2 text-[15px] italic leading-relaxed text-[var(--text-body)]">&ldquo;{quote}&rdquo;</p>}
    </div>
  );
}

const btnBase = "w-full rounded-2xl py-3.5 text-[17px] font-bold transition-colors disabled:opacity-50";
export const BTN = {
  primary: `${btnBase} bg-[var(--gold)] text-[#141B16] hover:bg-[var(--gold-bright)]`,
  secondary: `${btnBase} bg-white/[0.05] text-[var(--sage)] hover:bg-white/[0.08] hover:text-[var(--cream)]`,
  danger: `${btnBase} bg-[#ef7f7f]/15 text-[#ef7f7f] hover:bg-[#ef7f7f]/25`,
} as const;

/**
 * Right-rail actions: stacked primary + secondary, an optional collapsible note field and an error
 * line. Actions receive the note so the caller doesn't own that state.
 */
export function ActionRail({ primary, secondary, busy, error, note, children }: {
  primary?: { label: string; busyLabel?: string; onClick: (note: string) => void; disabled?: boolean; tone?: "primary" | "danger" };
  secondary?: { label: string; busyLabel?: string; onClick: (note: string) => void; disabled?: boolean; tone?: "secondary" | "danger" };
  busy?: "primary" | "secondary" | null;
  error?: ReactNode;
  /** Show the "+ add note" affordance (placeholder text). Omit to hide it. */
  note?: string;
  children?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      {primary && (
        <button onClick={() => primary.onClick(text.trim())} disabled={!!busy || primary.disabled} className={BTN[primary.tone ?? "primary"]}>
          {busy === "primary" ? primary.busyLabel ?? "Working…" : primary.label}
        </button>
      )}
      {secondary && (
        <button onClick={() => secondary.onClick(text.trim())} disabled={!!busy || secondary.disabled} className={BTN[secondary.tone ?? "secondary"]}>
          {busy === "secondary" ? secondary.busyLabel ?? "Working…" : secondary.label}
        </button>
      )}
      {children}
      {note !== undefined && (open ? (
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={note} rows={3} className="w-full resize-none rounded-xl border border-[var(--hair)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50" />
      ) : (
        <button onClick={() => setOpen(true)} className="block w-full text-center text-[14px] text-[var(--sage-dim)] transition-colors hover:text-[var(--sage)]">+ add note</button>
      ))}
      {error && <div className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold leading-snug" style={{ color: TONE.bad, background: "rgba(239,127,127,0.10)" }}>{error}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="flex min-h-[30vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
}

export function Empty({ emoji, title, sub }: { emoji: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mt-10 rounded-3xl bg-white/[0.025] p-12 text-center">
      <div className="text-3xl">{emoji}</div>
      <p className="mt-3 text-[16px] font-semibold text-[var(--cream)]">{title}</p>
      {sub && <p className="mt-1 text-[14px] text-[var(--sage-dim)]">{sub}</p>}
    </div>
  );
}

export function LoadError() {
  return <p className="mt-10 text-[15px]" style={{ color: TONE.bad }}>Couldn&apos;t load the queue. Refresh to try again.</p>;
}

/** Pill-group segmented control used for status / period filters. */
export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { k: T; label: string; n?: number }[] }) {
  return (
    <div className="inline-flex rounded-full bg-white/[0.05] p-1">
      {options.map((o) => {
        const on = value === o.k;
        return (
          <button key={String(o.k)} onClick={() => onChange(o.k)} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${on ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>
            {o.label}{o.n ? <span className={`text-[11px] ${on ? "text-[#141B16]/70" : "text-[var(--sage-dim)]"}`}>{o.n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export const fmtAgo = (ms?: number) => {
  if (!ms) return "";
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};
