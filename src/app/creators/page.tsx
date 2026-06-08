import CreatorFlywheel from "@/components/story/CreatorFlywheel";

export const metadata = {
  title: "Creators",
  description: "Partner with Radius. Share the home of disc golf with your audience — and get rewarded with cash, commission, and a free year of Radius.",
  alternates: { canonical: "https://radiusdiscgolf.com/creators" },
};

const PACKAGE = [
  { icon: "💵", title: "Flat fee", body: "Cash payment, varies by audience size and fit. Sent via Stripe after your first piece of content goes live." },
  { icon: "📈", title: "25% commission", body: "25% of every annual signup that comes through your code. One-time, paid quarterly." },
  { icon: "🎁", title: "Free year of Radius", body: "Full access to the app, activated immediately so you can use it in your content." },
  { icon: "🧢", title: "Radius hat", body: "Shipped the same week you sign. Wear it whenever — on or off camera." },
  { icon: "🎟️", title: "A code for your audience", body: "Your audience gets 25% off the annual plan. Your code stays active for 60 days after your last post." },
  { icon: "📊", title: "Creator dashboard", body: "Your full funnel — App Store views, downloads, paid signups, and commission earned — in one place, refreshed monthly." },
];

export default function CreatorsPage() {
  return (
    <div className="bg-[#faf8f3] text-[#16221b]">
      {/* hero */}
      <section className="relative isolate overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.05 }} />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.18),transparent_60%)]" />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-6 pb-16 pt-32 md:pt-36 lg:grid-cols-[1fr_1fr] lg:gap-6">
          <div className="text-center lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" /> Radius Creators
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold leading-[0.98] tracking-[-0.03em] md:text-[4.25rem]">
              You shape the sport. Get paid to share it.
            </h1>
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-[rgba(245,237,225,0.85)] lg:mx-0">
              Your audience already trusts your take on disc golf. Put Radius in front of them — and earn cash, commission, and a year of Radius for it.
            </p>
            <a href="#apply" className="mt-9 inline-block rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-bold text-[#16221b] shadow-[0_10px_30px_rgba(246,193,101,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">
              Apply to the program
            </a>
          </div>
          <div className="mx-auto w-full max-w-[460px]"><CreatorFlywheel /></div>
        </div>
      </section>

      {/* ethos — cream for contrast */}
      <section className="bg-[#faf8f3]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center md:py-24">
          <p className="font-[family-name:var(--font-heading)] text-2xl font-bold leading-snug tracking-[-0.02em] text-[#16221b] md:text-3xl">
            Most apps show you what you did. Radius tells you what to do next — which disc to throw,
            which line to play, what to practice — based on how you actually throw.
          </p>
          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-[#46554c]">
            We&apos;re picky about who we partner with, because the program is meant to feel like a real partnership — not a transaction.
          </p>
        </div>
      </section>

      {/* the package */}
      <section className="border-y border-black/[0.06] bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">The package</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.5rem]">Everything you get</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PACKAGE.map((p) => (
              <div key={p.title} className="group rounded-3xl border border-black/8 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--gold)]/40 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--gold)]/12 text-2xl">{p.icon}</div>
                <h3 className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#46554c]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* content paths */}
      <section className="bg-[#f3eee4]">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-24">
          <div className="text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">The deliverable</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.5rem]">Two ways to create</h2>
            <p className="mx-auto mt-4 max-w-lg text-[#46554c]">Both are equivalent effort — we don&apos;t have a preference. Choose whichever feels natural for your audience.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-black/8 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="inline-block rounded-full bg-[var(--gold)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a7a3a]">Path A · Long-form</div>
              <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight">1 long-form video</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#46554c]">6 minutes minimum, Radius featured throughout.</p>
              <div className="mt-5 border-t border-black/8 pt-5">
                <h4 className="font-bold">+ Coordinated companion clips</h4>
                <p className="mt-1 text-sm leading-relaxed text-[#46554c]">Teasers, cut-downs, or standalone shorts that work alongside the long-form.</p>
              </div>
            </div>
            <div className="rounded-3xl border border-black/8 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="inline-block rounded-full bg-[var(--gold)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a7a3a]">Path B · Short-form</div>
              <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight">8 standalone shorts</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#46554c]">Each one features Radius. A mix of demos, tips, and casual mentions is great.</p>
              <div className="mt-5 border-t border-black/8 pt-5">
                <h4 className="font-bold">Built for Reels / TikTok / Shorts</h4>
                <p className="mt-1 text-sm leading-relaxed text-[#46554c]">If short-form is your bread and butter, this path probably fits better.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* why it works */}
      <section className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div className="pointer-events-none absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.1),transparent_64%)]" />
        <div className="relative mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Why it works</div>
          <p className="text-lg leading-relaxed text-[var(--text-body)]">
            You get paid up front. Your audience gets a real discount on a tool we built for them. And
            we get to put Radius in front of people who already trust your judgment. The disc golf
            community is small, and the players who lead it matter more than ad spend ever will.
          </p>
        </div>
      </section>

      {/* apply form */}
      <section id="apply" className="bg-[#faf8f3]">
        <div className="mx-auto max-w-xl px-6 py-20 md:py-24">
          <div className="text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">Apply</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em]">Become a Radius Creator</h2>
            <p className="mx-auto mt-3 max-w-md text-[#46554c]">Tell us about you and your channel. If it&apos;s a fit, we&apos;ll be in touch within a few days to line up an offer for your audience.</p>
          </div>
          <form action="https://formsubmit.co/info@radiusdiscgolf.com" method="POST" className="mt-10 rounded-3xl border border-black/8 bg-white p-7 shadow-sm">
            <input type="hidden" name="_subject" value="New Creator Partner Application" />
            <input type="hidden" name="_captcha" value="false" />
            <input type="hidden" name="_template" value="table" />
            <input type="hidden" name="_next" value="https://radiusdiscgolf.com/creators.html?submitted=1" />

            <div className="space-y-4">
              <FormField label="Name" name="Name" placeholder="Your name" required />
              <FormField label="Email" name="Email" type="email" placeholder="you@example.com" required />
              <SelectField label="Primary platform" name="Primary platform" placeholder="Choose one" options={["YouTube", "Instagram", "TikTok", "Mix of platforms"]} required />
              <SelectField label="Audience size" name="Audience size" placeholder="Choose a range" options={["Under 1,000 — please don't apply yet", "1K–5K", "5K–10K", "10K–25K", "25K–50K", "50K–100K", "100K+"]} required />
              <FormField label="Channel link or @handle" name="Channel link or handle" placeholder="https://youtube.com/@yourchannel or @yourhandle" required />
              <SelectField label="Path preference" name="Path preference" placeholder="Choose a path" options={["Path A — Long-form + shorts", "Path B — Shorts only", "Not sure yet — open to either"]} required />
              <FormField label="PDGA number (optional)" name="PDGA number" placeholder="e.g. 123456" />
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">Why Radius?</label>
                <textarea name="Why Radius" required rows={4} placeholder="Tell us why Radius is a fit for you and your audience." className="w-full resize-none rounded-xl border border-black/10 bg-[#faf8f3] px-4 py-3 text-sm text-[#16221b] placeholder-[#8a968d] outline-none transition-colors focus:border-[var(--gold)]" />
              </div>
              <button type="submit" className="w-full rounded-full bg-[var(--gold)] px-6 py-4 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">Send application</button>
              <p className="text-center text-xs text-[#8a968d]">We&apos;ll only use this to evaluate the partnership. No newsletters, no spam.</p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function FormField({ label, name, ...props }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">{label}</label>
      <input name={name} {...props} className="w-full rounded-xl border border-black/10 bg-[#faf8f3] px-4 py-3 text-sm text-[#16221b] placeholder-[#8a968d] outline-none transition-colors focus:border-[var(--gold)]" />
    </div>
  );
}

function SelectField({ label, name, placeholder, options, required }: { label: string; name: string; placeholder: string; options: string[]; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">{label}</label>
      <select name={name} required={required} defaultValue="" className="w-full rounded-xl border border-black/10 bg-[#faf8f3] px-4 py-3 text-sm text-[#16221b] outline-none focus:border-[var(--gold)]">
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
