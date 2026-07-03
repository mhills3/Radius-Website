export const metadata = {
  title: "Rewards",
  description: "Get rewarded for building disc golf courses on Radius — earn free Pro, gear, and lifetime perks for mapping the courses that power the community.",
  alternates: { canonical: "https://radiusdiscgolf.com/rewards" },
};

const DISCORD = "https://discord.gg/JW2SvWfCq";

const TIERS = [
  {
    num: "01",
    name: "Rewards Member",
    req: "Map 5 approved courses to unlock it.",
    featured: false,
    perks: [
      "Founding member status",
      "Radius Pro free for a full year",
      "Early access to beta features",
      "First look at limited drops",
      "Exclusive offers from partners",
      "Private channels with the team",
      "A vote on what we build next",
    ],
  },
  {
    num: "02",
    name: "Rewards Pro",
    badge: "Top tier",
    req: "Map 10 approved courses to unlock the top tier.",
    featured: true,
    perks: [
      "Everything in Rewards Member",
      "Radius Pro free for 2 full years",
      "Exclusive access to Radius gear drops",
      "First access to everything new",
      "Permanent founders' wall placement",
    ],
  },
];

const LADDER = [
  { n: "5", tier: "Starter", reward: "1 Year of Radius Pro", desc: "A full year of Caddy's Picks, Game IQ, and insights — on the house.", gate: "" },
  { n: "10", tier: "Builder", reward: "2 Years of Radius Pro", desc: "Double up — two full years of everything Pro has to offer.", gate: "" },
  { n: "25", tier: "Craftsman", reward: "Radius Gear Bundle", desc: "An exclusive custom Radius kit — our thanks, in physical form.", gate: "" },
  { n: "50", tier: "Architect", reward: "Premium Tournament Bag", desc: "A premium tournament bag of your pick, up to $200 — Squatch-tier quality.", gate: "Requires courses in 2+ states" },
  { n: "100", tier: "Legend", reward: "Lifetime Radius Pro", desc: "Pro features for life — our highest honor for a founding mapper.", gate: "Requires courses in 5+ states", top: true },
];

const STEPS = [
  { n: "1", title: "Join the community", body: "Hop into the Discord. Meet other players, follow updates, and find your way around the Radius community." },
  { n: "2", title: "Map courses", body: "Submit the courses you've built for review. Our team approves each one before it counts toward your total." },
  { n: "3", title: "Earn your rewards", body: "Hit 5 approved courses for a free year of Radius Pro. Hit 10 for 2 full years — then keep climbing the ladder for gear, bags, and lifetime Pro." },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function RewardsPage() {
  return (
    <div className="bg-[#faf8f3] text-[#16221b]">
      {/* hero */}
      <section className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <svg className="pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-40" viewBox="0 0 760 760" fill="none" aria-hidden="true">
          {[110, 200, 290, 380].map((r) => (
            <circle key={r} cx="380" cy="380" r={r} stroke="rgba(246,193,101,0.12)" strokeWidth="1" />
          ))}
        </svg>
        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-28 text-center md:pt-32">
          <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Rewards</div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] md:text-[3.25rem]">
            Get rewarded for building disc golf courses.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-body)]">
            Every course you map makes Radius better for the whole community — so we pay it back.
            Earn <span className="font-bold text-[var(--cream)]">free Radius Pro, exclusive gear, premium bags, and lifetime perks</span> for
            the courses you build. The more you add, the more you earn.
          </p>
          <a href={DISCORD} target="_blank" rel="noopener" className="mt-9 inline-block rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-bold text-[#16221b] shadow-[0_10px_30px_rgba(246,193,101,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">
            Start earning
          </a>
        </div>
      </section>

      {/* tiers */}
      <section className="bg-[#faf8f3]">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">Membership tiers</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.5rem]">Two ways to earn your status</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {TIERS.map((t) => (
              <div key={t.num} className={`rounded-3xl border p-8 ${t.featured ? "border-[var(--gold)]/40 bg-[var(--bg-deep)] text-[var(--cream)]" : "border-black/8 bg-white text-[#16221b] shadow-sm"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-[0.16em] ${t.featured ? "text-[var(--sage)]" : "text-[#9a7a3a]"}`}>Tier {t.num}</span>
                  {t.badge && <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-[11px] font-bold text-[#16221b]">{t.badge}</span>}
                </div>
                <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight">{t.name}</h3>
                <p className={`mt-2 text-sm ${t.featured ? "text-[var(--text-body)]" : "text-[#46554c]"}`}>{t.req}</p>
                <ul className="mt-6 space-y-3">
                  {t.perks.map((p) => (
                    <li key={p} className={`flex items-start gap-3 text-sm ${t.featured ? "text-[rgba(245,237,225,0.9)]" : "text-[#2c3a32]"}`}>
                      <Check />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* course builder rewards */}
      <section className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.12),transparent_62%)]" />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">The rewards ladder</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">
              Build the map. <span className="bg-gradient-to-br from-[#f8cf80] to-[#d4a04a] bg-clip-text text-transparent">Get rewarded.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-[var(--text-body)]">
              Every course you add makes Radius sharper for the whole community — so we&apos;re giving
              back to the builders who power it. Map courses, climb the ladder, earn real rewards that
              are yours to keep.
            </p>
          </div>

          {/* mechanics */}
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[["Full course", "New course = 1"], ["Layout", "Any layout = ½"], ["The fine print", "Verified courses only"], ["How it stacks", "Rewards are cumulative"]].map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">{l}</div>
                <div className="mt-1 font-[family-name:var(--font-heading)] font-bold">{v}</div>
              </div>
            ))}
          </div>

          {/* ladder */}
          <div className="mt-8 space-y-3">
            {LADDER.map((r) => (
              <div key={r.n} className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center ${r.top ? "border-[var(--gold)]/50 bg-[var(--gold)]/[0.07]" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="flex w-full shrink-0 items-baseline gap-2 sm:w-auto sm:min-w-[8.5rem]">
                  <span className="font-[family-name:var(--font-heading)] text-4xl font-extrabold text-[var(--gold)]">{r.n}</span>
                  <span className="whitespace-nowrap text-xs uppercase tracking-[0.14em] text-[var(--sage-dim)]">courses</span>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{r.tier}</span>
                    {r.top && <span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-bold text-[#16221b]">Top tier</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--text-body)]">{r.desc}</p>
                  {r.gate && <span className="mt-1 inline-block text-xs font-medium text-[var(--sage-dim)]">{r.gate}</span>}
                </div>
                <div className="shrink-0 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-2 text-sm font-bold text-[var(--gold)]">
                  {r.reward}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-[var(--sage-dim)]">
            A brand-new course earns 1 credit; an alternate layout of an existing course earns
            ½-course credit, regardless of hole count. Rewards are cumulative and yours to keep.
            Courses must be approved before they count — program terms may change.
          </p>
        </div>
      </section>

      {/* how it works */}
      <section className="bg-[#faf8f3]">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-24">
          <div className="text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">How it works</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.5rem]">Three steps to your rewards</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-3xl border border-black/8 bg-white p-8 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16221b] font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">{s.n}</div>
                <h3 className="mt-4 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#46554c]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#16221b] text-[var(--cream)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">
            Start earning today.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[var(--text-body)]">Map your first course and claim your rewards.</p>
          <a href={DISCORD} target="_blank" rel="noopener" className="mt-7 inline-block rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">
            Join the Discord
          </a>
        </div>
      </section>
    </div>
  );
}
