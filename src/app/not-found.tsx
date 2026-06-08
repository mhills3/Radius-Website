import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <section className="relative flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
      <svg className="pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-40" viewBox="0 0 760 760" fill="none" aria-hidden="true">
        {[110, 200, 290, 380].map((r) => (
          <circle key={r} cx="380" cy="380" r={r} stroke="rgba(246,193,101,0.10)" strokeWidth="1" />
        ))}
      </svg>
      <div className="relative z-10 mx-auto max-w-md px-6 text-center">
        <div className="font-[family-name:var(--font-heading)] text-7xl font-extrabold tracking-[-0.03em] text-[var(--gold)] md:text-8xl">
          404
        </div>
        <h1 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em]">
          Out of bounds.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[var(--text-body)]">
          This page sailed past the fairway. Let&apos;s get you back in play.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="rounded-full bg-[var(--gold)] px-7 py-3.5 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]"
          >
            Back home
          </Link>
          <Link
            href="/courses"
            className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-[var(--cream)] transition-colors hover:border-white/50"
          >
            Browse courses
          </Link>
        </div>
      </div>
    </section>
  );
}
