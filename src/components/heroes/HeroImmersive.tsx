import HeroSearch from "@/components/HeroSearch";

// Option A — Immersive: real motion/depth behind a centered search.
export default function HeroImmersive() {
  return (
    <section className="relative isolate overflow-hidden">
      <video
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/screens/courses.png"
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      {/* legibility wash */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(19,30,24,0.72),rgba(19,30,24,0.86))]" />

      <div className="mx-auto max-w-3xl px-6 pb-20 pt-24 text-center md:pb-24 md:pt-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--cream)] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
          The home of disc golf
        </div>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--cream)] md:text-[3.5rem]">
          Find your next round.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[rgba(245,237,225,0.82)]">
          Search every course, track your game, and carry it on any device.
        </p>
        <div className="mt-9">
          <HeroSearch />
        </div>
      </div>
    </section>
  );
}
