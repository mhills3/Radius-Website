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

export const btnGold =
  "rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[#16221b] transition-all hover:bg-[var(--gold-bright)] hover:shadow-[0_8px_24px_rgba(246,193,101,0.25)] disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-full border border-white/12 px-5 py-3 text-sm font-bold text-[var(--cream)] transition-colors hover:border-white/25 hover:bg-white/[0.05] disabled:opacity-50";
export const card =
  "rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.045] to-white/[0.02]";
