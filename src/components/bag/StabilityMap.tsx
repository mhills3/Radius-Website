"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Cat, type FlightDisc } from "@/lib/bag";

// Brand hex (literal, not CSS vars — the PNG export rasterizes the SVG and can't resolve vars).
const BG = "#131e18";
const CREAM = "#F5EDE1";
const GOLD = "#F6C165";
const GRID = "rgba(245,237,225,0.07)";
const GRID_STRONG = "rgba(245,237,225,0.18)";
const DIM = "rgba(168,179,145,0.62)";
const BODY = "rgba(245,237,225,0.74)";
const FONT = "'Sora', system-ui, -apple-system, sans-serif";

// Radius round "R" mark (from public/logo-lettermark.svg) — inlined so it bakes into the PNG.
const MARK = "M20.44,0C9.15,0,0,9.15,0,20.44s9.15,20.44,20.44,20.44,20.44-9.15,20.44-20.44S31.72,0,20.44,0ZM16.18,31.04h-4.26c-.06,0-.1-.05-.09-.11l.94-5.78.63-3.72c.02-.1.16-.11.19,0,.57,2.09,1.65,4,3.26,5.62.02.02.03.05.03.08l-.68,3.92h-.02ZM13.48,16.41c1.38,7.26,7.2,12.53,13.91,14.63-7.24-.03-14.33-7.1-13.91-14.63ZM31.25,27.61c-.64,1.16-1.41,2.67-2.7,2.91-6.36-1.31-12.96-7.4-14.21-14.06-.02-.16-.06-.4.13-.42,1-.01,3.58-.04,4.79-.02.1.02.14.1.14.2-2.05,5.65,5.87.6,6.28-2.98.02-.18-.14-.66-.26-.79-3.09-3.34-13.91,2.22-19.18,4.42l.83-1.15c13.52-15.52,37.55-3.48,14.44,5.5-.13.08-.28.2-.28.35,2.15,2.98,5.79,5.5,9.48,5.68.27.01.71-.03.53.37h.01Z";

type Pt = { name: string; speed: number; stab: number; glide?: number; turn?: number; fade?: number; cat: Cat; color: string };

