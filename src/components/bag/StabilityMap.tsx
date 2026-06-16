"use client";

import { useMemo, useRef, useState } from "react";
import { CAT_META, type Cat, type FlightDisc } from "@/lib/bag";

// Brand hex (literal, not CSS vars — the PNG export rasterizes the SVG and can't resolve vars).
const BG = "#131e18";
const CREAM = "#F5EDE1";
const GOLD = "#F6C165";
const GRID = "rgba(245,237,225,0.10)";
const GRID_STRONG = "rgba(245,237,225,0.20)";
const DIM = "rgba(168,179,145,0.55)";
const BODY = "rgba(245,237,225,0.72)";

type Pt = { name: string; speed: number; stab: number; cat: Cat; color: string };

/** Effective flight (custom wear overrides win), then map to a plottable point. */
function toPoints(discs: FlightDisc[]): Pt[] {
  return discs
    .map((d) => {
      const speed = d.customSpeed ?? d.speed;
      const turn = d.customTurn ?? d.turn;
      const fade = d.customFade ?? d.fade;
      if (speed == null || turn == null || fade == null) return null;
      return { name: d.nickname || d.name, speed, stab: turn + fade, cat: d.category, color: CAT_META[d.category].color };
    })
    .filter(Boolean) as Pt[];
}

interface Ranges { xHi: number; xLo: number; yHi: number; yLo: number; }
function ranges(pts: Pt[]): Ranges {
  const stabs = pts.map((p) => p.stab);
  const sps = pts.map((p) => p.speed);
  let xHi = Math.max(2, Math.ceil(Math.max(...stabs)));   // left = most overstable
  let xLo = Math.min(-1, Math.floor(Math.min(...stabs))); // right = most understable
  let yHi = Math.min(15, Math.max(5, Math.ceil(Math.max(...sps))));
  let yLo = Math.max(1, Math.floor(Math.min(...sps)));
  if (xHi - xLo < 3) xHi = xLo + 3;
  if (yHi - yLo < 3) yHi = yLo + 3;
  return { xHi, xLo, yHi, yLo };
}

