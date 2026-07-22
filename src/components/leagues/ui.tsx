"use client";

import Link from "next/link";

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

export function Segmented({ options, value, onChange, tall, icons }: { options: string[]; value: string; onChange: (v: string) => void; tall?: boolean; icons?: Record<string, React.ComponentType<{ className?: string }>> }) {
  return (
    <div className={`flex w-fit rounded-full bg-[var(--card)] ring-1 ring-[var(--hair)] ${tall ? "h-11 p-[3px]" : "p-1"}`}>
      {options.map((o) => {
        const Ic = icons?.[o];
        return (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition-colors ${tall ? "min-w-[96px] px-4 text-[13px]" : "px-4 py-1.5 text-xs"} ${value === o ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--cream-60)] hover:text-[var(--cream)]"}`}
        >{Ic && <Ic className="h-3.5 w-3.5 shrink-0" />}{o}</button>
        );
      })}
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
export const IconSparkles = ({ className }: IconProps) => <I className={className} d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />;
export const IconMoon = ({ className }: IconProps) => <I className={className} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />;
export const IconHeart = ({ className }: IconProps) => <I className={className} d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />;
export const IconTag = ({ className }: IconProps) => <I className={className} d="M20.6 13.4L12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />;
export const IconVenus = ({ className }: IconProps) => <I className={className} d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 15v7M9 19h6" />;
export const IconClock = ({ className }: IconProps) => <I className={className} d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3.5 2" />;
export const IconUser = ({ className }: IconProps) => <I className={className} d="M20 21a8 8 0 0 0-16 0M12 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z" />;
export const IconLiveDot = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" className={className} aria-hidden><circle cx="12" cy="12" r="5.5" fill="currentColor" /></svg>;
export const IconShare = ({ className }: IconProps) => <I className={className} d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />;
export const IconSliders = ({ className }: IconProps) => <I className={className} d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />;
export const IconDollar = ({ className }: IconProps) => <I className={className} d="M12 2v20M17 5.5H9.8a3.3 3.3 0 0 0 0 6.6h4.4a3.3 3.3 0 0 1 0 6.6H6.5" />;

/** "1 player", "3 players" — the one pluralizer for every count label in the flow. */
export const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : (many ?? one + "s")}`;
export const pluralWord = (n: number, one: string, many?: string) => (n === 1 ? one : (many ?? one + "s"));

/** Back navigation pill: frosted, 36px, real arrow icon — legible over photos. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--hair-strong)] bg-[rgba(20,27,22,0.5)] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cream)] backdrop-blur-[6px] transition-colors hover:border-[var(--cream-38)]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      {label}
    </Link>
  );
}

export const btnGold =
  "rounded-[10px] bg-[var(--gold)] px-6 py-3 font-[family-name:var(--font-heading)] text-sm font-extrabold text-[#141B16] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(232,181,96,0.28)] disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-[10px] border border-[var(--hair-strong)] px-5 py-3 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--cream)] transition-colors duration-150 hover:border-[var(--cream-38)] hover:bg-[var(--card)] disabled:opacity-50";
export const card =
  "rounded-2xl border border-[var(--hair)] bg-[var(--card)] bg-gradient-to-b from-white/[0.045] to-transparent";
export const cardHover =
  "transition-all duration-[180ms] ease-out hover:-translate-y-[3px] hover:border-[var(--hair-strong)] hover:bg-[var(--card-raised)]";
