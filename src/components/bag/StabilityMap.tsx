"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CAT_META, type Cat, type FlightDisc } from "@/lib/bag";

// Brand hex (literal, not CSS vars — the PNG export rasterizes the SVG and can't resolve vars).
const BG = "#131e18";
const CREAM = "#F5EDE1";
const GOLD = "#F6C165";
const GRID = "rgba(245,237,225,0.09)";
const GRID_STRONG = "rgba(245,237,225,0.22)";
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
/** Axis bounds with a padding cell on every side so no disc ever sits on the grid border. */
function ranges(pts: Pt[]): Ranges {
  const stabs = pts.map((p) => p.stab);
  const sps = pts.map((p) => p.speed);
  const xHi = Math.max(2, Math.ceil(Math.max(...stabs)) + 1);   // left = most overstable
  const xLo = Math.min(-1, Math.floor(Math.min(...stabs)) - 1); // right = most understable
  const yHi = Math.min(16, Math.ceil(Math.max(...sps)) + 1);    // top = fastest
  const yLo = Math.max(0, Math.floor(Math.min(...sps)) - 1);    // bottom (room for labels)
  return { xHi, xLo, yHi, yLo };
}

interface Placed { p: Pt; x: number; y: number; gi: number; gn: number; }
/** Place points; spread any sharing an integer cell so dots + labels don't collide. */
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

/* ----------------------------- Branded export SVG (DiscRPM-style) ----------------------------- */
const W = 1080, H = 1350;

function BrandedChart({ pts, discCount, svgRef, style }: { pts: Pt[]; discCount: number; svgRef: React.Ref<SVGSVGElement>; style?: React.CSSProperties }) {
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
  const FONT = "'Sora', system-ui, -apple-system, sans-serif";

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", fontFamily: FONT, ...style }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rad-glow" cx="84%" cy="6%" r="62%">
          <stop offset="0%" stopColor="rgba(246,193,101,0.15)" />
          <stop offset="70%" stopColor="rgba(246,193,101,0)" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={BG} />
      <rect x={0} y={0} width={W} height={H} fill="url(#rad-glow)" />

      {/* header */}
      <text x={60} y={68} fill={GOLD} fontSize={20} fontWeight={700} letterSpacing={4}>RADIUS · MY BAG</text>
      <text x={60} y={120} fill={CREAM} fontSize={54} fontWeight={800} letterSpacing={-1.6}>Bag Stability Map</text>
      <text x={W - 60} y={90} fill={CREAM} fontSize={34} fontWeight={800} textAnchor="end">{discCount}</text>
      <text x={W - 60} y={118} fill={DIM} fontSize={18} fontWeight={600} letterSpacing={2} textAnchor="end">DISCS</text>

      {/* axis titles */}
      <text x={(gx + gridRight) / 2} y={172} fill={BODY} fontSize={25} fontWeight={700} textAnchor="middle">Stability (Turn + Fade)</text>
      <text x={gx} y={204} fill={DIM} fontSize={17} fontWeight={700} letterSpacing={1.5}>OVERSTABLE</text>
      <text x={gridRight} y={204} fill={DIM} fontSize={17} fontWeight={700} letterSpacing={1.5} textAnchor="end">UNDERSTABLE</text>
      <text x={40} y={gy + gh / 2} fill={BODY} fontSize={22} fontWeight={700} textAnchor="middle" transform={`rotate(-90 40 ${gy + gh / 2})`}>Speed</text>

      {/* full grid */}
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

      {/* discs */}
      {placed.map(({ p, x, y, gi, gn }, i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={14} fill={p.color} stroke={BG} strokeWidth={3} />
          <text x={x} y={y + 33 + (gn > 1 ? (gi % 2) * 22 : 0)} fill={CREAM} fontSize={18} fontWeight={600} textAnchor="middle">{p.name.length > 13 ? p.name.slice(0, 12) + "…" : p.name}</text>
        </g>
      ))}

      {/* footer: legend + wordmark */}
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

/* ----------------------------- Compact preview (fills its box exactly) ----------------------------- */
function PreviewChart({ pts }: { pts: Pt[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
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
  const gx = 26, gyTop = 16, gw = Math.max(0, w - gx - 12), gh = Math.max(0, h - gyTop - 14);
  const placed = w > 0 ? plot(pts, r, gx, gyTop, gw, gh, 18) : [];
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  const ty = (v: number) => gyTop + ((r.yHi - v) / (r.yHi - r.yLo)) * gh;
  const dotR = Math.max(3.5, Math.min(6, Math.min(w, h) / 42));

  return (
    <div ref={ref} className="h-full w-full">
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
          {ticksDown(r.xHi, r.xLo).map((v) => (
            <line key={`x${v}`} x1={tx(v)} y1={gyTop} x2={tx(v)} y2={gyTop + gh} stroke={v === 0 ? "rgba(246,193,101,0.4)" : GRID} strokeWidth={1} strokeDasharray={v === 0 ? "4 5" : undefined} />
          ))}
          {ticksDown(r.yHi, r.yLo).map((v) => (
            <line key={`y${v}`} x1={gx} y1={ty(v)} x2={gx + gw} y2={ty(v)} stroke={GRID} strokeWidth={1} />
          ))}
          <rect x={gx} y={gyTop} width={gw} height={gh} fill="none" stroke={GRID_STRONG} strokeWidth={1} />
          <text x={gx + 2} y={11} fill={DIM} fontSize={9} fontWeight={700} letterSpacing={1}>OVER</text>
          <text x={gx + gw} y={11} fill={DIM} fontSize={9} fontWeight={700} letterSpacing={1} textAnchor="end">UNDER</text>
          {placed.map(({ p, x, y }, i) => (
            <circle key={i} cx={x} cy={y} r={dotR} fill={p.color} stroke={BG} strokeWidth={1.5} />
          ))}
        </svg>
      )}
    </div>
  );
}

/* ----------------------------- PNG export ----------------------------- */
function downloadPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(W));
  clone.setAttribute("height", String(H));
  clone.removeAttribute("style");
  clone.setAttribute("style", "font-family:'Sora',system-ui,sans-serif");
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pts.length === 0) return null;

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
          <PreviewChart pts={pts} />
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6" onClick={() => setOpen(false)}>
          <div
            className="relative flex w-auto max-w-[96vw] flex-col overflow-hidden rounded-3xl bg-[var(--bg-deep)] ring-1 ring-white/10"
            style={{ height: "min(94vh, 1240px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-[var(--cream)] backdrop-blur transition-colors hover:bg-black/70">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className="flex min-h-0 flex-1 items-center justify-center p-2">
              <BrandedChart pts={pts} discCount={discs.length} svgRef={svgRef} style={{ height: "100%", width: "auto", maxWidth: "100%" }} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] p-4">
              <p className="hidden text-xs text-[var(--text-body)] sm:block">Shareable image with Radius branding.</p>
              <button
                onClick={() => svgRef.current && downloadPng(svgRef.current, "radius-stability-map.png")}
                className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-opacity hover:opacity-90"
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
