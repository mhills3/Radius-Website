import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex flex-col items-center justify-center px-6 py-32 text-center">
      {/* glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.12),transparent_65%)]" />

      <div className="relative z-10 max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(246,193,101,0.2)] bg-[rgba(246,193,101,0.08)] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--gold)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
          Course Directory
        </div>

        <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
          Every course.
          <br />
          <span className="bg-gradient-to-br from-[#f8cf80] via-[#f6c165] to-[#d4a04a] bg-clip-text text-transparent">
            One place.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-md text-lg text-[var(--text-body)]">
          Browse disc golf courses, check hole-by-hole layouts, view
          leaderboards, and discover new places to play.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-7 py-3.5 text-sm font-bold text-[var(--bg-deep)] shadow-[0_8px_30px_rgba(246,193,101,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)] hover:shadow-[0_12px_36px_rgba(246,193,101,0.35)]"
          >
            Browse Courses
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M5 2l5 5-5 5" />
            </svg>
          </Link>
          <a
            href="https://apps.apple.com/us/app/radius-disc-golf/id6760574186"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-[var(--cream)] transition-all hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Download the App
          </a>
        </div>
      </div>
    </div>
  );
}