function toPoints(discs: FlightDisc[]): Pt[] {
  return discs
    .map((d) => {
      const speed = d.customSpeed ?? d.speed;
      const turn = d.customTurn ?? d.turn;
      const fade = d.customFade ?? d.fade;
      if (speed == null || turn == null || fade == null) return null;
      // d.color is the plastic color used by the in-bag DiscGraphic — match it exactly.
      return { name: d.nickname || d.name, speed, stab: turn + fade, glide: d.customGlide ?? d.glide, turn, fade, cat: d.category, color: d.color };
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
const cidOf = (color: string) => color.replace(/[^a-z0-9]/gi, "");

/** Shared gradient defs (namespaced so two charts can co-exist in the DOM). */
function Defs({ ns, colors }: { ns: string; colors: string[] }) {
  return (
    <defs>
      <linearGradient id={`${ns}-bg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#17271e" />
        <stop offset="100%" stopColor="#0d1611" />
      </linearGradient>
      <radialGradient id={`${ns}-gold`} cx="86%" cy="2%" r="60%">
        <stop offset="0%" stopColor="rgba(246,193,101,0.16)" />
        <stop offset="70%" stopColor="rgba(246,193,101,0)" />
      </radialGradient>
      <linearGradient id={`${ns}-region`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(217,71,63,0.07)" />
        <stop offset="50%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(77,148,250,0.07)" />
      </linearGradient>
      <linearGradient id={`${ns}-rule`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(246,193,101,0)" />
        <stop offset="50%" stopColor="rgba(246,193,101,0.45)" />
        <stop offset="100%" stopColor="rgba(246,193,101,0)" />
      </linearGradient>
      {colors.map((col) => {
        const cid = cidOf(col);
        return (
          <g key={cid}>
            {/* rim sheen — identical recipe to the in-bag DiscGraphic */}
            <radialGradient id={`${ns}-rim-${cid}`} cx="36%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="40%" stopColor={col} stopOpacity="1" />
              <stop offset="100%" stopColor={col} stopOpacity="0.92" />
            </radialGradient>
            <radialGradient id={`${ns}-glow-${cid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={col} stopOpacity="0.42" />
              <stop offset="58%" stopColor={col} stopOpacity="0.1" />
              <stop offset="100%" stopColor={col} stopOpacity="0" />
            </radialGradient>
          </g>
        );
      })}
    </defs>
  );
}

/** A disc marker that mirrors the in-bag DiscGraphic (rim sheen + recessed flight plate + inner
 * ring) — minus the speed number, since the chart's Y-axis already encodes speed. */
function DiscMark({ ns, x, y, R, p, on, nameFont, gi, gn }: {
  ns: string; x: number; y: number; R: number; p: Pt; on: boolean; nameFont: number; gi: number; gn: number;
}) {
  const cid = cidOf(p.color);
  const sw = Math.max(0.8, R * 0.026);
  return (
    <g>
      <circle cx={x} cy={y} r={R * 1.5} fill={`url(#${ns}-glow-${cid})`} />
      <circle cx={x} cy={y} r={R} fill={`url(#${ns}-rim-${cid})`} stroke="rgba(0,0,0,0.28)" strokeWidth={Math.max(1, R * 0.026)} />
      <circle cx={x} cy={y} r={R * 0.72} fill="rgba(0,0,0,0.30)" />
      <circle cx={x} cy={y} r={R * 0.72} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={sw} />
      <circle cx={x} cy={y} r={R * 0.58} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={sw} />
      {on && <circle cx={x} cy={y} r={R + R * 0.13} fill="none" stroke={GOLD} strokeWidth={Math.max(2, R * 0.1)} />}
      <text x={x} y={y - R - 7 - (gn > 1 ? (gi % 2) * (nameFont + 2) : 0)} fill={CREAM} fontSize={nameFont} fontWeight={700} textAnchor="middle" paintOrder="stroke" stroke="#0b120e" strokeWidth={Math.max(2.5, nameFont * 0.3)} strokeLinejoin="round">{trunc(p.name, 13)}</text>
    </g>
  );
}

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
          <rect x={gx} y={gyTop} width={gw} height={gh} rx={8} fill="none" stroke={GRID_STRONG} strokeWidth={1} />
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
  const padL = 48, padT = 50, padR = 20, padB = 24;
  const availW = Math.max(0, w - padL - padR);
  const availH = Math.max(0, h - padT - padB);
  const cell = Math.min(availW / cols, availH / rows);
  const gw = cell * cols, gh = cell * rows;
  const gx = padL + (availW - gw) / 2;
  const gy = padT + (availH - gh) / 2;
  const placed = w > 0 && h > 0 ? plot(pts, r, gx, gy, gw, gh, cell * 0.5) : [];
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  const ty = (v: number) => gy + ((r.yHi - v) / (r.yHi - r.yLo)) * gh;
  const R = Math.min(cell * 0.34, 22);
  const nameFont = Math.max(10, Math.min(15, R * 0.82));
  const tickFont = Math.max(10, Math.min(14, cell * 0.26));
  const colors = [...new Set(pts.map((p) => p.color))];
  const ht = hover != null ? placed[hover] : null;

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      {w > 0 && h > 0 && (
        <>
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: FONT }}>
            <Defs ns="s" colors={colors} />
            <rect x={gx} y={gy} width={gw} height={gh} rx={14} fill="rgba(255,255,255,0.018)" />
            <rect x={gx} y={gy} width={gw} height={gh} rx={14} fill="url(#s-region)" />
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
            <rect x={gx} y={gy} width={gw} height={gh} rx={14} fill="none" stroke={GRID_STRONG} strokeWidth={1.4} />
            <text x={gx + 2} y={gy - 30} fill={DIM} fontSize={tickFont} fontWeight={700} letterSpacing={1.2}>OVERSTABLE</text>
            <text x={gx + gw - 2} y={gy - 30} fill={DIM} fontSize={tickFont} fontWeight={700} letterSpacing={1.2} textAnchor="end">UNDERSTABLE</text>

            {placed.map((pl, i) => (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))} style={{ cursor: "pointer" }} opacity={hover != null && hover !== i ? 0.4 : 1}>
                <circle cx={pl.x} cy={pl.y} r={R + 8} fill="transparent" />
                <DiscMark ns="s" x={pl.x} y={pl.y} R={R} p={pl.p} on={hover === i} nameFont={nameFont} gi={pl.gi} gn={pl.gn} />
              </g>
            ))}
          </svg>
          {ht && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-black/85 px-3 py-2 shadow-xl backdrop-blur-sm" style={{ left: ht.x, top: ht.y + R + 8 }}>
              <div className="whitespace-nowrap text-sm font-bold text-[var(--cream)]">{ht.p.name}</div>
              <div className="mt-0.5 whitespace-nowrap font-mono text-xs text-[var(--gold)]">{fmtNum(ht.p.speed)} / {fmtNum(ht.p.glide)} / {fmtNum(ht.p.turn)} / {fmtNum(ht.p.fade)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------- Branded export SVG (premium poster) ----------------------------- */
function BrandedChart({ pts, discCount, svgRef }: { pts: Pt[]; discCount: number; svgRef: React.Ref<SVGSVGElement> }) {
  const Wd = 1120;
  const r = ranges(pts);
  const cols = r.xHi - r.xLo, rows = r.yHi - r.yLo;
  const gxBase = 128, rightPad = 60;
  const availW = Wd - gxBase - rightPad;
  const cell = Math.max(66, Math.min(118, availW / cols));
  const gw = cell * cols, gh = cell * rows;
  const gx = gxBase + Math.max(0, (availW - gw) / 2);
  const gy = 268;
  const footerY = gy + gh + 84;
  const Hd = footerY + 84;
  const placed = plot(pts, r, gx, gy, gw, gh, cell * 0.5);
  const tx = (v: number) => gx + ((r.xHi - v) / (r.xHi - r.xLo)) * gw;
  const ty = (v: number) => gy + ((r.yHi - v) / (r.yHi - r.yLo)) * gh;
  const R = Math.min(cell * 0.38, 46);
  const nameFont = Math.max(15, Math.min(22, R * 0.7));
  const colors = [...new Set(pts.map((p) => p.color))];
  const cx = (gx + gx + gw) / 2;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${Wd} ${Hd}`} width={Wd} height={Hd} style={{ display: "block", fontFamily: FONT }} xmlns="http://www.w3.org/2000/svg">
      <Defs ns="b" colors={colors} />
      <rect x={0} y={0} width={Wd} height={Hd} fill={`url(#b-bg)`} />
      <rect x={0} y={0} width={Wd} height={Hd} fill={`url(#b-gold)`} />

      <g transform="translate(60,40) scale(0.92)"><path d={MARK} fill={GOLD} /></g>
      <text x={108} y={71} fill={CREAM} fontSize={40} fontWeight={700} letterSpacing={-1.4}>Radius</text>
      <text x={Wd - 60} y={70} fill={GOLD} fontSize={22} fontWeight={600} letterSpacing={0.3} textAnchor="end">Play Smarter, Not Harder</text>

      <text x={60} y={156} fill={CREAM} fontSize={58} fontWeight={800} letterSpacing={-1.8}>Bag Stability Map</text>
      <text x={60} y={192} fill={BODY} fontSize={23} fontWeight={500}>Speed × Turn + Fade · {discCount} discs</text>
      <line x1={60} y1={216} x2={Wd - 60} y2={216} stroke={`url(#b-rule)`} strokeWidth={2} />

      <text x={cx} y={246} fill={BODY} fontSize={24} fontWeight={700} textAnchor="middle" letterSpacing={0.2}>Stability (Turn + Fade)</text>
      <text x={gx} y={gy - 30} fill={DIM} fontSize={18} fontWeight={700} letterSpacing={1.6}>OVERSTABLE</text>
      <text x={gx + gw} y={gy - 30} fill={DIM} fontSize={18} fontWeight={700} letterSpacing={1.6} textAnchor="end">UNDERSTABLE</text>
      <text x={44} y={gy + gh / 2} fill={BODY} fontSize={22} fontWeight={700} textAnchor="middle" transform={`rotate(-90 44 ${gy + gh / 2})`}>Speed</text>

      <rect x={gx} y={gy} width={gw} height={gh} rx={18} fill="rgba(255,255,255,0.02)" />
      <rect x={gx} y={gy} width={gw} height={gh} rx={18} fill={`url(#b-region)`} />
      {ticksDown(r.xHi, r.xLo).map((v) => (
        <g key={`x${v}`}>
          <line x1={tx(v)} y1={gy} x2={tx(v)} y2={gy + gh} stroke={v === 0 ? GOLD : GRID} strokeWidth={v === 0 ? 1.5 : 1} strokeDasharray={v === 0 ? "8 9" : undefined} opacity={v === 0 ? 0.5 : 1} />
          <text x={tx(v)} y={gy - 12} fill={v === 0 ? GOLD : DIM} fontSize={20} fontWeight={700} textAnchor="middle">{v > 0 ? `+${v}` : v}</text>
        </g>
      ))}
      {ticksDown(r.yHi, r.yLo).map((v) => (
        <g key={`y${v}`}>
          <line x1={gx} y1={ty(v)} x2={gx + gw} y2={ty(v)} stroke={GRID} strokeWidth={1} />
          <text x={gx - 16} y={ty(v) + 7} fill={DIM} fontSize={20} fontWeight={700} textAnchor="end">{v}</text>
        </g>
      ))}
      <rect x={gx} y={gy} width={gw} height={gh} rx={18} fill="none" stroke={GRID_STRONG} strokeWidth={1.5} />

      {placed.map((pl, i) => (
        <DiscMark key={i} ns="b" x={pl.x} y={pl.y} R={R} p={pl.p} on={false} nameFont={nameFont} gi={pl.gi} gn={pl.gn} />
      ))}

      <line x1={60} y1={footerY} x2={Wd - 60} y2={footerY} stroke="rgba(245,237,225,0.08)" strokeWidth={1} />
      <text x={60} y={footerY + 40} fill={DIM} fontSize={19} fontWeight={500}>Mapped in the Radius app</text>
      <text x={Wd - 60} y={footerY + 40} fill={DIM} fontSize={19} fontWeight={500} textAnchor="end">radiusdiscgolf.com</text>
    </svg>
  );
}

/* ----------------------------- PNG export ----------------------------- */
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6" onClick={() => setOpen(false)}>
          <div
            className="relative flex w-[min(96vw,760px)] flex-col overflow-hidden rounded-[28px] bg-gradient-to-b from-[#17271e] to-[#0e1712] p-4 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-[var(--gold)]/15 sm:p-6"
            style={{ height: "min(94vh, 1040px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.14),transparent_70%)]" />
            <div className="relative mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--gold)]/15"><span className="text-[11px] font-extrabold text-[var(--gold)]">R</span></span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Radius · My Bag</span>
                </div>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-[-0.02em] text-[var(--cream)]">Bag Stability Map</h2>
                <p className="mt-0.5 text-sm text-[var(--text-body)]">Speed × Turn + Fade · {discs.length} discs · hover a disc</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[var(--cream)] transition-colors hover:bg-white/15">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="relative min-h-0 flex-1">
              <BigChart pts={pts} />
            </div>

            <div className="relative mt-3 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
              <p className="text-xs text-[var(--text-body)]">Hover a disc for its flight numbers.</p>
              <button
                onClick={() => svgRef.current && downloadPng(svgRef.current, "radius-stability-map.png")}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-b from-[var(--gold-bright)] to-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] shadow-[0_6px_18px_-6px_rgba(246,193,101,0.6)] transition-opacity hover:opacity-90"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div aria-hidden className="pointer-events-none fixed left-[-99999px] top-0 opacity-0">
          <BrandedChart pts={pts} discCount={discs.length} svgRef={svgRef} />
        </div>
      )}
    </>
  );
}
