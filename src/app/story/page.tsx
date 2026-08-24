import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Our Story",
  description: "Why Radius exists and the vision behind it — bringing every scattered piece of disc golf into one connected home.",
  alternates: { canonical: "https://radiusdiscgolf.com/story" },
};

const ARTICLE = [
  "It started small. I just wanted to figure out which discs to throw, and when. The disc world is endlessly deep — all that optimization and customization — and when you're learning, it's genuinely overwhelming. So I started building something simple, almost like training wheels: a way to help a player understand what to throw, and why.",
  "But I couldn't stop seeing the gaps. I came from a golf background, where advanced tools, analytics, and clear pathways to improvement are just expected. In disc golf, that didn't really exist. I didn't know where I stood. I didn't know what to improve. The only real measure of progress was my final score.",
];
const ARTICLE_CONT = [
  "Every time I looked, there was another piece of disc golf that could be better, more connected, more useful. At some point it stopped being a tool for picking discs and became something much bigger — a central hub. The place you'd go for everything disc golf, in one spot.",
  "If that works, disc golf doesn't just grow — it evolves. It becomes a connected network instead of a scattered collection of people. Players learn faster because they're learning together. And from your first round to your thousandth, you have a clear roadmap and a community moving forward with you. The sport gets smarter, together.",
  "I'm building this for the player who loves this game and genuinely wants to get better — whether you're new to it with a sports background and you've caught the bug, or you're a competitor who lives for the community as much as the game. What you share isn't skill level. It's that you care.",
  "I want you to feel like you belong here — and like you're standing on the leading edge of the sport. Belonging first. Then the quiet confidence of knowing you're getting better, and you're not doing it alone.",
];
const JOURNEY = [
  { n: "01", t: "Training wheels", d: "A simple tool to tell you which disc to throw, and why." },
  { n: "02", t: "A real system", d: "Game IQ, analytics, and a clear path to actually improve." },
  { n: "03", t: "A central hub", d: "Courses, discs, scores, stats & community — one home." },
  { n: "04", t: "A connected network", d: "The whole sport, learning and growing together." },
];
const TEAM = [
  { name: "Mikey Hills", role: "Founder", img: "/team/mikey.png", size: "125%", pos: "center 26%" },
  { name: "Nick Harshaw", role: "Co-founder", img: "/team/nick.png", size: "125%", pos: "center 26%" },
  { name: "Ben Richardson", role: "Co-founder", img: "/team/ben.png", size: "125%", pos: "center 26%" },
];

