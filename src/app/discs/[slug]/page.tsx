import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDiscBySlugServer, getAllDiscsServer } from "@/lib/discsServer";
import { stabilityLabel, stabilityTier, tierColor, catLabel, type DiscData } from "@/lib/discs";
import { normCat, tierFor, type FlightDisc } from "@/lib/bag";
import DiscGraphic from "@/components/bag/DiscGraphic";
import DiscVsWidget from "@/components/discs/DiscVsWidget";
import DiscBagCta from "@/components/discs/DiscBagCta";
import DiscCard from "@/components/discs/DiscCard";
import DiscReviewForm from "@/components/discs/DiscReviewForm";
import DiscMyStats from "@/components/discs/DiscMyStats";
import DiscMentions from "@/components/discs/DiscMentions";
import { getDiscReviewsServer } from "@/lib/discReviewsServer";

type Props = { params: Promise<{ slug: string }> };
const SITE = "https://radiusdiscgolf.com";
const fnum = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function toFlight(d: DiscData): FlightDisc {
  return { id: d.slug, name: d.name, brand: d.manufacturer, category: normCat(d.category), speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade, stability: d.stability, tier: tierFor(d.stability), color: d.color || "#9aa6b2", throwCount: 0, known: true, isFavorite: false };
}
function armSpeedFor(speed: number): string {
  if (speed <= 4) return "Any arm speed";
  if (speed <= 7) return "Beginner & up";
  if (speed <= 9) return "Recreational & up";
  if (speed <= 11) return "Intermediate & up";
  if (speed <= 13) return "Advanced & up";
  return "Pro-level power";
}
function useCases(category: string, stability: number): string[] {
  const c = normCat(category);
  const out: string[] = [];
  if (c === "PUTTER") out.push("Putting", "Short approaches");
  else if (c === "MIDRANGE") out.push("Approaches", "Controlled drives");
  else if (c === "FAIRWAY") out.push("Accurate drives", "Tight fairways");
  else out.push("Maximum distance");
  if (stability < -0.5) out.push("Turnovers & rollers", "Beginner-friendly", "Tailwinds");
  else if (stability > 1.5) out.push("Headwinds", "Forehands", "Flex shots");
  else out.push("Straight, dependable lines");
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = getDiscBySlugServer(slug);
  if (!d) return { title: "Disc", description: "Disc flight numbers and specs on Radius." };
  const title = `${d.manufacturer} ${d.name} — Flight Numbers & Specs`;
  const description = `${d.manufacturer} ${d.name}: Speed ${d.speed}, Glide ${d.glide}, Turn ${d.turn}, Fade ${d.fade}. A ${stabilityLabel(d.stability).toLowerCase()} ${catLabel(d.category).toLowerCase()} — flight chart, stability, and what to throw it for on Radius.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/discs/${slug}` },
    openGraph: { title: `${title} | Radius Disc Golf`, description, type: "website" },
    twitter: { card: "summary", title: `${title} | Radius Disc Golf`, description },
  };
}

