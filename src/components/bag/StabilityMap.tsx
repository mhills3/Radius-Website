"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CAT_META, type Cat, type FlightDisc } from "@/lib/bag";

// Brand hex (literal, not CSS vars — the PNG export rasterizes the SVG and can't resolve vars).
const BG = "#131e18";
const CREAM = "#F5EDE1";
const GOLD = "#F6C165";
const GRID = "rgba(245,237,225,0.09)";
const GRID_STRONG = "rgba(245,237,225,0.22)";
const DIM = "rgba(168,179,145,0.6)";
const BODY = "rgba(245,237,225,0.72)";
const FONT = "'Sora', system-ui, -apple-system, sans-serif";

type Pt = { name: string; speed: number; stab: number; glide?: number; turn?: number; fade?: number; cat: Cat; color: string };

/** Effective flight (custom wear overrides win), then map to a plottable point. */
function toPoints(discs: FlightDisc[]): Pt[] {
  return discs
    .map((d) => {
      const speed = d.customSpeed ?? d.speed;
      const turn = d.customTurn ?? d.turn;
      const fade = d.customFade ?? d.fade;
      if (speed == null || turn == null || fade == null) return null;
      return { name: d.nickname || d.name, speed, stab: turn + fade, glide: d.customGlide ?? d.glide, turn, fade, cat: d.category, color: CAT_META[d.category].color };
    })
    .filter(Boolean) as Pt[];
}

interface Ranges { xHi: number; xLo: number; yHi: number; yLo: number; }
/** Axis bounds with a padding cell on every side so no disc ever sits on the grid border. */
function ranges(pts: Pt[]): Ranges {
  const stabs = pts.map((p) => p.stab);
  const sps = pts.map((p) => p.speed);
  const xHi = Math.max(2, Math.ceil(Math.max(...stabs)) + 1);
  const xLo = Math.min(-1, Math.floor(Math.min(...stabs)) - 1);
  const yHi = Math.min(16, Math.ceil(Math.max(...sps)) + 1);
  const yLo = Math.max(0, Math.floor(Math.min(...sps)) - 1);
  return { xHi, xLo, yHi, yLo };
}

interface Placed { p: Pt; x: number; y: number; gi: number; gn: number; }
function plot(pts: Pt[], r: Ranges, gx: number, gy: number, gw: number, gh: number, maxSpread: number) {
  const sx = (stab: number) => gx + ((r.xHi - stab) / (r.xHi - r.xLo)) * gw;
  const sy = (speed: number) => gy + ((r.yHi - speed) / (r.yHi - r.yLo)) * gh;
  const cellW = gw / (r.xHi - r.xLo);
  const groups = new Map<string, Pt[]>();
  for (const p of pts) {
    const k = `${Math.round(p.speed)}|${Math.round(p.stab)}`;
    const g = groups.get(k);
    if (g) g.push(p); else groups.set(k, [p]);
  }
  const out: Placed[] = [];
  for (const grp of groups.values()) {
    const n = grp.length;
    const spread = Math.min(cellW * 0.46, maxSpread);
    grp.forEach((p, i) => {
      const off = n > 1 ? (i - (n - 1) / 2) * spread : 0;
      out.push({ p, x: sx(p.stab) + off, y: sy(p.speed), gi: i, gn: n });
    });
  }
  return out;
}

const ticksDown = (hi: number, lo: number) => { const a: number[] = []; for (let v = hi; v >= lo; v--) a.push(v); return a; };
const fmtNum = (n?: number) => (n == null ? "—" : n);

