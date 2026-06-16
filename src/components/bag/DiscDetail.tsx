"use client";

import { useEffect, useState } from "react";
import { type FlightDisc, type Tier, CAT_META, TIER_META, buildFlightPath } from "@/lib/bag";
import { RESULTS } from "@/lib/rounds";
import DiscGraphic from "@/components/bag/DiscGraphic";

// Exact wear values the iOS/Android apps use (DiscCondition enum) — must match for cross-platform sync.
const CONDITIONS = ["Brand New", "Slightly Used", "Seasoned", "Beat In", "Very Beat In"];

const W = 240;
const H = 300;
const PAD = 22;

function stabilityLabel(score?: number): string {
  if (score == null) return "—";
  if (score <= -2.5) return "Very understable";
  if (score <= -0.5) return "Understable";
  if (score <= 1.5) return "Stable / straight";
  if (score <= 3.5) return "Overstable";
  return "Very overstable";
}
function stabilityBlurb(tier?: Tier): string {
  if (tier === "US") return "Turns over easily — built for anhyzers, rollers, and turnover lines.";
  if (tier === "OS") return "Holds a dependable fade — trustworthy in wind and on forehands.";
  return "Flies straight and true — workable on just about any line.";
}
// Map stability score (domain ~ -3..5) → 0..100% across the spectrum.
function stabilityPct(score: number): number {
  return Math.max(2, Math.min(98, ((score + 3) / 8) * 100));
}
const qColor = (q: number) => (q >= 70 ? "#5fb87a" : q >= 45 ? "#F6C165" : "#d9473f");

function SectionLabel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      {accent && <span className="h-3 w-1 rounded-full" style={{ background: accent }} />}
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">{children}</span>
    </div>
  );
}

function GaugeRing({ value, color, size = 68 }: { value: number; color: string; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-[family-name:var(--font-heading)] text-lg font-extrabold leading-none text-[var(--cream)]">{value}</span>
        <span className="text-[8px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">score</span>
      </div>
    </div>
  );
}

export type DiscPatch = { nickname: string; condition: string; custom: { speed?: number; glide?: number; turn?: number; fade?: number } };

const numOrUndef = (s: string): number | undefined => {
  const n = parseFloat(s);
  return s.trim() === "" || Number.isNaN(n) ? undefined : n;
};

