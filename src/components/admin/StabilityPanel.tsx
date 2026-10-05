"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminStability, type AdminStability, type StabilityRow } from "@/lib/adminStability";

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;
const GOLD = "#F6C165";
const RED = "#ef7f7f";
const GREEN = "#8fe0a5";

const ago = (ms: number) => { const m = Math.max(1, Math.round((Date.now() - ms) / 60000)); return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; };
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
      <div className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--sage)]`}>{title}</div>
      {sub && <div className="mt-1 text-[12.5px] text-[var(--sage-dim)]">{sub}</div>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Daily kill-rate bars, one color per version so a release visibly bends the curve. */
function RateBars({ days, versions, byDayVer }: { days: string[]; versions: string[]; byDayVer: Map<string, StabilityRow> }) {
  const palette = [GOLD, GREEN, "#6fa8ff", RED, "#c9a0ff"];
  const color = (v: string) => palette[versions.indexOf(v) % palette.length];
  const max = Math.max(0.1, ...days.flatMap((d) => versions.map((v) => byDayVer.get(`${d}|${v}`)?.killRate ?? 0)));
  const W = 640, H = 150, padB = 24, padT = 14, gh = H - padB - padT, baseY = padT + gh;
  const slot = W / Math.max(1, days.length);
  const y = (v: number) => baseY - (v / max) * gh;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        <line x1={0} y1={baseY} x2={W} y2={baseY} stroke="rgba(245,237,225,0.08)" />
        {days.map((d, i) => {
          const cx = slot * (i + 0.5);
          const present = versions.filter((v) => byDayVer.has(`${d}|${v}`));
          const bw = Math.min(10, (slot * 0.7) / Math.max(1, present.length));
          return (
            <g key={d}>
              {present.map((v, j) => {
                const r = byDayVer.get(`${d}|${v}`)!;
                const x = cx - (present.length * bw) / 2 + j * bw;
                const rate = r.killRate ?? 0;
                return <rect key={v} x={x} y={y(rate)} width={bw - 1.5} height={Math.max(1.5, baseY - y(rate))} rx={2} fill={color(v)} opacity={0.9} />;
              })}
              {i % 2 === 0 && <text x={cx} y={H - 6} textAnchor="middle" fontSize={10.5} fill="rgba(168,179,145,0.6)">{dayLabel(d)}</text>}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4">
        {versions.map((v) => (
          <span key={v} className="flex items-center gap-1.5 text-[12px] text-[var(--sage)]">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color(v) }} /> {v}
          </span>
        ))}
      </div>
    </>
  );
}

export default function StabilityPanel() {
  const [data, setData] = useState<AdminStability | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (force = false) => {
    setBusy(true);
    getAdminStability(force).then(setData).catch((e) => setErr(e?.message || "Failed to load")).finally(() => setBusy(false));
  };
  useEffect(() => { load(); }, []);

  const model = useMemo(() => {
    if (!data) return null;
    const days = [...new Set(data.rows.map((r) => r.day))].sort();
    // Versions ranked by recent activity; keep the top 4 so the chart stays legible.
    const activity = new Map<string, number>();
    for (const r of data.rows) activity.set(r.version, (activity.get(r.version) || 0) + r.daily);
    const versions = [...activity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v).sort();
    const byDayVer = new Map(data.rows.map((r) => [`${r.day}|${r.version}`, r]));
    const perVersion = versions.map((v) => {
      const rows = data.rows.filter((r) => r.version === v);
      const daily = rows.reduce((s, r) => s + r.daily, 0);
      const kills = rows.reduce((s, r) => s + r.memoryLimit + r.sig9, 0);
      const watchdog = rows.reduce((s, r) => s + r.watchdog, 0);
      const sig6 = rows.reduce((s, r) => s + r.sig6, 0);
      const p90 = Math.max(0, ...rows.map((r) => r.peakP90));
      return { version: v, daily, kills, watchdog, sig6, p90, rate: daily ? kills / daily : 0 };
    });
    return { days, versions, byDayVer, perVersion };
  }, [data]);

  if (err) return <Section title="Stability"><div className="text-[14px]" style={{ color: RED }}>{err}</div></Section>;
  if (!data || !model) return <Section title="Stability"><div className="text-[13px] text-[var(--sage-dim)]">Loading…</div></Section>;

  return (
    <Section
      title="Stability — the kills the stores never show"
      sub={`Jetsam/memory + watchdog terminations from the MetricKit pipeline (invisible in App Store Connect / Play Console). Last ${data.windowDays} days · computed ${ago(data.generatedAt)}${data.cached ? " (cached)" : ""}.`}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {model.perVersion.map((v) => (
          <div key={v.version} className="rounded-xl bg-white/[0.03] px-4 py-3">
            <div className={`${HEAD} text-[11px] font-bold tracking-[0.12em] text-[var(--sage)]`}>{v.version}</div>
            <div className="mt-1 text-[22px] font-bold" style={{ ...NUM, color: v.rate > 0.15 ? RED : v.rate > 0.08 ? GOLD : GREEN }}>
              {v.rate.toFixed(2)}
            </div>
            <div className="text-[11.5px] text-[var(--sage-dim)]">kills / active day · {v.kills} kills · p90 {v.p90} MB</div>
          </div>
        ))}
      </div>
      <RateBars days={model.days} versions={model.versions} byDayVer={model.byDayVer} />
      <div className="mt-4 flex items-center justify-between">
        <div className="text-[12px] text-[var(--sage-dim)]">
          Green ≤0.08 (the flat-map baseline) · amber ≤0.15 · red above. A new release should pull its bar down within days of rollout.
        </div>
        <button onClick={() => load(true)} disabled={busy} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-[var(--cream)] hover:bg-white/[0.1] disabled:opacity-50">
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </Section>
  );
}
