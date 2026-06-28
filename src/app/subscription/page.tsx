"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const PLANS = [
  {
    name: "Free",
    badge: "Always free",
    featured: false,
    free: true,
    price: "$0",
    per: "",
    sub: "Track rounds, browse courses, and join the community.",
    cta: "Create your account",
  },
  {
    name: "Pro",
    badge: "7-day free trial",
    featured: true,
    free: false,
    annual: { price: "$3.33", per: "/mo", sub: "Billed $39.99/yr · save 33%" },
    monthly: { price: "$4.99", per: "/mo", sub: "Billed monthly" },
    cta: "Start free trial",
  },
];

const TIMELINE = [
  { icon: "🔓", day: "Today", body: "Unlock everything — unlimited Caddy, full Game IQ insights, your whole history, and every game mode." },
  { icon: "🔔", day: "Day 5", body: "We'll send a reminder before your trial ends. No surprises, ever." },
  { icon: "◎", day: "Day 7", body: "Your plan begins at $3.33/mo (annual). Cancel any time before and pay nothing." },
];

const VERSUS = [
  { free: "Your score at the end of the round", pro: "A clear plan to shoot it lower" },
  { free: "A taste of the Caddy", pro: "Smart guidance on every single hole" },
  { free: "Your Game IQ number", pro: "The full breakdown behind it" },
  { free: "Your recent rounds", pro: "Your entire history & every trend" },
];

const BENEFITS = [
  {
    title: "A smart play on every hole",
    body: "Unlimited Caddy reads every lie — distance, danger, your tendencies — and tells you the disc and line to throw.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.5" fill="currentColor" /></svg>
    ),
  },
  {
    title: "Find your next gain, faster",
    body: "Full Game IQ insights break your game into putting, driving, scramble and management — and pinpoint exactly what to work on.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M3 17l5-5 4 4 8-8" /><path d="M16 8h4v4" /></svg>
    ),
  },
  {
    title: "Your whole game, unlocked",
    body: "Unlimited round history, full bag analysis, complete performance stats, and every game mode — nothing held back.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>
    ),
  },
];

const COMPARE: { label: string; free: boolean; pro: boolean }[] = [
  { label: "Unlimited scorecards — every round, no limits", free: true, pro: true },
  { label: "Build & manage multiple bags", free: true, pro: true },
  { label: "Putting Practice — drills & training", free: true, pro: true },
  { label: "Satellite hole maps & course leaderboards", free: true, pro: true },
  { label: "Disc scanning & bag builder", free: true, pro: true },
  { label: "Community: posts, follows & courses", free: true, pro: true },
  { label: "Your Game IQ score", free: true, pro: true },
  { label: "Caddy — sample shot reads", free: true, pro: true },
  { label: "Per-round stats", free: true, pro: true },
  { label: "Full performance stats & trends", free: false, pro: true },
  { label: "Full Game IQ Insights — skill breakdown & weaknesses", free: false, pro: true },
  { label: "Unlimited Caddy — guidance on every hole", free: false, pro: true },
  { label: "Full bag analysis & optimization", free: false, pro: true },
  { label: "Your entire round history & every trend", free: false, pro: true },
  { label: "All game modes unlocked", free: false, pro: true },
];

// Free, forever — the essentials we never gate (the 2.0 story). Shown above pricing.
const FREE_SHOTS = [
  { img: "/screens/scorecard.png", title: "Unlimited scorecards", body: "Keep score for every round — no caps, no paywall. Immersive hole-by-hole detail on every card." },
  { img: "/screens/bags.png", title: "Multiple bags", body: "Build a tournament bag, a casual bag, a winter bag — and switch your active bag on the fly." },
  { img: "/screens/putting.png", title: "Putting practice", body: "Structured drills on real satellite hole maps with regulation C1 / C2 rings. Reps that transfer." },
];

const FREE_CHIPS = ["Unlimited scorecards", "Multiple bags", "Putting practice", "Satellite course maps", "Disc scanning", "Game IQ score", "Community & feed"];

