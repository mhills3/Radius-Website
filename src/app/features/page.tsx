import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import CourseCount from "@/components/CourseCount";

export const metadata: Metadata = {
  title: "Features — Radius",
  description: "A guided tour of Radius: Game IQ, multiple bags, putting practice, unlimited scorecards, your Caddy, courses, game modes, and community. The disc golf app that actually makes you better. Play smarter, not harder.",
  alternates: { canonical: "https://radiusdiscgolf.com/features" },
};

const APP_STORE = "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";

type Feature = { eyebrow: string; title: string; body: string; bullets: string[]; img: string };

const FEATURES: Feature[] = [
  {
    eyebrow: "My Bag · New in 2.0",
    title: "Carry as many bags as your game needs",
    body: "Build a tournament bag, a casual bag, a winter bag — and switch your active bag on the fly. See every disc's flight on one chart and spot the gaps before they cost you a stroke.",
    bullets: ["Create & manage multiple named bags", "Switch your active bag on the fly", "Flight chart, slot coverage & a smart gap report"],
    img: "/screens/bags.png",
  },
  {
    eyebrow: "Putting Practice · New in 2.0",
    title: "The practice that actually transfers",
    body: "Structured putting drills on real satellite hole maps with regulation circles — so the reps you put in show up on the course. Every make and miss feeds your stats.",
    bullets: ["Drills like Around the World, Pressure Ladder & Speed Run", "Regulation C1 / C2 rings (33 / 66 ft) on real maps", "Every putt feeds your putting stats"],
    img: "/screens/putting.png",
  },
  {
    eyebrow: "Scorecards",
    title: "Unlimited scorecards. Never gated.",
    body: "Keep score for every round, free — no caps, no paywall. Walk away with an immersive hole-by-hole breakdown that quietly makes you better over time.",
    bullets: ["Unlimited scorecards — every round, no limits", "Immersive hole-by-hole round detail", "Tap any hole for the full story"],
    img: "/screens/scorecard.png",
  },
  {
    eyebrow: "Improve",
    title: "A coaching plan, not just numbers",
    body: "Radius shows you where you stand, why, and exactly what to work on next — then proves it as your game climbs. Your weakest skill, flagged and fixed.",
    bullets: ["See exactly where you stand across every skill", "Targeted drill stacks for your weakest area", "Watch the proof as your game climbs"],
    img: "/screens/improve.png",
  },
  {
    eyebrow: "Your Caddy",
    title: "A caddy in your pocket",
    body: "On any hole, Radius reads the shot and suggests a disc and a line based on how you throw. It informs — you decide. That's playing smarter.",
    bullets: ["Disc + line suggestions tuned to your arm", "Built from your own bag and tendencies", "Always your call — never automated"],
    img: "/screens/caddy2.png",
  },
  {
    eyebrow: "Courses",
    title: "Know the course before you tee off",
    body: "Satellite hole maps, real layouts, and leaderboards for courses everywhere — so you show up with a plan instead of a guess.",
    bullets: ["Satellite maps with every hole", "Community-built layouts you can trust", "Course leaderboards and your personal bests"],
    img: "/screens/coursemap.png",
  },
  {
    eyebrow: "Play",
    title: "Make every round more fun",
    body: "Wolf, Best Ball, skins and more — built-in game modes that turn a casual round with friends into something worth talking about.",
    bullets: ["Wolf, BBB, skins & other modes", "Teams and side games tracked automatically", "Group cards with everyone's scores"],
    img: "/screens/gamemodes2.png",
  },
  {
    eyebrow: "Community",
    title: "The whole sport, in one place",
    body: "Follow players, share your rounds, find people near you, and watch the game grow — Radius is where disc golf comes together.",
    bullets: ["Follow friends and share your best rounds", "Find players and meetups near you", "A feed built for disc golfers"],
    img: "/screens/discover2.png",
  },
];

