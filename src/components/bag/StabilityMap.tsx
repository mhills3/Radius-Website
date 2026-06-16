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

type Pt = { name: string; speed: number; stab: number; glide?: number; turn?: number; fade?: number; cat: Cat; color: string; photoUrl?: string };

function toPoints(discs: FlightDisc[]): Pt[] {
  return discs
    .map((d) => {
      const speed = d.customSpeed ?? d.speed;
      const turn = d.customTurn ?? d.turn;
      const fade = d.customFade ?? d.fade;
      if (speed == null || turn == null || fade == null) return null;
      return { name: d.nickname || d.name, speed, stab: turn + fade, glide: d.customGlide ?? d.glide, turn, fade, cat: d.category, color: CAT_META[d.category].color, photoUrl: d.photoUrl };
    })
    .filter(Boolean) as Pt[];
}

interface Ranges { xHi: number; xLo: number; yHi: number; yLo: number; }
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
    const spread = Math.min(cellW * 0.5, maxSpread);
    grp.forEach((p, i) => {
      const off = n > 1 ? (i - (n - 1) / 2) * spread : 0;
      out.push({ p, x: sx(p.stab) + off, y: sy(p.speed), gi: i, gn: n });
    });
  }
  return out;
}

const ticksDown = (hi: number, lo: number) => { const a: number[] = []; for (let v = hi; v >= lo; v--) a.push(v); return a; };
const fmtNum = (n?: number) => (n == null ? "—" : n);
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ----------------------------- Compact preview (fills its box) ----------------------------- */
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

