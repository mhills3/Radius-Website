/**
 * A premium "locked value" — a subtle inline field (faint fill + hairline ring) with a small gold lock
 * over it, so it reads as hidden content behind Pro rather than a censor bar. The hidden text is kept
 * (transparent, non-selectable) so the field takes the value's real width and layout never shifts.
 * Sizes to the surrounding font, so it works inline in a headline or as a large standalone stat.
 */
export default function LockedStat({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex select-none items-center" style={{ verticalAlign: "-0.1em", marginInline: "0.14em" }}>
      <span aria-hidden className="min-w-[3.2em] rounded-[0.24em] bg-white/[0.045] px-[0.35em] text-transparent ring-1 ring-inset ring-white/[0.09]">{children}</span>
      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[0.18em] text-[var(--gold)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ height: "0.5em", width: "auto", opacity: 0.78 }}>
          <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <span className="font-[family-name:var(--font-heading)] font-black leading-none tracking-[0.1em]" style={{ fontSize: "0.4em", opacity: 0.85 }}>PRO</span>
      </span>
    </span>
  );
}
