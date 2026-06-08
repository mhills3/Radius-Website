import Link from "next/link";
import Image from "next/image";
import StoreBadges from "@/components/StoreBadges";

export default function Hero() {
  return (
    <section className="relative isolate flex min-h-[88vh] items-center overflow-hidden">
      {/* full-bleed photo — Radius shoot, on the course */}
      <Image
        src="/course/hero-throw.jpg"
        alt="A disc golfer mid-throw on a wooded course"
        fill
        sizes="100vw"
        quality={90}
        className="-z-10 object-cover object-center"
        preload
      />
      {/* legibility wash — darker at left where the text sits */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(15,24,19,0.86)_0%,rgba(15,24,19,0.55)_42%,rgba(15,24,19,0.12)_72%,transparent_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(to_top,rgba(15,24,19,0.6),transparent)]" />

      <div className="mx-auto w-full max-w-7xl px-6 pt-28 pb-20">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--cream)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            The home of disc golf
          </div>

          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold leading-[1.02] tracking-[-0.03em] text-white md:text-[4.5rem]">
            Find your people.
            <br />
            Master your game.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[rgba(245,237,225,0.88)]">
            Track every round, sharpen every shot, and connect with the disc
            golf community — your whole game, in one place, on every device.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-bold text-[#16221b] shadow-[0_10px_30px_rgba(246,193,101,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]"
            >
              Join Free
            </Link>
            <Link
              href="/courses"
              className="rounded-full border border-white/25 bg-white/5 px-8 py-4 text-sm font-semibold text-[var(--cream)] backdrop-blur transition-all hover:border-white/60"
            >
              Explore courses
            </Link>
          </div>

          <div className="mt-7">
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[rgba(245,237,225,0.6)]">Get the free app</div>
            <StoreBadges variant="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}
