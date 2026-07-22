"use client";

// Shared presentation primitives for the Leagues surfaces — one visual system,
// tuned to the Radius dark identity (forest ground, Sora display, gold accent).

export const inputCls =
  "w-full rounded-xl border border-[var(--hair)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--cream-38)] outline-none transition-colors focus:border-[var(--gold)]";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--cream-38)]">{children}</span>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <h2 className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cream-38)]">{children}</h2>
      <div className="h-px flex-1 bg-[var(--hair)]" />
      {right}
    </div>
  );
}

export function Segmented({ options, value, onChange, tall }: { options: string[]; value: string; onChange: (v: string) => void; tall?: boolean }) {
  return (
    <div className={`flex w-fit rounded-full bg-[var(--card)] ring-1 ring-[var(--hair)] ${tall ? "h-11 p-[3px]" : "p-1"}`}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full font-bold transition-colors ${tall ? "min-w-[96px] px-4 text-[13px]" : "px-4 py-1.5 text-xs"} ${value === o ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--cream-60)] hover:text-[var(--cream)]"}`}
        >{o}</button>
      ))}
    </div>
  );
}

export function Avatar({ url, name, size = 36, ring = true, gold = false }: { url?: string; name: string; size?: number; ring?: boolean; gold?: boolean }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold ${gold ? "bg-[var(--gold)] text-[#1A2821]" : "bg-[var(--accent-green)] text-[var(--cream)]"} ${ring ? "ring-2 ring-[var(--hair)]" : ""}`}
      style={{ width: size, height: size }}
    >
      {(name || "?").charAt(0).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />}
    </span>
  );
}

/** Position: neutral mono numerals. Gold is reserved for the signed-in user's own row. */
export function Pos({ n, you }: { n?: number; you?: boolean }) {
  return (
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] font-mono text-sm font-bold ${
        you ? "bg-[var(--gold)] text-[#141B16]" : n != null && n <= 3 ? "bg-[var(--card-raised)] text-[var(--cream)]" : "text-[var(--cream-38)]"
      }`}
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

/** "1 player", "3 players" — the one pluralizer for every count label in the flow. */
export const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : (many ?? one + "s")}`;
export const pluralWord = (n: number, one: string, many?: string) => (n === 1 ? one : (many ?? one + "s"));

export const btnGold =
  "rounded-[10px] bg-[var(--gold)] px-6 py-3 font-[family-name:var(--font-heading)] text-sm font-extrabold text-[#141B16] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(232,181,96,0.28)] disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-[10px] border border-[var(--hair-strong)] px-5 py-3 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--cream)] transition-colors duration-150 hover:border-[var(--cream-38)] hover:bg-[var(--card)] disabled:opacity-50";
export const card =
  "rounded-2xl border border-[var(--hair)] bg-[var(--card)] bg-gradient-to-b from-white/[0.045] to-transparent";
export const cardHover =
  "transition-all duration-[180ms] ease-out hover:-translate-y-[3px] hover:border-[var(--hair-strong)] hover:bg-[var(--card-raised)]";
