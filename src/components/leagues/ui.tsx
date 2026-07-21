"use client";

// Shared presentation primitives for the Leagues surfaces — one visual system,
// tuned to the Radius dark identity (forest ground, Sora display, gold accent).

export const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none transition-colors focus:border-[var(--gold)]";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage)]">{children}</span>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <h2 className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{children}</h2>
      <div className="h-px flex-1 bg-white/[0.07]" />
      {right}
    </div>
  );
}

export function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex w-fit rounded-full bg-white/[0.05] p-1 ring-1 ring-white/[0.06]">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${value === o ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}
        >{o}</button>
      ))}
    </div>
  );
}

export function Avatar({ url, name, size = 36, ring = true }: { url?: string; name: string; size?: number; ring?: boolean }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#243128] text-xs font-bold text-[var(--cream)] ${ring ? "ring-2 ring-white/10" : ""}`}
      style={{ width: size, height: size }}
    >
      {(name || "?").charAt(0).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />}
    </span>
  );
}

/** Position medal: 1-2-3 get metal tints, the rest quiet mono. */
export function Pos({ n }: { n?: number }) {
  const metal = n === 1 ? "#F6C165" : n === 2 ? "#C7CFD6" : n === 3 ? "#C99B6E" : undefined;
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg font-[family-name:var(--font-heading)] text-sm font-extrabold"
      style={metal ? { color: "#16221b", background: metal } : { color: "var(--sage-dim)" }}
    >{n ?? "–"}</span>
  );
}

// ── Line icons (1.75 stroke, 24 grid) — never emoji.
const ic = "h-5 w-5";
type IconProps = { className?: string };
const I = ({ d, className, extra }: { d: string; className?: string; extra?: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className ?? ic}>
    <path d={d} />{extra}
  </svg>
);
export const IconCalendar = ({ className }: IconProps) => <I className={className} d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />;
export const IconRepeat = ({ className }: IconProps) => <I className={className} d="M17 2l4 4-4 4M21 6H8a5 5 0 0 0-5 5M7 22l-4-4 4-4M3 18h13a5 5 0 0 0 5-5" />;
export const IconTrophy = ({ className }: IconProps) => <I className={className} d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 5H4a1 1 0 0 0-1 1c0 2.5 1.5 4 4 4M17 5h3a1 1 0 0 1 1 1c0 2.5-1.5 4-4 4" />;
export const IconTarget = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className ?? ic}>
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);
export const IconLeaf = ({ className }: IconProps) => <I className={className} d="M4 20c0-9 5-15 16-16-1 11-7 16-16 16zM4 20c4-6 8-9 12-11" />;
export const IconUsers = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={className ?? ic}>
    <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.7-3.5 3.3-5.5 6.5-5.5s5.8 2 6.5 5.5" /><path d="M16 5a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2.2.6 3.6 2.3 4 5.2" />
  </svg>
);
export const IconEye = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className ?? ic}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconEyeOff = ({ className }: IconProps) => <I className={className} d="M3 3l18 18M10.5 5.2A10 10 0 0 1 22 12s-1.2 2.4-3.6 4.4M6.2 6.7C3.6 8.6 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />;
export const IconPin = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={className ?? ic}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
export const IconPlus = ({ className }: IconProps) => <I className={className} d="M12 5v14M5 12h14" />;
export const IconDisc = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className ?? ic}>
    <ellipse cx="12" cy="12" rx="9" ry="5.5" /><ellipse cx="12" cy="12" rx="4.5" ry="2.5" />
  </svg>
);
export const IconDollar = ({ className }: IconProps) => <I className={className} d="M12 2v20M17 5.5H9.8a3.3 3.3 0 0 0 0 6.6h4.4a3.3 3.3 0 0 1 0 6.6H6.5" />;

export const btnGold =
  "rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[#16221b] transition-all hover:bg-[var(--gold-bright)] hover:shadow-[0_8px_24px_rgba(246,193,101,0.25)] disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-full border border-white/12 px-5 py-3 text-sm font-bold text-[var(--cream)] transition-colors hover:border-white/25 hover:bg-white/[0.05] disabled:opacity-50";
export const card =
  "rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.045] to-white/[0.02]";