/** Lay out points within a grid box, spreading any that share an integer cell so they don't overlap. */
function layout(pts: Pt[], r: Ranges, gx: number, gy: number, gw: number, gh: number) {
  const sx = (stab: number) => gx + ((r.xHi - stab) / (r.xHi - r.xLo)) * gw;
  const sy = (speed: number) => gy + ((r.yHi - speed) / (r.yHi - r.yLo)) * gh;
  const cellW = gw / (r.xHi - r.xLo);
  const groups = new Map<string, Pt[]>();
  for (const p of pts) {
    const k = `${Math.round(p.speed)}|${Math.round(p.stab)}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
  }
  const placed: { p: Pt; x: number; y: number }[] = [];
  for (const grp of groups.values()) {
    const n = grp.length;
    const spread = Math.min(cellW * 0.42, 26);
    grp.forEach((p, i) => {
      const off = n > 1 ? (i - (n - 1) / 2) * spread : 0;
      placed.push({ p, x: sx(p.stab) + off, y: sy(p.speed) });
    });
  }
  return { placed, sx, sy };
}

/* ----------------------------- Branded export SVG ----------------------------- */
const W = 1080, H = 1350;

function BrandedChart({ pts, discCount, svgRef }: { pts: Pt[]; discCount: number; svgRef: React.Ref<SVGSVGElement> }) {
  const r = ranges(pts);
  const headerH = 150;
  const gx = 124, gridRight = W - 56;
  const gy = headerH + 92;
  const footerY = H - 96;
  const gw = gridRight - gx;
  const gh = footerY - 28 - gy;
  const { placed } = layout(pts, r, gx, gy, gw, gh);

  const xTicks: number[] = [];
  for (let v = r.xHi; v >= r.xLo; v--) xTicks.push(v);
  const yTicks: number[] = [];
  for (let v = r.yHi; v >= r.yLo; v--) yTicks.push(v);
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  const ty = (v: number) => gy + ((r.yHi - v) / (r.yHi - r.yLo)) * gh;
  const cats: Cat[] = (["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"] as Cat[]).filter((c) => pts.some((p) => p.cat === c));
  const FONT = "'Sora', system-ui, -apple-system, sans-serif";

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", fontFamily: FONT }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rad-glow" cx="82%" cy="8%" r="60%">
          <stop offset="0%" stopColor="rgba(246,193,101,0.16)" />
          <stop offset="70%" stopColor="rgba(246,193,101,0)" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={BG} />
      <rect x={0} y={0} width={W} height={H} fill="url(#rad-glow)" />

      {/* header */}
      <text x={64} y={70} fill={GOLD} fontSize={20} fontWeight={700} letterSpacing={4}>RADIUS · MY BAG</text>
      <text x={64} y={120} fill={CREAM} fontSize={52} fontWeight={800} letterSpacing={-1.5}>Bag Stability Map</text>
      <text x={W - 64} y={92} fill={CREAM} fontSize={30} fontWeight={800} textAnchor="end">{discCount}</text>
      <text x={W - 64} y={120} fill={DIM} fontSize={18} fontWeight={600} letterSpacing={2} textAnchor="end">DISCS</text>

      {/* axis titles */}
      <text x={(gx + gridRight) / 2} y={headerH + 24} fill={BODY} fontSize={24} fontWeight={700} textAnchor="middle">Stability (Turn + Fade)</text>
      <text x={gx + 6} y={headerH + 56} fill={DIM} fontSize={17} fontWeight={700} letterSpacing={1.5}>OVERSTABLE</text>
      <text x={gridRight - 6} y={headerH + 56} fill={DIM} fontSize={17} fontWeight={700} letterSpacing={1.5} textAnchor="end">UNDERSTABLE</text>
      <text x={34} y={gy + gh / 2} fill={BODY} fontSize={22} fontWeight={700} textAnchor="middle" transform={`rotate(-90 34 ${gy + gh / 2})`}>Speed</text>

      {/* grid */}
      {xTicks.map((v) => (
        <g key={`x${v}`}>
          <line x1={tx(v)} y1={gy} x2={tx(v)} y2={gy + gh} stroke={v === 0 ? GRID_STRONG : GRID} strokeWidth={v === 0 ? 2 : 1} strokeDasharray={v === 0 ? "6 6" : undefined} />
          <text x={tx(v)} y={gy - 12} fill={DIM} fontSize={18} fontWeight={600} textAnchor="middle">{v > 0 ? `+${v}` : v}</text>
        </g>
      ))}
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={gx} y1={ty(v)} x2={gridRight} y2={ty(v)} stroke={GRID} strokeWidth={1} />
          <text x={gx - 16} y={ty(v) + 6} fill={DIM} fontSize={18} fontWeight={600} textAnchor="end">{v}</text>
        </g>
      ))}
      <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke={GRID_STRONG} strokeWidth={1.5} />

      {/* discs */}
      {placed.map(({ p, x, y }, i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={13} fill={p.color} stroke={BG} strokeWidth={2.5} />
          <text x={x} y={y + 32} fill={CREAM} fontSize={18} fontWeight={600} textAnchor="middle">{p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}</text>
        </g>
      ))}

      {/* footer: legend + wordmark */}
      {cats.map((c, i) => (
        <g key={c} transform={`translate(${64 + i * 196}, ${footerY + 36})`}>
          <circle cx={8} cy={-6} r={8} fill={CAT_META[c].color} />
          <text x={26} y={0} fill={BODY} fontSize={19} fontWeight={600}>{CAT_META[c].short}</text>
        </g>
      ))}
      <text x={W - 64} y={footerY + 14} fill={CREAM} fontSize={26} fontWeight={700} letterSpacing={-0.8} textAnchor="end">Radius</text>
      <text x={W - 64} y={footerY + 40} fill={DIM} fontSize={17} fontWeight={500} textAnchor="end">radiusdiscgolf.com</text>
    </svg>
  );
}

/* ----------------------------- Compact preview SVG ----------------------------- */
function PreviewChart({ pts }: { pts: Pt[] }) {
  const r = ranges(pts);
  const PW = 360, PH = 232;
  const gx = 30, gy = 22, gw = PW - gx - 14, gh = PH - gy - 22;
  const { placed } = layout(pts, r, gx, gy, gw, gh);
  const xTicks: number[] = [];
  for (let v = r.xHi; v >= r.xLo; v--) xTicks.push(v);
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  return (
    <svg viewBox={`0 0 ${PW} ${PH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {xTicks.map((v) => (
        <line key={v} x1={tx(v)} y1={gy} x2={tx(v)} y2={gy + gh} stroke={v === 0 ? GRID_STRONG : GRID} strokeWidth={1} strokeDasharray={v === 0 ? "4 4" : undefined} />
      ))}
      <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke={GRID} strokeWidth={1} />
      <text x={gx} y={14} fill={DIM} fontSize={9} fontWeight={700} letterSpacing={1}>OVER</text>
      <text x={gx + gw} y={14} fill={DIM} fontSize={9} fontWeight={700} letterSpacing={1} textAnchor="end">UNDER</text>
      {placed.map(({ p, x, y }, i) => (
        <circle key={i} cx={x} cy={y} r={5} fill={p.color} stroke={BG} strokeWidth={1.5} />
      ))}
    </svg>
  );
}

/* ----------------------------- PNG export ----------------------------- */
function downloadPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(W));
  clone.setAttribute("height", String(H));
  const xml = new XMLSerializer().serializeToString(clone);
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

  if (pts.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`group flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 text-left transition-colors hover:border-[var(--gold)]/40 ${className}`}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Stability Map</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gold)] opacity-80 transition-opacity group-hover:opacity-100">
            View &amp; share
            <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </span>
        </div>
        <p className="mb-3 text-sm text-[var(--text-body)]">Speed × Turn+Fade — spot your gaps.</p>
        <div className="min-h-0 flex-1">
          <PreviewChart pts={pts} />
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-[var(--bg-deep)] ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-[var(--cream)] backdrop-blur transition-colors hover:bg-black/70">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <BrandedChart pts={pts} discCount={discs.length} svgRef={svgRef} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] bg-[var(--bg-deep)] p-4">
              <p className="text-xs text-[var(--text-body)]">Shareable image with Radius branding.</p>
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
    </>
  );
}
