import Link from "next/link";

/**
 * Wraps Pro-only content. For Pro users it renders children untouched; for everyone else it shows a
 * blurred teaser of the content with a centered "Unlock with Pro" overlay linking to /subscription.
 * Presentational only (no hooks) — pass `pro` from usePro() so it works in any context.
 *
 * Reminder: web Firestore reads are public, so this is a UX paywall, not a security boundary.
 */
export default function ProGate({
  pro,
  title = "A Pro feature",
  blurb = "Unlock with Radius Pro — free for 7 days.",
  className = "",
  children,
}: {
  pro: boolean;
  title?: string;
  blurb?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (pro) return <>{children}</>;
  return (
    <div className={`relative overflow-hidden rounded-3xl ${className}`}>
      <div aria-hidden className="pointer-events-none select-none blur-[7px] saturate-[0.85] opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-[var(--bg-deep)]/55 p-6 text-center backdrop-blur-[1px]">
        <div className="max-w-xs">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          </span>
          <div className="mt-3 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{title}</div>
          <p className="mt-1 text-sm text-[var(--text-body)]">{blurb}</p>
          <Link href="/subscription" className="mt-4 inline-block rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
            Unlock with Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
