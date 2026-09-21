"use client";

import { useEffect, useState } from "react";
import { getAdminPulse, type AdminPulse, type MonthCount } from "@/lib/adminPulse";

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;
const GOLD = "#F6C165";
const GREEN = "#8fe0a5";
const BLUE = "#6fa8ff";

const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const pct = (n: number, d: number) => (d ? `${(100 * n / d).toFixed(1)}%` : "—");
const fmt = (n: number) => n.toLocaleString();
const ago = (ms: number) => { const m = Math.max(1, Math.round((Date.now() - ms) / 60000)); return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; };

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
      <div className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--sage)]`}>{title}</div>
      {sub && <div className="mt-1 text-[12.5px] text-[var(--sage-dim)]">{sub}</div>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Monthly bars with the value on top; the current month is drawn hollow-topped with its pace. */
function MonthBars({ rows, current, pace, color }: { rows: MonthCount[]; current: string; pace?: number | null; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.n + (r.imported ?? 0)), pace ?? 0);
  const W = 640, H = 150, padB = 24, padT = 22;
  const gh = H - padB - padT, baseY = padT + gh;
  const n = rows.length || 1, slot = W / n, bw = Math.min(slot * 0.62, 64);
  const y = (v: number) => baseY - (v / max) * gh;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" onMouseLeave={() => setHover(null)}>
      <line x1={0} y1={baseY} x2={W} y2={baseY} stroke="rgba(245,237,225,0.08)" />
      {rows.map((r, i) => {
        const cx = slot * (i + 0.5); const isCur = r.month === current; const dim = hover != null && hover !== i;
        return (
          <g key={r.month} opacity={dim ? 0.4 : 1} style={{ transition: "opacity .15s" }}>
            {isCur && pace != null && pace > r.n && (
              <rect x={cx - bw / 2} y={y(pace)} width={bw} height={y(r.n) - y(pace)} rx={3} fill="none" stroke={color} strokeDasharray="3 3" opacity={0.6} />
            )}
            <rect x={cx - bw / 2} y={y(r.n)} width={bw} height={Math.max(2, baseY - y(r.n))} rx={3} fill={color} opacity={isCur ? 1 : 0.85} />
            {(r.imported ?? 0) > 0 && (
              <rect x={cx - bw / 2} y={y(r.n + (r.imported ?? 0))} width={bw} height={Math.max(1, y(r.n) - y(r.n + (r.imported ?? 0)))} rx={2} fill={color} opacity={0.22} />
            )}
            <text x={cx} y={y(Math.max(r.n + (r.imported ?? 0), isCur && pace ? pace : 0)) - 7} textAnchor="middle" fontSize={12} fontWeight={700} fill={isCur ? color : "rgba(245,237,225,0.85)"} style={NUM}>{fmt(r.n)}</text>
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={11.5} fill={isCur ? color : "rgba(168,179,145,0.6)"} fontWeight={isCur ? 700 : 500}>{monthLabel(r.month)}</text>
            <rect x={slot * i} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        );
      })}
    </svg>
  );
}

function Big({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <div className={`${HEAD} text-[26px] font-extrabold leading-none tracking-[-0.02em]`} style={{ color: color || "var(--cream)" }}>{value}</div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">{label}</div>
    </div>
  );
}

export default function PulsePanel() {
  const [p, setP] = useState<AdminPulse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    getAdminPulse(false).then((d) => { if (alive) { setP(d); setErr(null); } }).catch((e) => { if (alive) setErr((e as { message?: string })?.message || "Couldn't load"); });
    return () => { alive = false; };
  }, []);
  const recount = () => { setBusy(true); getAdminPulse(true).then((d) => { setP(d); setErr(null); }).catch((e) => setErr((e as { message?: string })?.message || "Couldn't load")).finally(() => setBusy(false)); };

  if (err) return <div className="mt-8 text-[13px] text-[#ef7f7f]">Pulse unavailable · {err}</div>;
  if (!p) return <div className="mt-8 flex items-center gap-2 text-[13px] text-[var(--sage-dim)]"><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Counting rounds, courses and builders…</div>;

  const cur = p.rounds.thisMonth;
  const prev = p.rounds.byMonth.filter((m) => m.month < cur.month).slice(-1)[0];
  const paceVsPrev = cur.pace != null && prev && prev.n > 0 ? Math.round((cur.pace / prev.n - 1) * 100) : null;
  const a = p.activation;
  const proTier = p.builders.tiers.find((t) => t.grantDays > 0);

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12.5px] text-[var(--sage-dim)]">Rounds, courses, activation and builders · computed {ago(p.generatedAt)}{p.cached ? "" : " (fresh)"} · refreshes hourly</div>
        <button onClick={recount} disabled={busy} className="rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-50">{busy ? "Recounting…" : "Recount now"}</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Rounds logged per month" sub={`Solid = logged in Radius · faint = imported scorecard history dated that month (${fmt(p.rounds.imported)} of ${fmt(p.rounds.total)} round docs) · from ${monthLabel(p.launchMonth)} ${p.launchMonth.slice(0, 4)}`}>
          <MonthBars rows={p.rounds.byMonth.slice(-9)} current={cur.month} pace={cur.pace} color={GOLD} />
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px] text-[var(--sage)]">
            <span><b style={NUM} className="text-[var(--cream)]">{fmt(cur.n)}</b> so far · day {cur.dayOfMonth} of {cur.daysIn}</span>
            {cur.pace != null && <span>pace <b style={NUM} className="text-[var(--gold)]">{fmt(cur.pace)}</b>{paceVsPrev != null && <span className="ml-1" style={{ color: paceVsPrev >= 0 ? GREEN : "#ef7f7f" }}>{paceVsPrev >= 0 ? "+" : ""}{paceVsPrev}% vs {prev ? monthLabel(prev.month) : "last"}</span>}</span>}
          </div>
        </Section>

        <Section title="Courses built per month" sub={`${fmt(p.courses.total)} course docs · ${fmt(p.courses.undated)} predate the createdAt stamp and can't be placed`}>
          <MonthBars rows={p.courses.byMonth.filter((m) => m.month >= p.launchMonth).slice(-9)} current={cur.month} color={BLUE} />
          <div className="mt-3 text-[13px] text-[var(--sage)]"><b style={NUM} className="text-[var(--cream)]">{fmt(p.courses.countable)}</b> countable courses by the rewards rule (published, 9+ mapped holes, attributed)</div>
        </Section>

        <Section title="Activation" sub="Accounts that ever logged a round, and how many came back">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Big value={fmt(a.accounts)} label="Accounts" />
            <Big value={fmt(a.loggers)} label={`Logged a round · ${pct(a.loggers, a.accounts)}`} />
            <Big value={fmt(a.activated)} label={`3+ rounds · ${pct(a.activated, a.loggers)} of loggers`} color={GREEN} />
            <Big value={fmt(a.oneAndDone)} label={`One and done · ${pct(a.oneAndDone, a.loggers)}`} color="#ef7f7f" />
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-[var(--sage-dim)]">Imported history doesn&apos;t count as logging{a.inclImported ? <> (with it: {fmt(a.inclImported.loggers)} loggers · {fmt(a.inclImported.activated)} at 3+ · {fmt(a.inclImported.oneAndDone)} one-and-done)</> : null}. Reads the cloud backup, which Android under-published before 3.3.3 — so one-and-done is a ceiling and 3+ is a floor until the reconcile rolls out.</p>
        </Section>

        <Section title="Builders" sub={`${fmt(p.builders.creators)} people have built at least one countable course · qualifies vs actually awarded`}>
          <table className="w-full text-[13.5px]">
            <thead><tr className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]"><th className="pb-2 text-left font-bold">Tier</th><th className="pb-2 text-right font-bold">Reward</th><th className="pb-2 text-right font-bold">Qualify</th><th className="pb-2 text-right font-bold">Awarded</th></tr></thead>
            <tbody>
              {p.builders.tiers.map((t) => {
                const gap = t.builders - t.awarded;
                return (
                  <tr key={t.key} className="border-t border-white/[0.06]">
                    <td className="py-2.5 font-semibold text-[var(--cream)]">{t.threshold}+ courses</td>
                    <td className="py-2.5 text-right text-[var(--sage)]">{t.merchTier ? (t.merchTier === "bag" ? "Tournament bag" : "Gear bundle") : `${t.grantDays}-day Pro`}</td>
                    <td style={NUM} className="py-2.5 text-right font-bold text-[var(--cream)]">{fmt(t.builders)}</td>
                    <td style={NUM} className="py-2.5 text-right font-bold" title={gap > 0 ? `${gap} qualify but were never awarded — the trigger only fires on their next course write` : undefined}>
                      <span style={{ color: gap > 0 ? "#f0c069" : GREEN }}>{fmt(t.awarded)}</span>{gap > 0 && <span className="ml-1.5 text-[11px] font-semibold text-[#f0c069]">−{gap}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {proTier && <p className="mt-3 text-[12px] leading-relaxed text-[var(--sage-dim)]">Awarded counts read each user&apos;s courseRewards.awarded list. A gap means the milestone was earned by count but the award trigger hasn&apos;t fired yet.</p>}
        </Section>
      </div>
    </div>
  );
}
