import Image from "next/image";

export const metadata = {
  title: "Learn",
  description: "Short walkthroughs that show you how each part of Radius works.",
};

const TUTORIALS = [
  { title: "How to Use the Home Tab", body: "Your dashboard for recent rounds, stats, and quick actions.", img: "/screens/home.png" },
  { title: "How to Use the Discover Tab", body: "Find courses, players, and the community around you.", img: "/screens/discover.png" },
  { title: "How to Track a Round with Live Play", body: "Score, log shots, and capture data as you play.", img: "/screens/holemap.png" },
  { title: "How to Use Game Modes", body: "Run different formats with friends — solo, doubles, and more.", img: "/screens/gamemodes.png" },
  { title: "How to Use the My Game Tab", body: "Target your weak spots with drills and tailored practice.", img: "/screens/mygame.png" },
  { title: "How to Build a Course", body: "Map a course hole-by-hole and share it with the community.", img: "/screens/courses.png" },
];

export default function LearnPage() {
  return (
    <div className="bg-[#faf8f3] text-[#16221b]">
      {/* hero */}
      <section className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.14),transparent_62%)]" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-28 text-center md:pt-32">
          <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Learn Radius</div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.04] tracking-[-0.03em] md:text-[3.25rem]">
            Getting started with Radius.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-body)]">
            Short walkthroughs that show you how each part of Radius works — so you can spend less
            time figuring it out and more time playing.
          </p>
        </div>
      </section>

      {/* tutorials grid */}
      <section className="bg-[#faf8f3]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TUTORIALS.map((t) => (
              <div key={t.title} className="group overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_-18px_rgba(0,0,0,0.35)]">
                <div className="relative h-56 overflow-hidden bg-[var(--bg-mid)]">
                  <Image src={t.img} alt={t.title} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw" className="object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold)] text-[#16221b] shadow-lg">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-6 w-6"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">{t.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#46554c]">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