/* ----------------------------- Interactive on-screen chart (just the chart, fills its box) ----------------------------- */
function ChartCore({ pts, big }: { pts: Pt[]; big: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const r = ranges(pts);
  const { w, h } = size;
  const padL = big ? 46 : 26, padT = big ? 40 : 16, padR = big ? 18 : 12, padB = big ? 18 : 14;
  const gx = padL, gy = padT, gw = Math.max(0, w - padL - padR), gh = Math.max(0, h - padT - padB);
  const placed = w > 0 ? plot(pts, r, gx, gy, gw, gh, big ? 30 : 18) : [];
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  const ty = (v: number) => gy + ((r.yHi - v) / (r.yHi - r.yLo)) * gh;
  const dotR = big ? Math.max(6, Math.min(11, Math.min(w, h) / 52)) : Math.max(3.5, Math.min(6, Math.min(w, h) / 42));
  const nameFont = Math.max(9, Math.min(15, w / 64));
  const tickFont = big ? Math.max(10, Math.min(15, w / 70)) : 9;
  const ht = hover != null ? placed[hover] : null;

  return (
    <div ref={ref} className="relative h-full w-full">
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: FONT }}>
          {/* grid */}
          {ticksDown(r.xHi, r.xLo).map((v) => (
            <g key={`x${v}`}>
              <line x1={tx(v)} y1={gy} x2={tx(v)} y2={gy + gh} stroke={v === 0 ? "rgba(246,193,101,0.4)" : GRID} strokeWidth={1} strokeDasharray={v === 0 ? "5 6" : undefined} />
              {big && <text x={tx(v)} y={gy - 10} fill={v === 0 ? GOLD : DIM} fontSize={tickFont} fontWeight={700} textAnchor="middle">{v > 0 ? `+${v}` : v}</text>}
            </g>
          ))}
          {ticksDown(r.yHi, r.yLo).map((v) => (
            <g key={`y${v}`}>
              <line x1={gx} y1={ty(v)} x2={gx + gw} y2={ty(v)} stroke={GRID} strokeWidth={1} />
              {big && <text x={gx - 12} y={ty(v) + tickFont * 0.36} fill={DIM} fontSize={tickFont} fontWeight={700} textAnchor="end">{v}</text>}
            </g>
          ))}
          <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke={GRID_STRONG} strokeWidth={1} />
          {big ? (
            <>
              <text x={gx} y={gy - 24} fill={DIM} fontSize={tickFont} fontWeight={700} letterSpacing={1}>OVERSTABLE</text>
              <text x={gx + gw} y={gy - 24} fill={DIM} fontSize={tickFont} fontWeight={700} letterSpacing={1} textAnchor="end">UNDERSTABLE</text>
              <text x={14} y={gy + gh / 2} fill={BODY} fontSize={tickFont} fontWeight={700} textAnchor="middle" transform={`rotate(-90 14 ${gy + gh / 2})`}>Speed</text>
            </>
          ) : (
            <>
              <text x={gx + 2} y={11} fill={DIM} fontSize={9} fontWeight={700} letterSpacing={1}>OVER</text>
              <text x={gx + gw} y={11} fill={DIM} fontSize={9} fontWeight={700} letterSpacing={1} textAnchor="end">UNDER</text>
            </>
          )}

          {/* discs */}
          {placed.map(({ p, x, y, gi, gn }, i) => {
            const on = hover === i;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((h) => (h === i ? null : h))} style={{ cursor: big ? "pointer" : "default" }}>
                {big && <circle cx={x} cy={y} r={dotR + 12} fill="transparent" />}
                <circle cx={x} cy={y} r={on ? dotR + 2 : dotR} fill={p.color} stroke={BG} strokeWidth={big ? 2.5 : 1.5} opacity={hover != null && !on ? 0.45 : 1} />
                {big && <text x={x} y={y + dotR + nameFont + (gn > 1 ? (gi % 2) * (nameFont + 3) : 0)} fill={CREAM} fontSize={nameFont} fontWeight={600} textAnchor="middle" opacity={hover != null && !on ? 0.4 : 0.92}>{p.name.length > 13 ? p.name.slice(0, 12) + "…" : p.name}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {/* hover tooltip (HTML overlay, kept out of the exported SVG) */}
      {big && ht && w > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-black/85 px-3 py-2 backdrop-blur-sm"
          style={{ left: `${(ht.x / w) * 100}%`, top: `${((ht.y - dotR - 6) / h) * 100}%` }}
        >
          <div className="whitespace-nowrap text-sm font-bold text-[var(--cream)]">{ht.p.name}</div>
          <div className="mt-0.5 whitespace-nowrap font-mono text-xs text-[var(--gold)]">{fmtNum(ht.p.speed)} / {fmtNum(ht.p.glide)} / {fmtNum(ht.p.turn)} / {fmtNum(ht.p.fade)}</div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Branded export SVG (portrait, for sharing) ----------------------------- */
const W = 1080, H = 1350;
function BrandedChart({ pts, discCount, svgRef }: { pts: Pt[]; discCount: number; svgRef: React.Ref<SVGSVGElement> }) {
  const r = ranges(pts);
  const gx = 132, gridRight = W - 60;
  const gy = 232;
  const footerY = H - 92;
  const gw = gridRight - gx;
  const gh = footerY - 44 - gy;
  const placed = plot(pts, r, gx, gy, gw, gh, 46);
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  const ty = (v: number) => gy + ((r.yHi - v) / (r.yHi - r.yLo)) * gh;
  const cats: Cat[] = (["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"] as Cat[]).filter((c) => pts.some((p) => p.cat === c));

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block", fontFamily: FONT }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rad-glow" cx="84%" cy="6%" r="62%">
          <stop offset="0%" stopColor="rgba(246,193,101,0.15)" />
          <stop offset="70%" stopColor="rgba(246,193,101,0)" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={BG} />
      <rect x={0} y={0} width={W} height={H} fill="url(#rad-glow)" />
      <text x={60} y={68} fill={GOLD} fontSize={20} fontWeight={700} letterSpacing={4}>RADIUS · MY BAG</text>
      <text x={60} y={120} fill={CREAM} fontSize={54} fontWeight={800} letterSpacing={-1.6}>Bag Stability Map</text>
      <text x={W - 60} y={90} fill={CREAM} fontSize={34} fontWeight={800} textAnchor="end">{discCount}</text>
      <text x={W - 60} y={118} fill={DIM} fontSize={18} fontWeight={600} letterSpacing={2} textAnchor="end">DISCS</text>
      <text x={(gx + gridRight) / 2} y={172} fill={BODY} fontSize={25} fontWeight={700} textAnchor="middle">Stability (Turn + Fade)</text>
      <text x={gx} y={204} fill={DIM} fontSize={17} fontWeight={700} letterSpacing={1.5}>OVERSTABLE</text>
      <text x={gridRight} y={204} fill={DIM} fontSize={17} fontWeight={700} letterSpacing={1.5} textAnchor="end">UNDERSTABLE</text>
      <text x={40} y={gy + gh / 2} fill={BODY} fontSize={22} fontWeight={700} textAnchor="middle" transform={`rotate(-90 40 ${gy + gh / 2})`}>Speed</text>
      {ticksDown(r.xHi, r.xLo).map((v) => (
        <g key={`x${v}`}>
          <line x1={tx(v)} y1={gy} x2={tx(v)} y2={gy + gh} stroke={v === 0 ? GOLD : GRID} strokeWidth={v === 0 ? 1.5 : 1} strokeDasharray={v === 0 ? "7 8" : undefined} opacity={v === 0 ? 0.5 : 1} />
          <text x={tx(v)} y={gy - 14} fill={v === 0 ? GOLD : DIM} fontSize={19} fontWeight={700} textAnchor="middle">{v > 0 ? `+${v}` : v}</text>
        </g>
      ))}
      {ticksDown(r.yHi, r.yLo).map((v) => (
        <g key={`y${v}`}>
          <line x1={gx} y1={ty(v)} x2={gridRight} y2={ty(v)} stroke={GRID} strokeWidth={1} />
          <text x={gx - 18} y={ty(v) + 6} fill={DIM} fontSize={19} fontWeight={700} textAnchor="end">{v}</text>
        </g>
      ))}
      <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke={GRID_STRONG} strokeWidth={1.5} />
      {placed.map(({ p, x, y, gi, gn }, i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={14} fill={p.color} stroke={BG} strokeWidth={3} />
          <text x={x} y={y + 33 + (gn > 1 ? (gi % 2) * 22 : 0)} fill={CREAM} fontSize={18} fontWeight={600} textAnchor="middle">{p.name.length > 13 ? p.name.slice(0, 12) + "…" : p.name}</text>
        </g>
      ))}
      {cats.map((c, i) => (
        <g key={c} transform={`translate(${60 + i * 188}, ${footerY + 40})`}>
          <circle cx={9} cy={-6} r={9} fill={CAT_META[c].color} />
          <text x={28} y={0} fill={BODY} fontSize={20} fontWeight={600}>{CAT_META[c].short}</text>
        </g>
      ))}
      <text x={W - 60} y={footerY + 18} fill={CREAM} fontSize={28} fontWeight={700} letterSpacing={-0.9} textAnchor="end">Radius</text>
      <text x={W - 60} y={footerY + 46} fill={DIM} fontSize={17} fontWeight={500} textAnchor="end">radiusdiscgolf.com</text>
    </svg>
  );
}

/* ----------------------------- PNG export ----------------------------- */
function downloadPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const xml = new XMLSerializer().serializeToString(svg);
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.src = src;
}

/* ----------------------------- Card + modal ----------------------------- */
export default function StabilityMap({ discs, className = "" }: { discs: FlightDisc[]; className?: string }) {
  const pts = useMemo(() => toPoints(discs), [discs]);
  const [open, setOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pts.length === 0) return null;
  const cats: Cat[] = (["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"] as Cat[]).filter((c) => pts.some((p) => p.cat === c));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`group flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-colors hover:border-[var(--gold)]/40 ${className}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Stability Map</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gold)] opacity-80 transition-opacity group-hover:opacity-100">
            View &amp; share
            <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <ChartCore pts={pts} big={false} />
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6" onClick={() => setOpen(false)}>
          <div
            className="relative flex w-[min(96vw,1060px)] flex-col overflow-hidden rounded-3xl bg-[var(--bg-deep)] p-4 ring-1 ring-white/10 sm:p-6"
            style={{ height: "min(94vh, 920px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Radius · My Bag</div>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-[-0.02em] text-[var(--cream)]">Bag Stability Map</h2>
                <p className="mt-0.5 text-sm text-[var(--text-body)]">Speed × Turn+Fade · {discs.length} discs · hover a disc</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[var(--cream)] transition-colors hover:bg-white/15">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {/* the chart — fills, interactive */}
            <div className="min-h-0 flex-1">
              <ChartCore pts={pts} big />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-body)]">
                {cats.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_META[c].color }} />{CAT_META[c].short}</span>
                ))}
              </div>
              <button
                onClick={() => svgRef.current && downloadPng(svgRef.current, "radius-stability-map.png")}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-opacity hover:opacity-90"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* off-screen branded portrait, rendered only for the PNG export */}
      {open && (
        <div aria-hidden className="pointer-events-none fixed left-[-99999px] top-0 opacity-0">
          <BrandedChart pts={pts} discCount={discs.length} svgRef={svgRef} />
        </div>
      )}
    </>
  );
}
