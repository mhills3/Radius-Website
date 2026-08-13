"use client";

import { type DecodedRound } from "@/lib/rounds";
import { flightMapImageUrl } from "@/lib/flightMap";
import DiscGraphic from "@/components/bag/DiscGraphic";

const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const scoreColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "#F4F1E8" : "#E8B560");
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export type BagDisc = { photoUrl?: string; color: string; speed?: number };

/** A round preview card matching the iOS scorecard card: course · date · holes header, a cover-photo
 *  (or flight-map) band, big to-par on the left, strokes + birdies + the round's top discs on the right
 *  (real photo when the user has one, otherwise the disc's bag flight plate). */
export default function RoundPreviewCard({ round, cover, onClick, discMap }: { round: DecodedRound; cover?: string; onClick?: () => void; discMap?: Map<string, BagDisc> }) {
  const played = round.holes.filter((h) => h.played);
  const birdies = played.filter((h) => h.score - h.par < 0).length;
  const rel = round.relativeToPar;
  // Top 3 discs by throw count this round (excluding the "Score"/"Throw" placeholders).
  const counts = new Map<string, number>();
  for (const h of played) for (const t of h.throws) { if (t.discName === "Score" || t.discName === "Throw" || !t.discName) continue; counts.set(t.discName, (counts.get(t.discName) ?? 0) + 1); }
  const topDiscs = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  // GPS rounds show a satellite flight map behind the card; otherwise the course cover.
  const media = flightMapImageUrl(round, 760, 300) ?? cover;

  return (
    <button onClick={onClick} className="group block w-full overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#141d16] text-left transition-colors hover:border-white/[0.12]">
      {/* header */}
      <div className="px-5 py-3.5">
        <span className={`${HEAD} text-[19px] font-bold text-[#F4F1E8]`}>{round.courseName}</span>
        <span className="text-[15px] text-[#7C8B80]" style={MONO}> · {fmtDate(round.date)} · {round.holesPlayed} holes</span>
      </div>
      {/* media — shorter so two rounds fit above the fold; soft top edge blends into the header, corner
          scrims keep the score/strokes legible on any photo */}
      <div className="relative h-[116px] w-full overflow-hidden bg-[radial-gradient(circle_at_35%_30%,#2E4034,#16211B)]">
        {media && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, #141d16 0%, rgba(20,29,22,0) 22%), linear-gradient(to top, rgba(15,23,18,0.88) 0%, rgba(15,23,18,0.28) 26%, transparent 52%)" }} />
        {/* score left — vertically centered, mono */}
        <div className="absolute left-5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          <span className="text-[40px] font-bold leading-none tracking-[-0.02em] drop-shadow" style={{ ...MONO, color: scoreColor(rel) }}>{fmtToPar(rel)}</span>
          {rel < 0 && <svg viewBox="0 0 12 12" className="h-3 w-3" style={{ marginTop: -16 }}><title>Under par</title><polygon points="6,1 11,10 1,10" fill="#5fcf80" /></svg>}
        </div>
        {/* total + birdies + discs right */}
        <div className="absolute bottom-3.5 right-5 text-right">
          <div className="text-[36px] font-bold leading-none tracking-[-0.02em] text-white drop-shadow" style={MONO}>{round.total}</div>
          {birdies > 0 && <div className="mt-1 text-[14px] text-white/85 drop-shadow" style={MONO}>{birdies} birdie{birdies === 1 ? "" : "s"}</div>}
          {topDiscs.length > 0 && (
            <div className="mt-2 flex justify-end">
              {topDiscs.map(([name, n], i) => {
                const d = discMap?.get(name.trim().toLowerCase());
                return (
                  <span key={name} className="relative" style={{ marginLeft: i ? -10 : 0, zIndex: 3 - i }} title={`${name} · ${n}×`}>
                    {d?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-[#0F1712]" />
                    ) : (
                      <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full ring-2 ring-[#0F1712]"><DiscGraphic color={d?.color ?? "#8a968d"} speed={d?.speed} size={32} /></span>
                    )}
                    <span className="absolute -bottom-1 -right-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[#0F1712] px-[3px] text-[9px] font-bold text-white ring-1 ring-white/10" style={MONO}>{n}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