export default function SubscriptionPage() {
  const [annual, setAnnual] = useState(true);
  const [showBar, setShowBar] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.scrollY + window.innerHeight > document.body.scrollHeight - 280;
      setShowBar(!nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="bg-[#faf8f3] text-[#16221b]">
      {/* ===================== HERO — the offer ===================== */}
      <section className="relative isolate overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.16),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-32 text-center md:pt-36">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/[0.08] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" /> Radius Pro · 7-day free trial
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold leading-[1.0] tracking-[-0.03em] text-white md:text-[4rem]">
            The best of Radius.<br />Built for your game.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[rgba(245,237,225,0.85)]">
            Try every Pro feature free for 7 days. Here&apos;s exactly how it works — no fine print.
          </p>

          {/* trial timeline — the hero centerpiece */}
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
            {TIMELINE.map((s, i) => (
              <div key={s.day} className="relative rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--gold)] text-lg text-[#16221b]">{s.icon}</span>
                <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--gold)]">{i === 0 ? "Step 1" : i === 1 ? "Step 2" : "Step 3"}</div>
                <div className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{s.day}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-body)]">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link href="/login" className="rounded-full bg-[var(--gold)] px-10 py-4 text-sm font-bold text-[#16221b] shadow-[0_10px_30px_rgba(246,193,101,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">
              Start your free trial
            </Link>
            <p className="text-sm text-[var(--sage)]">Free for 7 days · then from <span className="font-bold text-[var(--cream)]">$3.33/mo</span> · cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ===================== FREE, FOREVER (new in 2.0) ===================== */}
      <section className="bg-[#f3eee4]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">Generous on free · New in 2.0</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">We don&apos;t paywall your scorecard.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#46554c]">
              Other apps cap your rounds and lock the basics behind a subscription. Radius keeps the essentials free — forever. <span className="font-semibold text-[#16221b]">Pro is the intelligence layer on top.</span>
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FREE_SHOTS.map((s) => (
              <div key={s.title} className="flex flex-col items-center text-center">
                <PhoneShot src={s.img} alt={s.title} />
                <h3 className="mt-6 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">{s.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#46554c]">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-2.5">
            {FREE_CHIPS.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-semibold text-[#2c3a32] shadow-sm">
                <span className="text-[#9a7a3a]">✓</span> {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PRICING ===================== */}
      <section id="pricing" className="bg-[#faf8f3]">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-24">
          <div className="text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">Simple pricing</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">Less than one disc a month.</h2>
            <p className="mx-auto mt-4 max-w-md text-[#46554c]">Pick a plan after your free week. No commitment — cancel any time, keep your free account forever.</p>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="inline-flex rounded-full border border-black/10 bg-white p-1 text-sm font-bold shadow-sm">
              <button onClick={() => setAnnual(true)} className={`rounded-full px-5 py-2 transition-colors ${annual ? "bg-[var(--gold)] text-[#16221b]" : "text-[#46554c]"}`}>Annual · save 33%</button>
              <button onClick={() => setAnnual(false)} className={`rounded-full px-5 py-2 transition-colors ${!annual ? "bg-[var(--gold)] text-[#16221b]" : "text-[#46554c]"}`}>Monthly</button>
            </div>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl items-start gap-5 md:grid-cols-2">
            {PLANS.map((p) => {
              const t: { price: string; per: string; sub: string } = p.free
                ? { price: p.price ?? "", per: p.per ?? "", sub: p.sub ?? "" }
                : (annual ? p.annual : p.monthly) ?? { price: "", per: "", sub: "" };
              return (
                <div key={p.name} className={`relative rounded-3xl border p-7 transition-shadow ${p.featured ? "border-[var(--gold)]/70 bg-white shadow-[0_0_28px_-4px_rgba(246,193,101,0.5),0_34px_80px_-28px_rgba(246,193,101,0.65)]" : "border-black/8 bg-white/70"}`}>
                  {p.featured && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-3xl bg-[linear-gradient(to_bottom,rgba(246,193,101,0.18),transparent)]" />}
                  {p.featured && annual && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-[#f8cf80] via-[#f6c165] to-[#e0a23a] px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#16221b] shadow-[0_6px_20px_rgba(246,193,101,0.6)] ring-1 ring-white/50">
                      <span className="text-[11px]">✦</span> Most popular
                    </span>
                  )}
                  <div className="relative mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-wide text-[#16221b]">{p.name}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.featured ? "bg-[var(--gold)] text-[#16221b]" : "bg-black/[0.06] text-[#6b7a70]"}`}>{p.badge}</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="font-[family-name:var(--font-heading)] text-5xl font-extrabold tracking-tight text-[#16221b]">{t.price}</span>
                    <span className="mb-2 text-sm text-[#6b7a70]">{t.per}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#6b7a70]">{t.sub}</p>
                  <Link href="/login" className={`mt-6 block rounded-full px-6 py-3.5 text-center text-sm font-bold transition-all hover:-translate-y-0.5 ${p.featured ? "bg-[var(--gold)] text-[#16221b] hover:bg-[var(--gold-bright)]" : "border border-black/15 text-[#16221b] hover:border-black/40"}`}>
                    {p.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== TRANSFORMATION ===================== */}
      <section className="bg-[#16221b] text-[var(--cream)]">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="text-center">
            <h2 className="mx-auto max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] md:text-[2.9rem]">
              Free keeps score. <span className="bg-gradient-to-br from-[#f8cf80] to-[#e0a23a] bg-clip-text text-transparent">Pro makes you better.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--text-body)]">Same game. A completely different level of insight.</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-3xl overflow-hidden rounded-3xl border border-white/10 sm:grid-cols-2">
            <div className="border-b border-white/10 bg-white/[0.03] p-7 sm:border-b-0 sm:border-r">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">On Free, you see</div>
              <ul className="space-y-3">
                {VERSUS.map((v) => <li key={v.free} className="flex items-start gap-2.5 text-sm text-[var(--sage)]"><span className="mt-0.5 text-[var(--sage-dim)]">○</span>{v.free}</li>)}
              </ul>
            </div>
            <div className="bg-[var(--gold)]/[0.08] p-7">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--gold)]">With Pro, you get</div>
              <ul className="space-y-3">
                {VERSUS.map((v) => <li key={v.pro} className="flex items-start gap-2.5 text-sm font-medium text-[var(--cream)]"><span className="mt-0.5 text-[var(--gold)]">✓</span>{v.pro}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== BENEFIT CARDS ===================== */}
      <section className="bg-[#faf8f3]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">What your trial unlocks</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">The tools that actually move your game.</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-3xl border border-black/8 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_22px_50px_-22px_rgba(0,0,0,0.3)]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--gold)]/15 text-[#9a7a3a]">{b.icon}</div>
                <h3 className="mt-5 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#46554c]">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== COMPARISON ===================== */}
      <section className="bg-[#f3eee4]">
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-24">
          <h2 className="text-center font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.5rem]">Free vs Pro, line by line</h2>
          <div className="mt-12 overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_6rem_6rem] items-center gap-3 border-b border-black/8 px-6 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a70] sm:grid-cols-[1fr_7rem_7rem]">
              <span>Feature</span>
              <span className="text-center">Free</span>
              <span className="text-center text-[#9a7a3a]">Pro</span>
            </div>
            {COMPARE.map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_6rem_6rem] items-center gap-3 border-b border-black/5 px-6 py-3.5 last:border-0 sm:grid-cols-[1fr_7rem_7rem]">
                <span className="text-sm font-medium text-[#16221b]">{row.label}</span>
                <span className="flex justify-center"><Cell v={row.free} /></span>
                <span className="flex justify-center"><Cell v={row.pro} accent /></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CLOSING CTA ===================== */}
      <section className="relative isolate overflow-hidden">
        <Image src="/course/action.jpg" alt="" fill sizes="100vw" quality={90} className="-z-10 object-cover object-[40%_center]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(15,24,19,0.9),rgba(15,24,19,0.6))]" />
        <div className="mx-auto max-w-7xl px-6 py-24 text-center md:py-32">
          <h2 className="mx-auto max-w-2xl font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-[3.25rem]">
            Your best round starts here.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-[rgba(245,237,225,0.9)]">Try Pro free for 7 days. No commitment, cancel anytime.</p>
          <Link href="/login" className="mt-8 inline-block rounded-full bg-[var(--gold)] px-10 py-4 text-sm font-bold text-[#16221b] shadow-[0_10px_30px_rgba(246,193,101,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">
            Start your free 7-day trial
          </Link>
        </div>
      </section>

      {/* ===================== Sticky trial bar ===================== */}
      <div className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${showBar ? "translate-y-0" : "translate-y-full"}`}>
        <div className="border-t border-black/10 bg-[#16221b] text-[var(--cream)]">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-[family-name:var(--font-heading)] font-bold">Start your free trial. On us for 7 days.</div>
              <div className="text-sm text-[var(--text-body)]">Then $3.33/mo (annual) or $4.99/mo. Cancel anytime.</div>
            </div>
            <Link href="/login" className="shrink-0 rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
              Start free trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneShot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-[230px] shrink-0 rounded-[2.4rem] border border-black/10 bg-[#0d140f] p-2 shadow-[0_30px_70px_-28px_rgba(0,0,0,0.55)]">
      <div className="relative aspect-[1170/2532] overflow-hidden rounded-[1.9rem] bg-black">
        <Image src={src} alt={alt} fill sizes="230px" quality={90} className="object-cover" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[12px] z-10 h-[20px] w-[80px] -translate-x-1/2 rounded-full bg-[#0d140f]" />
    </div>
  );
}

function Cell({ v, accent = false }: { v: boolean | string; accent?: boolean }) {
  if (v === true) return <Check dark={!accent} />;
  if (v === false) return <span className="text-black/20">—</span>;
  return <span className={`text-center text-xs font-bold ${accent ? "text-[#9a7a3a]" : "text-[#46554c]"}`}>{v}</span>;
}

function Check({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`grid h-6 w-6 place-items-center rounded-full ${dark ? "bg-[#16221b]" : "bg-[var(--gold)]"}`}>
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke={dark ? "#faf8f3" : "#16221b"} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l4.5 4.5L19 7" />
      </svg>
    </span>
  );
}