/* ----------------------------- Big interactive chart (fits the modal, no scroll) ----------------------------- */
function BigChart({ pts }: { pts: Pt[] }) {
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
  const cols = r.xHi - r.xLo, rows = r.yHi - r.yLo;
  const padL = 48, padT = 48, padR = 20, padB = 24;
  const availW = Math.max(0, w - padL - padR);
  const availH = Math.max(0, h - padT - padB);
  // square cells that fit BOTH dimensions → whole chart is visible without scrolling
  const cell = Math.min(availW / cols, availH / rows);
  const gw = cell * cols, gh = cell * rows;
  const gx = padL + (availW - gw) / 2;
  const gy = padT + (availH - gh) / 2;
  const placed = w > 0 && h > 0 ? plot(pts, r, gx, gy, gw, gh, cell * 0.5) : [];
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  const ty = (v: number) => gy + ((r.yHi - v) / (r.yHi - r.yLo)) * gh;
  const R = Math.min(cell * 0.34, 22);
  const ring = Math.max(2, R * 0.12);
  const nameFont = Math.max(10, Math.min(15, R * 0.78));
  const tickFont = Math.max(10, Math.min(14, cell * 0.26));
  const ht = hover != null ? placed[hover] : null;

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      {w > 0 && h > 0 && (
        <>
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: FONT }}>
            <defs>
              {placed.map((pl, i) => pl.p.photoUrl ? (
                <clipPath key={i} id={`scd${i}`}><circle cx={pl.x} cy={pl.y} r={R} /></clipPath>
              ) : null)}
            </defs>
            {ticksDown(r.xHi, r.xLo).map((v) => (
              <g key={`x${v}`}>
                <line x1={tx(v)} y1={gy} x2={tx(v)} y2={gy + gh} stroke={v === 0 ? "rgba(246,193,101,0.45)" : GRID} strokeWidth={1} strokeDasharray={v === 0 ? "6 7" : undefined} />
                <text x={tx(v)} y={gy - 14} fill={v === 0 ? GOLD : DIM} fontSize={tickFont} fontWeight={700} textAnchor="middle">{v > 0 ? `+${v}` : v}</text>
              </g>
            ))}
            {ticksDown(r.yHi, r.yLo).map((v) => (
              <g key={`y${v}`}>
                <line x1={gx} y1={ty(v)} x2={gx + gw} y2={ty(v)} stroke={GRID} strokeWidth={1} />
                <text x={gx - 14} y={ty(v) + tickFont * 0.36} fill={DIM} fontSize={tickFont} fontWeight={700} textAnchor="end">{v}</text>
              </g>
            ))}
            <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke={GRID_STRONG} strokeWidth={1.5} />
            <text x={gx} y={gy - 30} fill={DIM} fontSize={tickFont} fontWeight={700} letterSpacing={1}>OVERSTABLE</text>
            <text x={gx + gw} y={gy - 30} fill={DIM} fontSize={tickFont} fontWeight={700} letterSpacing={1} textAnchor="end">UNDERSTABLE</text>

            {placed.map(({ p, x, y, gi, gn }, i) => {
              const on = hover === i;
              const dim = hover != null && !on;
              return (
                <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))} style={{ cursor: "pointer" }} opacity={dim ? 0.45 : 1}>
                  <circle cx={x} cy={y} r={R + 8} fill="transparent" />
                  {p.photoUrl ? (
                    <>
                      <circle cx={x} cy={y} r={R} fill="#0c1410" />
                      <image href={p.photoUrl} x={x - R} y={y - R} width={2 * R} height={2 * R} clipPath={`url(#scd${i})`} preserveAspectRatio="xMidYMid slice" />
                      <circle cx={x} cy={y} r={R} fill="none" stroke={on ? GOLD : p.color} strokeWidth={on ? ring + 1.5 : ring} />
                    </>
                  ) : (
                    <circle cx={x} cy={y} r={R} fill={p.color} stroke={on ? GOLD : BG} strokeWidth={on ? 3.5 : 2.5} />
                  )}
                  <text x={x} y={y - R - 8 - (gn > 1 ? (gi % 2) * (nameFont + 2) : 0)} fill={CREAM} fontSize={nameFont} fontWeight={700} textAnchor="middle">{trunc(p.name, 13)}</text>
                </g>
              );
            })}
          </svg>
          {ht && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-black/85 px-3 py-2 backdrop-blur-sm" style={{ left: ht.x, top: ht.y + R + 8 }}>
              <div className="whitespace-nowrap text-sm font-bold text-[var(--cream)]">{ht.p.name}</div>
              <div className="mt-0.5 whitespace-nowrap font-mono text-xs text-[var(--gold)]">{fmtNum(ht.p.speed)} / {fmtNum(ht.p.glide)} / {fmtNum(ht.p.turn)} / {fmtNum(ht.p.fade)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------- Branded export SVG (portrait, photos baked in) ----------------------------- */
function BrandedChart({ pts, discCount, svgRef, photoMap }: { pts: Pt[]; discCount: number; svgRef: React.Ref<SVGSVGElement>; photoMap: Record<string, string> }) {
  const Wd = 1120;
  const r = ranges(pts);
  const cols = r.xHi - r.xLo, rows = r.yHi - r.yLo;
  const gxBase = 124, rightPad = 56;
  const availW = Wd - gxBase - rightPad;
  const cell = Math.max(70, Math.min(124, availW / cols));
  const gw = cell * cols, gh = cell * rows;
  const gx = gxBase + Math.max(0, (availW - gw) / 2);
  const gy = 256;
  const footerY = gy + gh + 78;
  const Hd = footerY + 96;
  const placed = plot(pts, r, gx, gy, gw, gh, cell * 0.52);
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  const ty = (v: number) => gy + ((r.yHi - v) / (r.yHi - r.yLo)) * gh;
  const R = Math.min(cell * 0.42, 54);
  const ring = Math.max(3, R * 0.1);
  const nameFont = Math.max(16, Math.min(24, R * 0.66));
  const cats: Cat[] = (["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"] as Cat[]).filter((c) => pts.some((p) => p.cat === c));

  return (
    <svg ref={svgRef} viewBox={`0 0 ${Wd} ${Hd}`} width={Wd} height={Hd} style={{ display: "block", fontFamily: FONT }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rad-glow" cx="84%" cy="5%" r="60%">
          <stop offset="0%" stopColor="rgba(246,193,101,0.15)" />
          <stop offset="70%" stopColor="rgba(246,193,101,0)" />
        </radialGradient>
        {placed.map((pl, i) => (pl.p.photoUrl && photoMap[pl.p.photoUrl]) ? (
          <clipPath key={i} id={`bcd${i}`}><circle cx={pl.x} cy={pl.y} r={R} /></clipPath>
        ) : null)}
      </defs>
      <rect x={0} y={0} width={Wd} height={Hd} fill={BG} />
      <rect x={0} y={0} width={Wd} height={Hd} fill="url(#rad-glow)" />
      <text x={60} y={70} fill={GOLD} fontSize={21} fontWeight={700} letterSpacing={4}>RADIUS · MY BAG</text>
      <text x={60} y={124} fill={CREAM} fontSize={56} fontWeight={800} letterSpacing={-1.6}>Bag Stability Map</text>
      <text x={Wd - 60} y={92} fill={CREAM} fontSize={36} fontWeight={800} textAnchor="end">{discCount}</text>
      <text x={Wd - 60} y={122} fill={DIM} fontSize={18} fontWeight={600} letterSpacing={2} textAnchor="end">DISCS</text>
      <text x={(gx + gx + gw) / 2} y={196} fill={BODY} fontSize={26} fontWeight={700} textAnchor="middle">Stability (Turn + Fade)</text>
      <text x={gx} y={228} fill={DIM} fontSize={18} fontWeight={700} letterSpacing={1.5}>OVERSTABLE</text>
      <text x={gx + gw} y={228} fill={DIM} fontSize={18} fontWeight={700} letterSpacing={1.5} textAnchor="end">UNDERSTABLE</text>
      <text x={42} y={gy + gh / 2} fill={BODY} fontSize={23} fontWeight={700} textAnchor="middle" transform={`rotate(-90 42 ${gy + gh / 2})`}>Speed</text>
      {ticksDown(r.xHi, r.xLo).map((v) => (
        <g key={`x${v}`}>
          <line x1={tx(v)} y1={gy} x2={tx(v)} y2={gy + gh} stroke={v === 0 ? GOLD : GRID} strokeWidth={v === 0 ? 1.5 : 1} strokeDasharray={v === 0 ? "8 9" : undefined} opacity={v === 0 ? 0.5 : 1} />
          <text x={tx(v)} y={gy - 16} fill={v === 0 ? GOLD : DIM} fontSize={20} fontWeight={700} textAnchor="middle">{v > 0 ? `+${v}` : v}</text>
        </g>
      ))}
      {ticksDown(r.yHi, r.yLo).map((v) => (
        <g key={`y${v}`}>
          <line x1={gx} y1={ty(v)} x2={gx + gw} y2={ty(v)} stroke={GRID} strokeWidth={1} />
          <text x={gx - 18} y={ty(v) + 7} fill={DIM} fontSize={20} fontWeight={700} textAnchor="end">{v}</text>
        </g>
      ))}
      <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke={GRID_STRONG} strokeWidth={1.5} />
      {placed.map(({ p, x, y, gi, gn }, i) => {
        const data = p.photoUrl ? photoMap[p.photoUrl] : undefined;
        return (
          <g key={i}>
            {data ? (
              <>
                <circle cx={x} cy={y} r={R} fill="#0c1410" />
                <image href={data} x={x - R} y={y - R} width={2 * R} height={2 * R} clipPath={`url(#bcd${i})`} preserveAspectRatio="xMidYMid slice" />
                <circle cx={x} cy={y} r={R} fill="none" stroke={p.color} strokeWidth={ring} />
              </>
            ) : (
              <circle cx={x} cy={y} r={R} fill={p.color} stroke={BG} strokeWidth={3} />
            )}
            <text x={x} y={y - R - 10 - (gn > 1 ? (gi % 2) * (nameFont + 2) : 0)} fill={CREAM} fontSize={nameFont} fontWeight={700} textAnchor="middle">{trunc(p.name, 13)}</text>
          </g>
        );
      })}
      {cats.map((c, i) => (
        <g key={c} transform={`translate(${60 + i * 196}, ${footerY + 42})`}>
          <circle cx={9} cy={-6} r={9} fill={CAT_META[c].color} />
          <text x={28} y={0} fill={BODY} fontSize={21} fontWeight={600}>{CAT_META[c].short}</text>
        </g>
      ))}
      <text x={Wd - 60} y={footerY + 20} fill={CREAM} fontSize={29} fontWeight={700} letterSpacing={-0.9} textAnchor="end">Radius</text>
      <text x={Wd - 60} y={footerY + 48} fill={DIM} fontSize={18} fontWeight={500} textAnchor="end">radiusdiscgolf.com</text>
    </svg>
  );
}

/* ----------------------------- PNG export ----------------------------- */
async function urlToDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function downloadPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.clientWidth || 1120;
  const h = vb && vb.height ? vb.height : svg.clientHeight || 1400;
  const xml = new XMLSerializer().serializeToString(svg);
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    try {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      /* tainted canvas (a disc photo without CORS) — silently skip */
    }
  };
  img.src = src;
}

/* ----------------------------- Card + modal ----------------------------- */
export default function StabilityMap({ discs, className = "" }: { discs: FlightDisc[]; className?: string }) {
  const pts = useMemo(() => toPoints(discs), [discs]);
  const [open, setOpen] = useState(false);
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pts.length === 0) return null;
  const cats: Cat[] = (["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"] as Cat[]).filter((c) => pts.some((p) => p.cat === c));

  async function handleDownload() {
    setExporting(true);
    const urls = [...new Set(pts.map((p) => p.photoUrl).filter(Boolean))] as string[];
    const entries = await Promise.all(urls.map(async (u) => [u, await urlToDataUri(u)] as const));
    const map: Record<string, string> = {};
    for (const [u, d] of entries) if (d) map[u] = d;
    setPhotoMap(map);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (svgRef.current) downloadPng(svgRef.current, "radius-stability-map.png");
      setExporting(false);
    }));
  }

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
            className="relative flex w-[min(96vw,760px)] flex-col overflow-hidden rounded-3xl bg-[var(--bg-deep)] p-4 ring-1 ring-white/10 sm:p-6"
            style={{ height: "min(94vh, 1040px)" }}
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

            <div className="min-h-0 flex-1">
              <BigChart pts={pts} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-body)]">
                {cats.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_META[c].color }} />{CAT_META[c].short}</span>
                ))}
              </div>
              <button
                onClick={handleDownload}
                disabled={exporting}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
                {exporting ? "Preparing…" : "Download PNG"}
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div aria-hidden className="pointer-events-none fixed left-[-99999px] top-0 opacity-0">
          <BrandedChart pts={pts} discCount={discs.length} svgRef={svgRef} photoMap={photoMap} />
        </div>
      )}
    </>
  );
}
