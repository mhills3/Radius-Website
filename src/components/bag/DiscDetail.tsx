"use client";

import { useEffect, useState } from "react";
import { type FlightDisc, CAT_META, TIER_META, buildFlightPath } from "@/lib/bag";
import { RESULTS } from "@/lib/rounds";
import DiscGraphic from "@/components/bag/DiscGraphic";

const CONDITIONS = ["Brand New", "Good", "Used", "Worn", "Beat In"];

const W = 230;
const H = 280;
const PAD = 20;

function stabilityLabel(score?: number): string {
  if (score == null) return "—";
  if (score <= -2.5) return "Very understable";
  if (score <= -0.5) return "Understable";
  if (score <= 1.5) return "Stable / straight";
  if (score <= 3.5) return "Overstable";
  return "Very overstable";
}
// Map stability score (domain ~ -3..5) → 0..100% across the spectrum.
function stabilityPct(score: number): number {
  return Math.max(2, Math.min(98, ((score + 3) / 8) * 100));
}

function Num({ label, v }: { label: string; v?: number }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white/[0.04] py-3">
      <span className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none text-[var(--cream)]">{v != null ? v : "—"}</span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-[var(--sage-dim)]">{label}</span>
    </div>
  );
}

export default function DiscDetail({ disc, onClose, onToggleFav, onSave, onRemove }: { disc: FlightDisc; onClose: () => void; onToggleFav?: () => void; onSave?: (patch: { nickname: string; condition: string }) => void; onRemove?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState(disc.nickname || "");
  const [cond, setCond] = useState(disc.condition || "Brand New");
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (editing ? setEditing(false) : onClose());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editing]);

  const save = () => { onSave?.({ nickname: nick.trim(), condition: cond }); setEditing(false); };
  const condOptions = CONDITIONS.includes(cond) ? CONDITIONS : [cond, ...CONDITIONS];

  const color = disc.tier ? TIER_META[disc.tier].color : "#8a968d";
  const cat = CAT_META[disc.category];
  const p = buildFlightPath(disc, W, H, PAD);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[var(--bg-mid)] animate-[slideInRight_0.28s_cubic-bezier(0.22,1,0.36,1)]">
        {/* top bar */}
        <div className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--sage-dim)]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cat.color }} />
            {cat.label}
          </span>
          <div className="flex items-center gap-1">
            {onSave && (
              <button onClick={() => setEditing((v) => !v)} aria-label="Edit disc" className={`rounded-full p-2 transition-colors hover:bg-white/10 ${editing ? "text-[var(--gold)]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
              </button>
            )}
            {onToggleFav && (
              <button onClick={onToggleFav} aria-label="Favorite" className="rounded-full p-2 transition-colors hover:bg-white/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill={disc.isFavorite ? "var(--gold)" : "none"} stroke={disc.isFavorite ? "var(--gold)" : "currentColor"} strokeWidth="2" strokeLinejoin="round" style={{ color: "var(--sage)" }}>
                  <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.8l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="rounded-full p-2 text-[var(--sage)] transition-colors hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        {/* hero — disc + glow */}
        <div className="relative flex flex-col items-center px-6 pb-2 pt-2">
          <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full opacity-40 blur-2xl" style={{ background: disc.color }} />
          <div className="relative drop-shadow-[0_12px_24px_rgba(0,0,0,0.4)]">
            {disc.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={disc.photoUrl} alt={disc.name} className="h-32 w-32 rounded-full object-cover ring-2 ring-white/15" />
            ) : (
              <DiscGraphic color={disc.color} speed={disc.speed} size={128} />
            )}
          </div>
          <h2 className="mt-4 text-center font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-[var(--cream)]">{disc.nickname || disc.name}</h2>
          <p className="text-sm text-[var(--text-body)]">{disc.nickname ? `${disc.name} · ` : ""}{disc.brand || (disc.known ? "" : "Unknown disc")}</p>
        </div>

        {editing && (
          <div className="mx-6 mt-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.06] p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--gold)]">Edit disc</div>
            <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Nickname</label>
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Backhand bomber" maxLength={40} className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
            <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Condition</label>
            <select value={cond} onChange={(e) => setCond(e.target.value)} className="mb-4 w-full rounded-xl border border-white/10 bg-[var(--bg-mid)] px-3 py-2 text-sm text-[var(--cream)] outline-none focus:border-[var(--gold)]">
              {condOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={save} className="flex-1 rounded-full bg-[var(--gold)] py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">Save</button>
              <button onClick={() => { setNick(disc.nickname || ""); setCond(disc.condition || "Brand New"); setEditing(false); }} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">Cancel</button>
            </div>
            {onRemove && (
              <div className="mt-4 border-t border-white/10 pt-3">
                {!confirmRemove ? (
                  <button onClick={() => setConfirmRemove(true)} className="flex w-full items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold text-[#e0857d] transition-colors hover:bg-[#d9473f]/10">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                    Remove from bag
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="mb-2.5 text-sm text-[var(--cream)]">Remove <span className="font-semibold">{disc.nickname || disc.name}</span> from your bag?</p>
                    <div className="flex gap-2">
                      <button onClick={() => onRemove()} className="flex-1 rounded-full bg-[#d9473f] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#e0574f]">Remove</button>
                      <button onClick={() => setConfirmRemove(false)} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {disc.known ? (
          <>
            {/* flight numbers */}
            <div className="grid grid-cols-4 gap-2 px-6 pt-5">
              <Num label="Speed" v={disc.speed} />
              <Num label="Glide" v={disc.glide} />
              <Num label="Turn" v={disc.turn} />
              <Num label="Fade" v={disc.fade} />
            </div>

            {/* stability spectrum */}
            <div className="px-6 pt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">Stability</span>
                <span className="text-sm font-semibold" style={{ color }}>{stabilityLabel(disc.stability)}{disc.stability != null ? ` · ${disc.stability > 0 ? `+${disc.stability}` : disc.stability}` : ""}</span>
              </div>
              <div className="relative h-2.5 rounded-full" style={{ background: "linear-gradient(90deg, #4d94fa 0%, #5fb87a 50%, #d9473f 100%)" }}>
                {disc.stability != null && (
                  <div className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--bg-mid)] bg-[var(--cream)] shadow" style={{ left: `${stabilityPct(disc.stability)}%` }} />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wide text-[var(--sage-dim)]">
                <span>Understable</span><span>Stable</span><span>Overstable</span>
              </div>
            </div>

            {/* flight path */}
            <div className="px-6 pt-6">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">Flight path · RHBH</div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-2">
                <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto" style={{ maxWidth: W }}>
                  <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 5" />
                  <path d={p.d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
                  <circle cx={p.endX} cy={p.endY} r="4.5" fill={color} />
                  <circle cx={W / 2} cy={H - PAD} r="4" fill="var(--cream)" />
                </svg>
              </div>
            </div>
          </>
        ) : (
          <div className="px-6 pt-4 text-sm text-[var(--sage-dim)]">No flight data on file for this disc.</div>
        )}

        {/* throw breakdown */}
        {disc.outcomes && disc.outcomes.total > 0 && (
          <div className="px-6 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">Throw breakdown</span>
              <span className="text-sm"><span className="font-bold text-[var(--cream)]">{disc.outcomes.quality}</span><span className="text-[var(--sage-dim)]"> quality</span></span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full">
              {RESULTS.filter((r) => (disc.outcomes!.counts[r.key] ?? 0) > 0).map((r) => (
                <div key={r.key} style={{ flex: disc.outcomes!.counts[r.key], background: r.color }} title={`${r.label}: ${disc.outcomes!.counts[r.key]}`} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {RESULTS.filter((r) => (disc.outcomes!.counts[r.key] ?? 0) > 0).map((r) => {
                const n = disc.outcomes!.counts[r.key];
                return (
                  <div key={r.key} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className="text-[var(--text-body)]">{r.label}</span>
                    <span className="ml-auto font-semibold text-[var(--cream)]">{n}</span>
                    <span className="w-9 text-right text-xs text-[var(--sage-dim)]">{Math.round((n / disc.outcomes!.total) * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* usage */}
        <div className="grid grid-cols-2 gap-2 px-6 py-6">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-[var(--sage-dim)]">Throws logged</div>
            <div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[var(--cream)]">{disc.outcomes?.total || disc.throwCount}</div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-[var(--sage-dim)]">Condition</div>
            <div className="font-semibold text-[var(--cream)]">{disc.condition || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