function PIcon({ children }: { children: React.ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{children}</svg>;
}

const PERSONAS = [
  { icon: <PIcon><path d="M12 21v-8" /><path d="M12 13c-3.3 0-6-2.4-6-5.5C9.3 7.5 12 9.9 12 13Z" /><path d="M12 11c0-2.8 2.4-5 5.5-5C17.5 8.8 15.1 11 12 11Z" /></PIcon>, who: "New to the game", line: "Learn what to throw and why, with simple guidance that grows as you do." },
  { icon: <PIcon><circle cx="12" cy="12" r="4" /><path d="M12 2v2.4M12 19.6V22M22 12h-2.4M4.4 12H2M19.07 4.93l-1.7 1.7M6.63 17.37l-1.7 1.7M19.07 19.07l-1.7-1.7M6.63 6.63l-1.7-1.7" /></PIcon>, who: "Weekend casual", line: "Track rounds with friends, run fun game modes, and watch yourself get better." },
  { icon: <PIcon><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></PIcon>, who: "League competitor", line: "Dial in your bag, study courses before you play, and climb the rankings." },
  { icon: <PIcon><path d="M8 21h8" /><path d="M12 17.5V21" /><path d="M7 4.5h10V9a5 5 0 0 1-10 0V4.5Z" /><path d="M7 6.5H5a2 2 0 0 0-2 2c0 1.8 1.6 3.3 4 3.5" /><path d="M17 6.5h2a2 2 0 0 1 2 2c0 1.8-1.6 3.3-4 3.5" /></PIcon>, who: "Touring pro", line: "Deep stats and a Game IQ that scales all the way to MPO to sharpen every shot." },
];

const TIERS = [
  { label: "Rec", color: "#8a968d" },
  { label: "Amateur", color: "#5fb87a" },
  { label: "Advanced", color: "#4d94fa" },
  { label: "Expert", color: "#c08bff" },
  { label: "Elite", color: "#f6c165" },
  { label: "MPO", color: "#e0584f" },
];

function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative shrink-0 rounded-[2.6rem] border border-white/12 bg-[#0d140f] p-2.5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)] ${className}`}>
      <div className="relative aspect-[1170/2532] overflow-hidden rounded-[2.05rem] bg-black">{children}</div>
      <div className="pointer-events-none absolute left-1/2 top-[14px] z-10 h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-[#0d140f]" />
    </div>
  );
}

function ScreenPhone({ src, alt, className = "", priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <PhoneFrame className={className}>
      <Image src={src} alt={alt} fill sizes="320px" quality={90} className="object-cover" priority={priority} />
    </PhoneFrame>
  );
}

