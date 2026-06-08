import Link from "next/link";
import { getCourseCountServer, getPlayerCountServer } from "@/lib/stats";
import StatValue from "./StatValue";

// Server component: counts are fetched server-side (reliable long-polling transport) and baked
// into the HTML, so the real numbers show on every device — including mobile Safari, where the
// client-side Firestore aggregation transport was silently failing and falling back to "—"/"630+".
export default async function HubStats() {
  const [courses, players] = await Promise.all([
    getCourseCountServer(),
    getPlayerCountServer(),
  ]);

  const items = [
    { value: courses || null, fallback: "630+", suffix: "", label: "Courses mapped", href: "/courses" },
    { value: 1210, fallback: "1,210", suffix: "", label: "Discs in the database", href: "/discs" },
    { value: players || null, fallback: "—", suffix: "+", label: "Disc golfers", href: "/leaderboard" },
    { value: 50, fallback: "50", suffix: "", label: "States & countries", href: "/courses" },
  ];

  return (
    <section className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.13),transparent_68%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">The home of disc golf</div>
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-4xl">One hub for your whole game</h2>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map((it) => (
            <Link key={it.label} href={it.href} className="group text-center transition-transform hover:-translate-y-1">
              <div className="font-[family-name:var(--font-heading)] text-4xl font-extrabold text-[var(--cream)] md:text-5xl">
                <StatValue value={it.value} suffix={it.suffix} fallback={it.fallback} />
              </div>
              <div className="mt-2 text-sm text-[var(--sage)] group-hover:text-[var(--cream)]">{it.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
