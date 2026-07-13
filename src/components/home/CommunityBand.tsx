import Link from "next/link";
import Image from "next/image";

// Community goal: 10,000 disc golfers by the end of 2026.
const GOAL = 10000;

// Counts come from the server (home page) — reliable transport, baked into the HTML.
export default function CommunityBand({ playerCount = 0, regionCount = 0 }: { playerCount?: number; regionCount?: number }) {
  const goalPct = Math.min(100, (playerCount / GOAL) * 100);
  return (
    <section id="community" className="bg-[#faf8f3] text-[#16221b]">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* photos — natural landscape, stacked & offset (no awkward cropping) */}
          <div className="order-2 lg:order-1">
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl shadow-[0_24px_60px_-30px_rgba(0,0,0,0.5)]">
              <Image src="/course/putt.jpg" alt="A player putting at the basket while a friend watches" fill sizes="(max-width:1024px) 100vw, 48vw" quality={90} className="object-cover" />
            </div>
            <div className="relative ml-auto -mt-10 aspect-[16/10] w-[78%] overflow-hidden rounded-3xl border-[5px] border-[#faf8f3] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.5)]">
              <Image src="/course/greeting.jpg" alt="Two players greeting each other with a handshake on the course" fill sizes="(max-width:1024px) 78vw, 38vw" quality={90} className="object-cover object-[center_30%]" />
            </div>
          </div>

          {/* message */}
          <div className="order-1 lg:order-2">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">
              Belong to something
            </div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[2.75rem]">
              Disc golf is better with your people.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#46554c]">
              Follow friends, share your best rounds, talk shop, and find players
              near you. Radius is where the disc golf community lives between
              throws — not just a place to keep score.
            </p>
            <div className="mt-8">
              {/* Two community numbers, prominent, split by a divider. */}
              <div className="flex items-center gap-x-8">
                {playerCount > 0 && (
                  <div>
                    <div className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-none tracking-tight">{playerCount.toLocaleString()}+</div>
                    <div className="mt-2 text-sm text-[#6b7a70]">disc golfers</div>
                  </div>
                )}
                {regionCount > 0 && (
                  <div className={playerCount > 0 ? "border-l border-black/10 pl-8" : ""}>
                    <div className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-none tracking-tight">{regionCount.toLocaleString()}</div>
                    <div className="mt-2 text-sm text-[#6b7a70]">states &amp; countries</div>
                  </div>
                )}
              </div>
              {playerCount > 0 && (
                <div className="mt-8 max-w-md">
                  <div className="flex items-baseline justify-between">
                    <div className="font-[family-name:var(--font-heading)] text-sm font-extrabold tracking-tight">Road to 10,000</div>
                    <div className="text-sm font-bold text-[#9a7a3a]">{Math.round(goalPct)}% there</div>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progress toward 10,000 disc golfers"
                    aria-valuenow={playerCount}
                    aria-valuemin={0}
                    aria-valuemax={GOAL}
                    className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#16221b]/[0.08]"
                  >
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#e3a94d,var(--gold))]" style={{ width: `${goalPct}%` }} />
                  </div>
                  <p className="mt-2.5 text-sm text-[#6b7a70]">10,000 disc golfers by the end of 2026 — every player counts.</p>
                </div>
              )}
              {/* Cross-platform note as a supporting line. */}
              <p className="mt-6 text-sm text-[#6b7a70]">
                <span className="font-[family-name:var(--font-heading)] font-extrabold text-[#16221b]">iOS · Android · Web</span> — one account, everywhere
              </p>
            </div>
            <Link
              href="/community"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#16221b] px-7 py-3.5 text-sm font-bold text-[var(--cream)] transition-all hover:-translate-y-0.5 hover:bg-[#22332a]"
            >
              See the community →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