function StoreButtons({ dark = false }: { dark?: boolean }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5";
  return (
    <div className="flex flex-wrap gap-3">
      <a href={APP_STORE} target="_blank" rel="noopener" className={`${base} ${dark ? "bg-[var(--cream)] text-[#16221b]" : "bg-[#16221b] text-[var(--cream)]"}`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.13ZM14.6 4.59c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45Z" /></svg>
        App Store
      </a>
      <a href={GOOGLE_PLAY} target="_blank" rel="noopener" className={`${base} bg-[var(--gold)] text-[#16221b]`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.6 2.4 13 12 3.6 21.6c-.3-.2-.5-.6-.5-1V3.4c0-.4.2-.8.5-1ZM14.2 13.2l2.6 2.6-9.7 5.5 7.1-8.1ZM17.9 9.4l2.7 1.5c.6.4.6 1.3 0 1.7l-2.8 1.6-2.8-2.8 2.9-2ZM7.1 2.4l9.7 5.5-2.6 2.6L7.1 2.4Z" /></svg>
        Google Play
      </a>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <div className="bg-[#faf8f3] text-[#16221b]">
      {/* ===================== HERO ===================== */}
      <section className="relative isolate flex min-h-[94vh] items-center overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <Image src="/course/forehand.jpg" alt="" fill sizes="100vw" quality={85} className="-z-10 object-cover object-center opacity-25" preload />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(15,24,19,0.96)_0%,rgba(15,24,19,0.82)_45%,rgba(15,24,19,0.6)_100%)]" />
        <div className="pointer-events-none absolute -left-40 top-0 -z-10 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.16),transparent_62%)]" />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-12 pt-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" /> The complete disc golf companion
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold leading-[0.98] tracking-[-0.03em] text-white md:text-[4.5rem]">
              The disc golf app that makes you <span className="bg-gradient-to-br from-[#f8cf80] to-[#e0a23a] bg-clip-text text-transparent">better</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-[rgba(245,237,225,0.86)] lg:mx-0">
              Track every round, dial in your bag, read every shot, and find your people. Your whole game — in one app, on every device.
            </p>
            <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:items-start"><StoreButtons dark /></div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--sage)] lg:justify-start">
              <span className="inline-flex items-center gap-1.5"><span className="text-[var(--gold)]">✓</span> Free to start</span>
              <span className="inline-flex items-center gap-1.5"><span className="text-[var(--gold)]">✓</span> iOS · Android · Web</span>
              <span className="inline-flex items-center gap-1.5"><span className="text-[var(--gold)]">✓</span> Built by disc golfers</span>
            </div>
          </div>

          {/* video inside a phone */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.22),transparent_60%)]" />
              <PhoneFrame className="w-[280px] rotate-[2deg] sm:w-[320px]">
                <video className="h-full w-full object-cover" autoPlay muted loop playsInline poster="/course/forehand.jpg">
                  <source src="/hero.mp4" type="video/mp4" />
                </video>
              </PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== HOOK / PROOF ===================== */}
      <section className="relative bg-[#faf8f3]">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
          <h2 className="mx-auto max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] md:text-[2.9rem]">
            Most apps just keep score. <br className="hidden sm:block" />
            <span className="text-[#9a7a3a]">Radius shows you how to get better.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#46554c]">
            It&apos;s the difference between a number at the end of the round and a clear path to your next personal best.
          </p>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-black/[0.07] bg-black/[0.06] sm:grid-cols-3">
            {[
              { big: <CourseCount />, label: "courses mapped by players" },
              { big: "iOS · Android · Web", label: "one account, everywhere" },
              { big: "Free", label: "to download and start" },
            ].map((s, i) => (
              <div key={i} className="bg-[#faf8f3] p-8">
                <div className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-[#16221b]">{s.big}</div>
                <div className="mt-1 text-sm text-[#6b7a70]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== GAME IQ SPOTLIGHT ===================== */}
      <section className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.04 }} aria-hidden />
        <div className="pointer-events-none absolute right-0 top-1/2 h-[640px] w-[640px] -translate-y-1/2 translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.12),transparent_62%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:py-28 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex justify-center lg:order-2 lg:justify-end">
            <ScreenPhone src="/screens/overview.png" alt="Radius Game IQ dashboard" className="w-[272px]" />
          </div>
          <div className="lg:order-1">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">The Radius difference · Game IQ</div>
            <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] md:text-5xl">
              One number for how good<br className="hidden md:block" /> you actually are.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--text-body)]">
              Every round you play feeds one honest score — your Game IQ — and a rank that climbs from Rec all the way to MPO. Finally, a clear answer to the only question that matters: <span className="font-semibold text-[var(--cream)]">am I getting better?</span>
            </p>
            <div className="mt-8">
              <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">30 ranks · 6 tiers to climb</div>
              <div className="flex items-center gap-1.5">
                {TIERS.map((t, i) => (
                  <div key={t.label} className="flex items-center gap-1.5">
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${t.color}22`, color: t.color }}>{t.label}</span>
                    {i < TIERS.length - 1 && <span className="text-[var(--sage-dim)]">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FEATURE SHOWCASES ===================== */}
      <section className="bg-[#faf8f3]">
        <div className="mx-auto max-w-6xl px-6 pt-16 md:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">Everything, working together</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">Not a scorecard. A whole system.</h2>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-8">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`flex flex-col items-center gap-10 py-12 md:gap-16 md:py-16 ${i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"}`}>
              <div className="flex flex-1 justify-center">
                <ScreenPhone src={f.img} alt={f.title} className="w-[256px]" />
              </div>
              <div className="flex-1">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">{f.eyebrow}</div>
                <h3 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em] md:text-4xl">{f.title}</h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-[#46554c]">{f.body}</p>
                <ul className="mt-6 space-y-3">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-[#2c3a32]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#9a7a3a]/15 text-xs font-bold text-[#9a7a3a]">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== FOR EVERY PLAYER ===================== */}
      <section className="bg-[#f3eee4]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">Whoever you are out there</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">Built for every disc golfer.</h2>
            <p className="mx-auto mt-4 max-w-lg text-[#46554c]">From your very first round to your thousandth — Radius meets you where you are and grows with your game.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PERSONAS.map((p) => (
              <div key={p.who} className="rounded-3xl border border-black/8 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.3)]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--gold)]/12 text-[#9a7a3a]">{p.icon}</div>
                <h3 className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">{p.who}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#46554c]">{p.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CROSS-PLATFORM ===================== */}
      <section className="bg-[#faf8f3]">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center md:py-20">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">Start on your phone. Pick up on the web.</h2>
          <p className="mx-auto mt-3 max-w-md text-[#46554c]">One account syncs your game across iOS, Android, and your desktop — your bag, stats, and rounds always with you.</p>
        </div>
      </section>

      {/* ===================== CLOSING CTA ===================== */}
      <section className="relative isolate overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <Image src="/course/drive.jpg" alt="" fill sizes="100vw" quality={90} className="-z-10 object-cover object-[center_40%]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(15,24,19,0.9),rgba(15,24,19,0.66)_55%,rgba(15,24,19,0.42))]" />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center md:py-28">
          <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-6xl">Play Smarter,<br />Not Harder.</h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-[rgba(245,237,225,0.9)]">Join the disc golfers getting better every round with Radius — free to download, on every device.</p>
          <div className="mt-9 flex justify-center"><StoreButtons dark /></div>
          <p className="mt-6 text-sm text-[var(--sage-dim)]">Free to start · <Link href="/subscription" className="underline hover:text-[var(--cream)]">See Radius Pro</Link></p>
        </div>
      </section>
    </div>
  );
}
