import Link from "next/link";
import Image from "next/image";

export default function JoinCTA() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image src="/course/bags.jpg" alt="Two disc golfers walking the course with bags full of discs" fill sizes="100vw" quality={90} className="-z-10 object-cover object-[60%_center]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(15,24,19,0.93)_0%,rgba(15,24,19,0.72)_45%,rgba(15,24,19,0.5)_100%)]" />

      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="max-w-xl">
          <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-[3.25rem]">
            The home of disc golf is free to join.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[rgba(245,237,225,0.88)]">
            Create your account, track your first round, and find your people —
            on iOS, Android, and the web.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/login" className="rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-bold text-[#16221b] shadow-[0_10px_30px_rgba(246,193,101,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">
              Join Free
            </Link>
            <Link href="/courses" className="rounded-full border border-white/25 bg-white/5 px-8 py-4 text-sm font-semibold text-[var(--cream)] backdrop-blur transition-all hover:border-white/60">
              Explore courses
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
