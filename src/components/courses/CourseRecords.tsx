"use client";

import Link from "next/link";
import { type AceRecord, type DriveRecord } from "@/lib/courseRecords";
import { useMetricPref } from "@/lib/useMetricPref";
import { fmtDist } from "@/lib/units";

export interface BestScore { uid: string; name: string; username?: string; value: number }

function fmtScore(v: number): string { return v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`; }
const MEDAL = ["#f6c165", "#c7ccd3", "#cd9a5b"];

function Row({ i, photo, name, username, value, valueColor }: { i: number; photo?: string; name: string; username?: string; value: string; valueColor?: string }) {
  const medal = MEDAL[i];
  return (
    <div className="flex items-center gap-3 border-t border-[var(--c-line)] py-2.5 first:border-0">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold" style={medal ? { background: medal, color: "#16221b" } : { color: "rgba(241,237,226,0.5)" }}>{i + 1}</span>
      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--c-chip)] text-xs font-bold text-[var(--c-ink)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : (name || "?").charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        {username ? <Link href={`/u/${username}`} className="block truncate text-sm font-semibold text-[var(--c-ink)] hover:text-[var(--gold)]">{name}</Link> : <span className="block truncate text-sm font-semibold text-[var(--c-ink)]">{name}</span>}
      </div>
      <span className="shrink-0 font-[family-name:var(--font-heading)] text-sm font-extrabold" style={{ color: valueColor || "#e7e2d3" }}>{value}</span>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[var(--c-line)] bg-[var(--c-card)] p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--gold)]"><span className="text-sm">{icon}</span>{title}</div>
      {children}
    </div>
  );
}

export default function CourseRecords({ best, aces, drives, photos, loaded }: { best: BestScore[]; aces: AceRecord[]; drives: DriveRecord[]; photos: Map<string, string>; loaded: boolean }) {
  const metric = useMetricPref();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Panel icon="🏆" title="Best scores">
        {best.length === 0 ? <p className="py-2 text-sm text-[var(--c-muted)]">No rounds logged yet.</p> : best.slice(0, 5).map((b, i) => (
          <Row key={b.uid + i} i={i} photo={photos.get(b.uid)} name={b.name} username={b.username} value={fmtScore(b.value)} valueColor={b.value < 0 ? "#5fcf80" : b.value > 0 ? "#f08c8c" : "#c9c3b4"} />
        ))}
      </Panel>

      <Panel icon="🎯" title="Aces">
        {!loaded ? <p className="py-2 text-sm text-[var(--c-muted)]">Loading…</p> : aces.length === 0 ? <p className="py-2 text-sm text-[var(--c-muted)]">No aces recorded yet.</p> : aces.map((a, i) => (
          <Row key={a.uid + i} i={i} photo={photos.get(a.uid)} name={a.player} username={a.username} value={`Hole ${a.hole}`} valueColor="#E8B560" />
        ))}
      </Panel>

      <Panel icon="🚀" title="Long drives">
        {!loaded ? <p className="py-2 text-sm text-[var(--c-muted)]">Loading…</p> : drives.length === 0 ? <p className="py-2 text-sm text-[var(--c-muted)]">No drives recorded yet.</p> : drives.map((d, i) => (
          <Row key={d.uid + i} i={i} photo={photos.get(d.uid)} name={d.player} username={d.username} value={fmtDist(d.distance, metric)} valueColor="#E8B560" />
        ))}
      </Panel>
    </div>
  );
}
