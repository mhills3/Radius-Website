import Image from "next/image";
import Link from "next/link";

type Tile = { img: string; eyebrow: string; title: string; body?: string; className: string; objY?: string };

// Explicit placement so the tiles interlock with no gaps: 6-col × 3-row grid on lg.
// Row 1-2: [Game IQ tall] [Bag] [Caddy tall]   Row 2: [Game IQ] [Community] [Caddy]   Row 3: [Courses banner]
const TILES: Tile[] = [
  { img: "/course/gameiq-throw.jpg", eyebrow: "Radius Rating", title: "Know exactly how good you are", body: "One honest number. 30 ranks. Rookie all the way to Champion.", className: "col-span-2 row-span-2 lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2", objY: "object-center" },
  { img: "/course/bag-walk.jpg", eyebrow: "Your Bag", title: "Every disc, scored & organized", className: "col-span-1 lg:col-start-3 lg:col-span-2 lg:row-start-1 lg:row-span-1", objY: "object-center" },
  { img: "/course/group.jpg", eyebrow: "Community", title: "Find your people", className: "col-span-1 lg:col-start-3 lg:col-span-2 lg:row-start-2 lg:row-span-1", objY: "object-[center_22%]" },
  { img: "/course/caddy-duo.jpg", eyebrow: "Your Caddy", title: "A smart play on every hole", className: "col-span-2 row-span-2 lg:col-start-5 lg:col-span-2 lg:row-start-1 lg:row-span-2", objY: "object-center" },
  { img: "/course/basket.jpg", eyebrow: "Courses", title: "Know every hole before you tee off", className: "col-span-2 lg:col-start-1 lg:col-span-6 lg:row-start-3 lg:row-span-1", objY: "object-center" },
];

export default function Ecosystem() {
  return (
    <section id="features" className="relative overflow-hidden bg-[var(--bg-deep)]">
      <svg className="pointer-events-none absolute left-1/2 top-0 h-[640px] w-[640px] -translate-x-1/2 opacity-40" viewBox="0 0 640 640" fill="none" aria-hidden="true">
        {[120, 210, 300].map((r) => (
          <circle key={r} cx="320" cy="320" r={r} stroke="rgba(246,193,101,0.10)" strokeWidth="1" />
        ))}
      </svg>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">One connected platform</div>
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-[var(--cream)] md:text-[2.75rem]">
            Everything disc golf, working together.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--text-body)]">
            Not a scorecard bolted to a course list. A single system where your game, your bag, your courses, and your community all talk to each other.
          </p>
        </div>

        {/* bento */}
        <div className="mt-14 grid auto-rows-[170px] grid-cols-2 gap-4 sm:auto-rows-[190px] lg:grid-cols-6 lg:auto-rows-[220px]">
          {TILES.map((t) => (
            <Link key={t.title} href="/features" className={`group relative overflow-hidden rounded-3xl border border-white/8 bg-[var(--bg-mid)] ring-1 ring-inset ring-white/5 transition-all hover:ring-[var(--gold)]/30 ${t.className}`}>
              <Image src={t.img} alt={t.title} fill sizes="(max-width:1024px) 50vw, 40vw" className={`object-cover ${t.objY} transition-transform duration-700 group-hover:scale-[1.05]`} />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(13,20,15,0.96),rgba(13,20,15,0.5)_50%,rgba(13,20,15,0.18))]" />
              <div className="relative flex h-full flex-col justify-end p-6">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{t.eyebrow}</div>
                <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold leading-tight tracking-tight text-white">{t.title}</h3>
                {t.body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-[rgba(245,237,225,0.78)]">{t.body}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