export default function DiscDetail({ disc, onClose, onToggleFav, onSave, onRemove, onMoveToCollection, onMarkLost }: { disc: FlightDisc; onClose: () => void; onToggleFav?: () => void; onSave?: (patch: DiscPatch) => void; onRemove?: () => void; onMoveToCollection?: () => void; onMarkLost?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState(disc.nickname || "");
  const [cond, setCond] = useState(disc.condition || "Brand New");
  const [cs, setCs] = useState(disc.customSpeed?.toString() ?? "");
  const [cg, setCg] = useState(disc.customGlide?.toString() ?? "");
  const [ct, setCt] = useState(disc.customTurn?.toString() ?? "");
  const [cf, setCf] = useState(disc.customFade?.toString() ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (editing ? setEditing(false) : onClose());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editing]);

  const save = () => {
    onSave?.({ nickname: nick.trim(), condition: cond, custom: { speed: numOrUndef(cs), glide: numOrUndef(cg), turn: numOrUndef(ct), fade: numOrUndef(cf) } });
    setEditing(false);
  };
  const resetCustom = () => { setCs(""); setCg(""); setCt(""); setCf(""); };
  const condOptions = CONDITIONS.includes(cond) ? CONDITIONS : [cond, ...CONDITIONS];

  // Effective flight numbers = custom override ?? factory (what the apps display & fly).
  const eS = disc.customSpeed ?? disc.speed;
  const eG = disc.customGlide ?? disc.glide;
  const eT = disc.customTurn ?? disc.turn;
  const eF = disc.customFade ?? disc.fade;
  const eStab = typeof eT === "number" && typeof eF === "number" ? eT + eF : disc.stability;
  const effTier: Tier | undefined = eStab == null ? disc.tier : eStab < -0.5 ? "US" : eStab <= 1.5 ? "ST" : "OS";
  const hasCustom = disc.customSpeed != null || disc.customGlide != null || disc.customTurn != null || disc.customFade != null;

  const color = effTier ? TIER_META[effTier].color : "#8a968d";
  const cat = CAT_META[disc.category];
  const p = buildFlightPath({ speed: eS, turn: eT, fade: eF }, W, H, PAD);
  const flightNums: [string, number | undefined][] = [["Speed", eS], ["Glide", eG], ["Turn", eT], ["Fade", eF]];
  const throwsLogged = disc.outcomes?.total || disc.throwCount;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-gradient-to-b from-[#1a2a20] to-[var(--bg-deep)] shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/10 animate-[slideInRight_0.3s_cubic-bezier(0.22,1,0.36,1)]">
        {/* tier-colored hero glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72" style={{ background: `radial-gradient(120% 80% at 50% -10%, ${color}33, transparent 65%)` }} />

        {/* top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <span className="flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--cream)] ring-1 ring-white/10 backdrop-blur">
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

        {/* hero — disc + glow + name */}
        <div className="relative z-10 flex flex-col items-center px-6 pb-1 pt-3">
          <div className="relative">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[40px]" style={{ background: disc.color }} />
            <div className="relative drop-shadow-[0_18px_34px_rgba(0,0,0,0.5)]">
              {disc.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={disc.photoUrl} alt={disc.name} className="h-36 w-36 rounded-full object-cover ring-2 ring-white/15" />
              ) : (
                <DiscGraphic color={disc.color} speed={disc.speed} size={140} />
              )}
            </div>
            {disc.isFavorite && (
              <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-[var(--gold)] text-[#16221b] shadow-lg ring-2 ring-[var(--bg-deep)]">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.8l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" /></svg>
              </span>
            )}
          </div>
          <h2 className="mt-4 text-center font-[family-name:var(--font-heading)] text-[2rem] font-extrabold leading-tight tracking-[-0.02em] text-[var(--cream)]">{disc.nickname || disc.name}</h2>
          <p className="text-sm text-[var(--text-body)]">{disc.nickname ? `${disc.name} · ` : ""}{disc.brand || (disc.known ? "" : "Unknown disc")}</p>

          {/* badge row */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {effTier && <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${color}22`, color }}>{TIER_META[effTier].label}</span>}
            {disc.condition && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-body)]">{disc.condition}</span>}
            {throwsLogged > 0 && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-body)]">{throwsLogged} {throwsLogged === 1 ? "throw" : "throws"}</span>}
          </div>
        </div>

        {editing && (
          <div className="relative z-10 mx-6 mt-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.06] p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--gold)]">Edit disc</div>
            <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Nickname</label>
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Backhand bomber" maxLength={40} className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
            <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Condition</label>
            <select value={cond} onChange={(e) => setCond(e.target.value)} className="mb-4 w-full rounded-xl border border-white/10 bg-[var(--bg-mid)] px-3 py-2 text-sm text-[var(--cream)] outline-none focus:border-[var(--gold)]">
              {condOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {disc.known && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--sage)]">Custom flight numbers</label>
                  {(cs || cg || ct || cf) && <button type="button" onClick={resetCustom} className="text-[11px] font-semibold text-[var(--gold)] hover:underline">Reset to factory</button>}
                </div>
                <p className="mb-2 text-[11px] text-[var(--sage-dim)]">Leave blank to use factory numbers. Adjust if your disc flies differently.</p>
                <div className="grid grid-cols-4 gap-2">
                  {([["Speed", cs, setCs, disc.speed], ["Glide", cg, setCg, disc.glide], ["Turn", ct, setCt, disc.turn], ["Fade", cf, setCf, disc.fade]] as const).map(([label, val, setter, factory]) => (
                    <label key={label} className="block">
                      <span className="mb-1 block text-center text-[10px] uppercase tracking-wide text-[var(--sage-dim)]">{label}</span>
                      <input value={val} onChange={(e) => setter(e.target.value)} inputMode="decimal" placeholder={factory != null ? String(factory) : "—"} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-center text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={save} className="flex-1 rounded-full bg-[var(--gold)] py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">Save</button>
              <button onClick={() => { setNick(disc.nickname || ""); setCond(disc.condition || "Brand New"); setCs(disc.customSpeed?.toString() ?? ""); setCg(disc.customGlide?.toString() ?? ""); setCt(disc.customTurn?.toString() ?? ""); setCf(disc.customFade?.toString() ?? ""); setEditing(false); }} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">Cancel</button>
            </div>
            {(onMoveToCollection || onMarkLost) && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {onMoveToCollection && <button onClick={onMoveToCollection} className="rounded-full border border-white/10 py-2 text-sm font-semibold text-[var(--sage)] transition-colors hover:border-white/30 hover:text-[var(--cream)]">📦 To collection</button>}
                {onMarkLost && <button onClick={onMarkLost} className="rounded-full border border-white/10 py-2 text-sm font-semibold text-[var(--sage)] transition-colors hover:border-white/30 hover:text-[var(--cream)]">❓ Mark lost</button>}
              </div>
            )}
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
          <div className="relative z-10 px-6 pt-6">
            {/* signature flight numbers */}
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel accent={color}>Flight numbers</SectionLabel>
              {hasCustom && <span className="-mt-1 rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">Tuned</span>}
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }} />
              <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
                {flightNums.map(([label, v]) => (
                  <div key={label} className="flex flex-col items-center py-4">
                    <span className="font-[family-name:var(--font-heading)] text-[1.65rem] font-extrabold leading-none text-[var(--cream)]">{v != null ? v : "—"}</span>
                    <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sage-dim)]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* stability */}
            <div className="pt-7">
              <div className="mb-2.5 flex items-center justify-between">
                <SectionLabel accent={color}>Stability</SectionLabel>
                <span className="-mt-1 text-sm font-bold" style={{ color }}>{stabilityLabel(eStab)}{eStab != null ? ` · ${eStab > 0 ? `+${eStab}` : eStab}` : ""}</span>
              </div>
              <div className="relative h-2.5 rounded-full" style={{ background: "linear-gradient(90deg, #4d94fa 0%, #5fb87a 50%, #d9473f 100%)" }}>
                {eStab != null && (
                  <div className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--bg-deep)] bg-[var(--cream)] shadow-[0_2px_8px_rgba(0,0,0,0.5)]" style={{ left: `${stabilityPct(eStab)}%` }} />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--sage-dim)]">
                <span>Understable</span><span>Stable</span><span>Overstable</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-body)]">{stabilityBlurb(effTier)}</p>
            </div>

            {/* flight path */}
            <div className="pt-7">
              <SectionLabel accent={color}>Flight path · RHBH</SectionLabel>
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent">
                <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block" style={{ maxWidth: W }}>
                  <defs>
                    <linearGradient id={`fp-${effTier ?? "x"}`} x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor={color} stopOpacity="0.55" />
                      <stop offset="100%" stopColor={color} stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="fp-lane" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(95,184,122,0.10)" />
                      <stop offset="100%" stopColor="rgba(95,184,122,0)" />
                    </linearGradient>
                  </defs>
                  <rect x={W / 2 - 46} y={PAD} width={92} height={H - PAD * 2} rx={46} fill="url(#fp-lane)" />
                  <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3 6" />
                  <path d={p.d} fill="none" stroke={`url(#fp-${effTier ?? "x"})`} strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx={p.endX} cy={p.endY} r="6" fill={color} />
                  <circle cx={p.endX} cy={p.endY} r="11" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="1.5" />
                  <circle cx={W / 2} cy={H - PAD} r="5" fill="var(--cream)" />
                </svg>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wide text-[var(--sage-dim)]">Tee</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 px-6 pt-6 text-sm text-[var(--sage-dim)]">No flight data on file for this disc.</div>
        )}

        {/* performance / throw breakdown */}
        {disc.outcomes && disc.outcomes.total > 0 && (
          <div className="relative z-10 px-6 pt-7">
            <SectionLabel accent={color}>Performance</SectionLabel>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex items-center gap-4">
                <GaugeRing value={disc.outcomes.quality} color={qColor(disc.outcomes.quality)} />
                <div className="min-w-0 flex-1">
                  <div className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--cream)]">Shot quality</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-body)]">How often this disc finds the fairway or better across {disc.outcomes.total} logged {disc.outcomes.total === 1 ? "throw" : "throws"}.</p>
                </div>
              </div>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
                {RESULTS.filter((r) => (disc.outcomes!.counts[r.key] ?? 0) > 0).map((r) => (
                  <div key={r.key} style={{ flex: disc.outcomes!.counts[r.key], background: r.color }} title={`${r.label}: ${disc.outcomes!.counts[r.key]}`} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2">
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
          </div>
        )}

        {/* usage tiles */}
        <div className="relative z-10 grid grid-cols-2 gap-2.5 px-6 py-7">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sage-dim)]">Throws logged</div>
            <div className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[var(--cream)]">{throwsLogged}</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sage-dim)]">Condition</div>
            <div className="mt-1 font-semibold text-[var(--cream)]">{disc.condition || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