export default function StoryPage() {
  return (
    <div className="bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* ===== HERO — cinematic, clean ===== */}
      <section className="relative isolate flex min-h-screen items-center justify-center overflow-hidden">
        <Image src="/course/putt.jpg" alt="" fill priority quality={90} sizes="100vw" className="-z-30 object-cover object-center opacity-[0.5]" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(to_bottom,rgba(8,13,10,0.55),rgba(8,13,10,0.3)_36%,rgba(8,13,10,0.78)_82%,var(--bg-deep))]" />

        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-28 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" /> Our story
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-[3.4rem] font-extrabold leading-[0.9] tracking-[-0.04em] drop-shadow-[0_2px_40px_rgba(0,0,0,0.6)] sm:text-7xl md:text-[6.5rem]">
            Why Radius<br />exists.
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-[rgba(245,237,225,0.86)] md:text-xl">
            The sport is incredible — but it lives in pieces. Your community, your stats, coaching, learning: all in different rooms. We&apos;re pulling them into one.
          </p>
          <div className="mt-9 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-5 backdrop-blur">
            <span className="h-9 w-9 shrink-0 rounded-full bg-[var(--bg-mid)] bg-no-repeat ring-1 ring-[var(--gold)]/40" role="img" aria-label="Mikey Hills" style={{ backgroundImage: "url(/team/mikey.png)", backgroundSize: "125%", backgroundPosition: "center 26%" }} />
            <span className="text-sm text-[var(--cream)]"><span className="font-bold">Mikey Hills</span> <span className="text-[var(--sage-dim)]">· Founder</span></span>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 text-[var(--sage-dim)]">
          <svg className="h-5 w-5 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </div>
      </section>

      {/* ===== THE BELIEF ===== */}
      <section className="relative border-t border-white/[0.06]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
          <div className="mx-auto mb-6 h-px w-10 bg-[var(--gold)]/60" />
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">The belief</div>
          <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[3.4rem]">
            Disc golf deserves{" "}
            <span className="bg-gradient-to-br from-[#f8cf80] to-[#e0a23a] bg-clip-text text-transparent">integration.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-body)]">
            Every piece already exists. We&apos;re not building one more piece — we&apos;re bringing them together so the whole sport gets smarter, together.
          </p>
        </div>
      </section>

      {/* ===== A LETTER FROM THE FOUNDER — editorial ===== */}
      <section className="border-y border-white/[0.06] bg-[#0b1310]">
        <div className="mx-auto grid max-w-5xl gap-x-14 gap-y-10 px-6 py-20 md:py-28 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">A letter from the founder</div>
            <div className="mt-5 flex items-center gap-3.5 lg:flex-col lg:items-start lg:gap-4">
              <div className="h-20 w-20 shrink-0 rounded-full bg-[var(--bg-mid)] bg-no-repeat ring-2 ring-[var(--gold)]/40" role="img" aria-label="Mikey Hills" style={{ backgroundImage: "url(/team/mikey.png)", backgroundSize: "135%", backgroundPosition: "center 26%" }} />
              <div>
                <div className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">Mikey Hills</div>
                <div className="text-sm text-[var(--sage-dim)]">Founder, Radius</div>
              </div>
            </div>
            <p className="mt-5 hidden text-sm leading-relaxed text-[var(--sage-dim)] lg:block">How a disc-picker became the home of disc golf — in his words.</p>
          </aside>

          <div className="max-w-2xl">
            <p className="mb-6 text-lg leading-[1.8] text-[rgba(245,237,225,0.86)] first-letter:float-left first-letter:mr-3 first-letter:mt-1.5 first-letter:font-[family-name:var(--font-heading)] first-letter:text-[4.5rem] first-letter:font-extrabold first-letter:leading-[0.72] first-letter:text-[var(--gold)]">{ARTICLE[0]}</p>
            {ARTICLE.slice(1).map((p) => <p key={p} className="mb-6 text-lg leading-[1.8] text-[rgba(245,237,225,0.86)]">{p}</p>)}
            <blockquote className="my-10 border-l-[3px] border-[var(--gold)] pl-6">
              <p className="font-[family-name:var(--font-heading)] text-2xl font-bold leading-snug tracking-[-0.02em] text-[var(--cream)] md:text-[1.65rem]">There was no system. No feedback loop. No real way to get better with intention.</p>
            </blockquote>
            {ARTICLE_CONT.map((p) => <p key={p} className="mb-6 text-lg leading-[1.8] text-[rgba(245,237,225,0.86)]">{p}</p>)}
            <p className="mt-8 font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-[-0.02em] text-[var(--gold)]">That&apos;s why Radius exists.</p>
          </div>
        </div>
      </section>

      {/* ===== THE JOURNEY — timeline ===== */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="text-center">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">The build</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.75rem]">From training wheels to a network</h2>
          </div>
          <div className="relative mt-16 grid gap-8 md:grid-cols-4 md:gap-6">
            <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-[var(--gold)]/35 to-transparent md:block" />
            {JOURNEY.map((s) => (
              <div key={s.n} className="relative text-center md:text-left">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[var(--gold)]/40 bg-[var(--bg-deep)] font-[family-name:var(--font-heading)] text-lg font-extrabold text-[var(--gold)] shadow-[0_0_0_6px_var(--bg-deep)] md:mx-0">{s.n}</div>
                <h3 className="mt-5 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-body)]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== THE TEAM ===== */}
      <section className="relative border-t border-white/[0.06] bg-[#0b1310]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-24">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">The team</div>
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] md:text-[2.5rem]">The people behind Radius</h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--text-body)]">Nick and Ben saw the same potential in what disc golf could become — and have been part of this from the beginning.</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {TEAM.map((m) => (
              <div key={m.name} className="group flex flex-col items-center rounded-3xl border border-white/[0.07] bg-white/[0.03] p-8 transition-all hover:-translate-y-1.5 hover:border-[var(--gold)]/30 hover:bg-white/[0.05]">
                <div role="img" aria-label={m.name} className="h-28 w-28 rounded-full bg-[var(--bg-mid)] bg-no-repeat ring-2 ring-[var(--gold)]/40 transition-transform duration-300 group-hover:scale-105" style={{ backgroundImage: `url(${m.img})`, backgroundSize: m.size, backgroundPosition: m.pos }} />
                <div className="mt-5 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{m.name}</div>
                <div className="mt-1.5 rounded-full bg-[var(--gold)]/15 px-3 py-0.5 text-xs font-bold text-[var(--gold)]">{m.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAITH — verse + the heart behind it ===== */}
      <section className="relative border-t border-white/[0.06]">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center md:py-24">
          <div className="mx-auto mb-6 h-px w-10 bg-[var(--gold)]/60" />
          <blockquote>
            <p className="font-[family-name:var(--font-heading)] text-base font-medium leading-[1.6] tracking-[-0.01em] text-[rgba(245,237,225,0.82)] md:text-xl md:leading-[1.55]">
              Whom have I in heaven but You? And there is none upon earth that I desire besides You. My flesh and my heart fail; but God is the strength of my heart and my portion forever.
            </p>
          </blockquote>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Psalm 73:25–26</p>
          <div className="mx-auto my-9 h-px w-16 bg-gradient-to-r from-transparent via-[var(--gold)]/50 to-transparent" />
          <p className="mx-auto max-w-md font-[family-name:var(--font-heading)] text-base font-bold leading-[1.7] tracking-[-0.01em] text-[var(--cream)] md:text-lg">
            Even if Radius succeeds, <span className="text-[var(--gold)]">Christ is better.</span><br />
            Even if Radius fails, <span className="text-[var(--gold)]">Christ is enough.</span>
          </p>
        </div>
      </section>

      {/* ===== CTA — photo finale ===== */}
      <section className="relative isolate overflow-hidden border-t border-white/[0.06]">
        <Image src="/course/bag-walk.jpg" alt="" fill sizes="100vw" quality={90} className="-z-10 object-cover object-[center_30%] opacity-70" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(10,15,12,0.66),rgba(10,15,12,0.58)_40%,rgba(10,15,12,0.88))]" />
        <div className="relative mx-auto max-w-3xl px-6 py-28 text-center md:py-32">
          <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] drop-shadow md:text-5xl">Come be part of it.</h2>
          <p className="mx-auto mt-3 max-w-md text-[rgba(245,237,225,0.9)]">Track your game, find your people, and help push the sport forward.</p>
          <Link href="/login" className="mt-7 inline-block rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-bold text-[#16221b] shadow-[0_10px_34px_-6px_rgba(246,193,101,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">Join Free</Link>
        </div>
      </section>
    </div>
  );
}