export default async function DiscPage({ params }: Props) {
  const { slug } = await params;
  const d = getDiscBySlugServer(slug);
  if (!d) notFound();
  const tier = stabilityTier(d.stability);
  const color = d.color || "#9aa6b2";
  const all = getAllDiscsServer();
  const similar = all
    .filter((x) => x.slug !== d.slug && normCat(x.category) === normCat(d.category))
    .map((x) => ({ x, dist: Math.abs(x.speed - d.speed) * 2 + Math.abs(x.glide - d.glide) + Math.abs(x.turn - d.turn) + Math.abs(x.fade - d.fade) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 8)
    .map((s) => s.x);

  const reviews = await getDiscReviewsServer(slug).catch(() => []);
  const rated = reviews.filter((r) => r.rating > 0);
  const avgRating = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
  const cases = useCases(d.category, d.stability);
  const stabPos = Math.max(2, Math.min(98, ((d.stability + 5) / 10) * 100));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${d.manufacturer} ${d.name}`,
    category: `Disc Golf ${catLabel(d.category)}`,
    brand: { "@type": "Brand", name: d.manufacturer },
    url: `${SITE}/discs/${slug}`,
    description: `${d.manufacturer} ${d.name} disc golf ${catLabel(d.category).toLowerCase()} — flight numbers ${d.speed}/${d.glide}/${d.turn}/${d.fade} (${stabilityLabel(d.stability)}).`,
    additionalProperty: [
      { "@type": "PropertyValue", name: "Speed", value: d.speed },
      { "@type": "PropertyValue", name: "Glide", value: d.glide },
      { "@type": "PropertyValue", name: "Turn", value: d.turn },
      { "@type": "PropertyValue", name: "Fade", value: d.fade },
      { "@type": "PropertyValue", name: "Stability", value: stabilityLabel(d.stability) },
    ],
  };
  if (rated.length) {
    jsonLd.aggregateRating = { "@type": "AggregateRating", ratingValue: Math.round(avgRating * 10) / 10, reviewCount: rated.length, bestRating: 5, worstRating: 1 };
    jsonLd.review = rated.slice(0, 8).map((r) => ({ "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 }, author: { "@type": "Person", name: r.author }, ...(r.text ? { reviewBody: r.text } : {}), ...(r.createdAt ? { datePublished: new Date(r.createdAt).toISOString() } : {}) }));
  }

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ===== HERO ===== */}
      <div className="relative isolate overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, #16221b 72%)` }}>
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.08 }} />
        <div className="relative mx-auto max-w-6xl px-6 pb-7 pt-24">
          <Link href="/discs" className="inline-flex items-center gap-1.5 text-sm font-bold text-white/85 hover:text-white">← Disc database</Link>
          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <div className="shrink-0 drop-shadow-2xl"><DiscGraphic color={color} speed={d.speed} size={128} /></div>
            <div className="min-w-0 text-center sm:text-left">
              <div className="text-sm font-bold uppercase tracking-wide text-white/75">{d.manufacturer}</div>
              <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-white md:text-6xl">{d.name}</h1>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">{catLabel(d.category)}</span>
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${tierColor(tier)}`, color: "#16221b" }}>{stabilityLabel(d.stability)}</span>
                {rated.length > 0 && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">★ {avgRating.toFixed(1)} ({rated.length})</span>}
              </div>
            </div>
          </div>

          {/* glass flight-number bar */}
          <div className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md sm:inline-grid sm:grid-flow-col sm:auto-cols-fr">
            <HeroNum label="Speed" value={d.speed} />
            <HeroNum label="Glide" value={d.glide} />
            <HeroNum label="Turn" value={fnum(d.turn)} />
            <HeroNum label="Fade" value={fnum(d.fade)} />
          </div>
        </div>
      </div>

      {/* ===== sticky section nav ===== */}
      <div className="sticky top-16 z-30 border-b border-black/[0.07] bg-[#faf8f3]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
          {[["overview", "Overview"], ["flight", "Flight path"], ["reviews", "Reviews"], ["similar", "Similar"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="whitespace-nowrap px-3 py-3.5 text-sm font-semibold text-[#46554c] transition-colors hover:text-[#16221b]">{label}</a>
          ))}
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="mx-auto grid max-w-6xl items-start gap-8 px-6 py-8 lg:grid-cols-[1fr_336px]">
        <main className="min-w-0 space-y-10">
          {/* OVERVIEW */}
          <section id="overview" className="scroll-mt-32">
            <h2 className="mb-3 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">About this disc</h2>
            <div className="rounded-2xl border border-black/8 bg-white p-5 leading-relaxed text-[#46554c] shadow-sm">
              <p>The <strong className="text-[#16221b]">{d.manufacturer} {d.name}</strong> is a {stabilityLabel(d.stability).toLowerCase()} {catLabel(d.category).toLowerCase()} with flight numbers <strong className="text-[#16221b]">{d.speed} / {d.glide} / {fnum(d.turn)} / {fnum(d.fade)}</strong>.</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li><strong className="text-[#16221b]">Speed {d.speed}</strong> — how fast it needs to be thrown to fly correctly.</li>
                <li><strong className="text-[#16221b]">Glide {d.glide}</strong> — how long it stays aloft; higher glide = more distance for less power.</li>
                <li><strong className="text-[#16221b]">Turn {fnum(d.turn)}</strong> — tendency to turn right (RHBH) early; lower = more understable.</li>
                <li><strong className="text-[#16221b]">Fade {fnum(d.fade)}</strong> — how hard it hooks left at the end; higher = more overstable finish.</li>
              </ul>
            </div>
          </section>

          {/* your game with this disc */}
          <DiscMyStats discName={d.name} discSpeed={d.speed} />

          {/* FLIGHT + COMPARE */}
          <section id="flight" className="scroll-mt-32">
            <h2 className="mb-3 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Flight path & compare</h2>
            <DiscVsWidget self={toFlight(d)} />
          </section>

          {/* REVIEWS */}
          <section id="reviews" className="scroll-mt-32">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Reviews & community</h2>
              {rated.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5">{[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" className="h-4 w-4" fill={i < Math.round(avgRating) ? "#F6C165" : "rgba(0,0,0,0.12)"}><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.8l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" /></svg>)}</span>
                  <span className="text-sm font-bold text-[#16221b]">{avgRating.toFixed(1)}</span><span className="text-sm text-[#8a968d]">({rated.length})</span>
                </div>
              )}
            </div>
            <DiscReviewForm slug={slug} />
            {reviews.length > 0 ? (
              <div className="mt-6 space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.authorPhotoUrl ? <img src={r.authorPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : (r.author || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl border border-black/8 bg-white p-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#16221b]">{r.author}</span>
                        {r.rating > 0 && <span className="inline-flex items-center gap-0.5">{[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={i < r.rating ? "#F6C165" : "rgba(0,0,0,0.12)"}><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.8l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" /></svg>)}</span>}
                      </div>
                      {r.text && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#46554c]">{r.text}</p>}
                      <div className="mt-1.5 text-xs text-[#8a968d]">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[#8a968d]">No reviews yet — be the first to rate the {d.name}.</p>
            )}
            <DiscMentions slug={slug} />
          </section>

          {/* SIMILAR */}
          {similar.length > 0 && (
            <section id="similar" className="scroll-mt-32">
              <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Similar discs</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{similar.map((s) => <DiscCard key={s.slug} disc={s} />)}</div>
            </section>
          )}
        </main>

        {/* ===== STICKY SIDEBAR ===== */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          {/* flight numbers mini */}
          <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">Flight numbers</div>
            <div className="grid grid-cols-4 gap-2">
              {[["S", d.speed], ["G", d.glide], ["T", fnum(d.turn)], ["F", fnum(d.fade)]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-black/[0.04] py-2 text-center"><div className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-[#16221b]">{v}</div><div className="text-[9px] font-bold uppercase text-[#8a968d]">{k}</div></div>
              ))}
            </div>
            {/* stability scale */}
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wide text-[#8a968d]"><span>Understable</span><span>Overstable</span></div>
              <div className="relative h-2 rounded-full" style={{ background: "linear-gradient(90deg,#4d94fa,#1ab859,#ea8b3a,#dc2626)" }}>
                <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#16221b] shadow" style={{ left: `${stabPos}%` }} />
              </div>
              <div className="mt-1.5 text-center text-xs font-bold" style={{ color: tierColor(tier) }}>{stabilityLabel(d.stability)} · stability {fnum(d.stability)}</div>
            </div>
          </div>

          {/* best for */}
          <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">Best for</div>
            <div className="flex flex-wrap gap-1.5">{cases.map((c) => <span key={c} className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-medium text-[#46554c]">{c}</span>)}</div>
            <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 text-sm"><span className="text-[#8a968d]">Recommended arm</span><span className="font-bold text-[#16221b]">{armSpeedFor(d.speed)}</span></div>
          </div>

          {/* bag CTA — logged-out only */}
          <DiscBagCta discName={d.name} />
        </aside>
      </div>
    </div>
  );
}

function HeroNum({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-black/20 px-6 py-3 text-center">
      <div className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-none text-white">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/70">{label}</div>
    </div>
  );
}
