import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import CourseCount from "@/components/CourseCount";

export const metadata: Metadata = {
  title: "Features — Radius",
  description: "A guided tour of Radius: Game IQ, your Caddy, shot tracking on Apple Watch, putting insight, courses, unlimited scorecards, and community. The disc golf app that actually makes you better. Play smarter, not harder.",
  alternates: { canonical: "https://radiusdiscgolf.com/features" },
};

const APP_STORE = "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";
const GREEN = "#5fb87a";

// The composed App Store preview panels already carry a phone/watch + green glow + a baked headline,
// so they're shown as-is (no phone frame). Our copy adds the substance beneath each headline.
type Feature = { eyebrow: string; title: string; body: string; bullets: string[]; img: string };

const FEATURES: Feature[] = [
  {
    eyebrow: "Home",
    title: "Your whole game, the second you open it",
    body: "Last round, the closest course to tee off, and the one thing to work on next — surfaced the moment you land on the home screen. No digging.",
    bullets: ["Your last round at a glance, hole by hole", "Nearest course + one-tap to start playing", "A personalized “what to work on” every day"],
    img: "/features/home.png",
  },
  {
    eyebrow: "Round detail",
    title: "Not just a score — the whole story",
    body: "Every round comes back as an immersive breakdown: throw quality, the holes that won it and lost it, and exactly where the strokes went. It quietly makes you better over time.",
    bullets: ["Hole-by-hole round detail, tap any hole", "Throw-quality grade for the whole round", "Unlimited scorecards — every round, free"],
    img: "/features/round.png",
  },
  {
    eyebrow: "Your Caddy",
    title: "Know what to throw, every hole",
    body: "Radius reads the shot and suggests a disc and a line — built from your own bag and how you actually throw. It informs; you decide. That's playing smarter.",
    bullets: ["Disc + line suggestions tuned to your arm", "Built from your bag and your tendencies", "Always your call — never automated"],
    img: "/features/caddy.png",
  },
  {
    eyebrow: "Putting",
    title: "Turn missed putts into made ones",
    body: "Every miss is mapped by zone and distance on real hole maps with regulation circles — so you train the actual leak instead of guessing. The reps you put in show up on the course.",
    bullets: ["See where putts miss — by zone and distance", "Regulation C1 / C2 rings (33 / 66 ft)", "Every make and miss feeds your stats"],
    img: "/features/putting.png",
  },
  {
    eyebrow: "Courses",
    title: "Show up with a plan, not a guess",
    body: "Satellite hole maps, real community-built layouts, and leaderboards for courses everywhere — so you know the course before you ever tee off.",
    bullets: ["Satellite maps with every hole", "Community-built layouts you can trust", "Course leaderboards and your personal bests"],
    img: "/features/courses.png",
  },
  {
    eyebrow: "Your record",
    title: "Every round, on the record",
    body: "Your full history, personal bests, and the trend line that proves it — your game, documented, so progress is something you can actually see.",
    bullets: ["Complete round history in one place", "Personal bests and course records", "Trends that show the climb over time"],
    img: "/features/record.png",
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

const WATCH = [
  { src: "/features/watch-distance.png", label: "Distance to basket" },
  { src: "/features/watch-caddy.png", label: "Caddy on your wrist" },
  { src: "/features/watch-disc.png", label: "Pick your disc" },
  { src: "/features/watch-score.png", label: "Score the hole" },
];

function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative shrink-0 rounded-[2.6rem] border border-white/12 bg-[#0d140f] p-2.5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)] ${className}`}>
      <div className="relative aspect-[886/1920] overflow-hidden rounded-[2.05rem] bg-black">{children}</div>
      <div className="pointer-events-none absolute left-1/2 top-[14px] z-10 h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-[#0d140f]" />
    </div>
  );
}

// A composed marketing panel — self-contained (phone/watch + glow + headline); rendered with a soft green halo.
function Panel({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-[3rem] bg-[radial-gradient(circle,rgba(95,184,122,0.16),transparent_60%)]" />
      <Image src={src} alt={alt} width={900} height={1951} sizes="(min-width:768px) 420px, 78vw" className="h-auto w-full" />
    </div>
  );
}

function StoreButtons() {
  const base = "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5";
  return (
    <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
      <a href={APP_STORE} target="_blank" rel="noopener" className={`${base} bg-[var(--cream)] text-[#16221b]`}>
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
    <div className="bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* ===================== HERO ===================== */}
      <section className="relative isolate flex min-h-[90vh] items-center overflow-hidden">
        {/* clean, like the app preview panels: near-black → forest, soft green glow behind the phone */}
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(160deg,#070d0a_0%,#0a130f_55%,#0c1a13_100%)]" />
        <div className="pointer-events-none absolute right-[6%] top-1/2 -z-10 h-[860px] w-[860px] -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${GREEN}33, transparent 58%)` }} />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-6 pb-16 pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          {/* left copy */}
          <div className="text-center lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/[0.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" /> The complete disc golf companion
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-[3.35rem] font-extrabold leading-[0.94] tracking-[-0.035em] text-white sm:text-6xl md:text-[4.7rem]">
              The disc golf app<br className="hidden sm:block" /> that makes you<br className="hidden sm:block" /> <span className="bg-gradient-to-br from-[#f8cf80] to-[#e0a23a] bg-clip-text text-transparent">better.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-[rgba(245,237,225,0.82)] lg:mx-0">
              Track every round, read every shot, dial in your bag, and find your people. Your whole game — in one app, on every device, down to your wrist.
            </p>
            <div className="mt-9 flex justify-center lg:justify-start"><StoreButtons /></div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-[var(--sage)] lg:justify-start">
              {["Free to start", "iOS · Android · Web · Watch", "Built by disc golfers"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><span style={{ color: GREEN }}>✓</span> {t}</span>
              ))}
            </div>
          </div>

          {/* right: phone video with a green halo, matching the preview panels */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 -z-10 scale-[1.35] rounded-full" style={{ background: `radial-gradient(circle, ${GREEN}55, transparent 60%)` }} />
              <PhoneFrame className="w-[268px] shadow-[0_50px_110px_-35px_rgba(0,0,0,0.85)] sm:w-[312px]">
                <video className="h-full w-full object-cover" autoPlay muted loop playsInline poster="/features/preview-poster.jpg">
                  <source src="/features/preview.mp4" type="video/mp4" />
                </video>
              </PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== PROOF STRIP ===================== */}
      <section className="relative border-y border-white/[0.06] bg-[#0b1310]">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="mx-auto max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] md:text-[2.6rem]">
            Most apps just keep score. <span style={{ color: GREEN }}>Radius shows you how to get better.</span>
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.05] sm:grid-cols-3">
            {[
              { big: <CourseCount />, label: "courses mapped by players" },
              { big: "iOS · Android · Web", label: "one account, everywhere" },
              { big: "Free", label: "to download and start" },
            ].map((s, i) => (
              <div key={i} className="bg-[var(--bg-deep)] p-8">
                <div className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-[var(--cream)]">{s.big}</div>
                <div className="mt-1 text-sm text-[var(--sage-dim)]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== GAME IQ SPOTLIGHT ===================== */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.04 }} aria-hidden />
        <div className="pointer-events-none absolute right-0 top-1/2 h-[640px] w-[640px] -translate-y-1/2 translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.1),transparent_62%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 md:py-24 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex justify-center lg:order-2 lg:justify-end">
            <Panel src="/features/gameiq.png" alt="Radius Game IQ and your rank" className="w-[300px] sm:w-[360px]" />
          </div>
          <div className="lg:order-1">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">The Radius difference · Game IQ</div>
            <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] md:text-5xl">
              One number for how good<br className="hidden md:block" /> you actually are.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--text-body)]">
              Every round feeds one honest score — your Game IQ — and a rank that climbs from Rec all the way to MPO. Finally, a clear answer to the only question that matters: <span className="font-semibold text-[var(--cream)]">am I getting better?</span>
            </p>
            <div className="mt-8">
              <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">30 ranks · 6 tiers to climb</div>
              <div className="flex flex-wrap items-center gap-1.5">
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

      {/* ===================== FEATURE GALLERY ===================== */}
      <section className="relative border-t border-white/[0.06] bg-[#0b1310]">
        <div className="mx-auto max-w-2xl px-6 pt-16 text-center md:pt-24">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Everything, working together</div>
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">Not a scorecard. A whole system.</h2>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-6">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`flex flex-col items-center gap-8 py-10 md:gap-16 md:py-14 ${i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"}`}>
              <div className="flex flex-1 justify-center">
                <Panel src={f.img} alt={f.title} className="w-[288px] sm:w-[352px]" />
              </div>
              <div className="flex-1">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{f.eyebrow}</div>
                <h3 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em] md:text-4xl">{f.title}</h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-[var(--text-body)]">{f.body}</p>
                <ul className="mt-6 space-y-3">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-[rgba(245,237,225,0.82)]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${GREEN}22`, color: GREEN }}>✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== SHOT TRACKING + WATCH ===================== */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${GREEN}18, transparent 62%)` }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 md:py-24 lg:grid-cols-2">
          <div className="flex justify-center lg:justify-start">
            <Panel src="/features/track.png" alt="Shot tracking with the Apple Watch companion" className="w-[300px] sm:w-[368px]" />
          </div>
          <div>
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Shot tracking · Apple Watch</div>
            <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] md:text-5xl">
              Every throw, tracked —<br className="hidden md:block" /> even from your wrist.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--text-body)]">
              Real GPS distances, live wind, and one-tap throw logging on the course. Leave the phone in the bag — get distance, disc picks, your Caddy, and scoring right on Apple Watch.
            </p>
            <div className="mt-9 grid grid-cols-4 gap-3 sm:gap-4">
              {WATCH.map((w) => (
                <div key={w.label} className="text-center">
                  <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]">
                    <Image src={w.src} alt={w.label} width={368} height={448} sizes="120px" className="h-auto w-full" />
                  </div>
                  <div className="mt-2 text-[10.5px] font-semibold leading-tight text-[var(--sage-dim)]">{w.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FOR EVERY PLAYER ===================== */}
      <section className="relative border-t border-white/[0.06] bg-[#0b1310]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Whoever you are out there</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">Built for every disc golfer.</h2>
            <p className="mx-auto mt-4 max-w-lg text-[var(--text-body)]">From your very first round to your thousandth — Radius meets you where you are and grows with your game.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PERSONAS.map((p) => (
              <div key={p.who} className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-7 transition-all hover:-translate-y-1 hover:border-[var(--gold)]/30 hover:bg-white/[0.05]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--gold)]/12 text-[var(--gold)]">{p.icon}</div>
                <h3 className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight text-[var(--cream)]">{p.who}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-body)]">{p.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CLOSING CTA ===================== */}
      <section className="relative isolate overflow-hidden">
        <Image src="/course/drive.jpg" alt="" fill sizes="100vw" quality={85} className="-z-10 object-cover object-[center_40%] opacity-60" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(11,17,13,0.94),rgba(11,17,13,0.72)_55%,rgba(11,17,13,0.5))]" />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center md:py-28">
          <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-6xl">Play Smarter,<br />Not Harder.</h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-[rgba(245,237,225,0.9)]">Join the disc golfers getting better every round with Radius — free to download, on every device.</p>
          <div className="mt-9 flex justify-center"><StoreButtons /></div>
          <p className="mt-6 text-sm text-[var(--sage-dim)]">Free to start · <Link href="/subscription" className="underline hover:text-[var(--cream)]">See Radius Pro</Link></p>
        </div>
      </section>
    </div>
  );
}
