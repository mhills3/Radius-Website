"use client";

import { type DecodedRound } from "@/lib/rounds";
import { flightMapImageUrl } from "@/lib/flightMap";

const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const scoreColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "#F4F1E8" : "#E8B560");
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** A round preview card matching the iOS scorecard card: course · date · holes header, a cover-photo
 *  (or flight-map) band, big to-par on the left, strokes + birdies + top-disc dots on the right. */
export default function RoundPreviewCard({ round, cover, onClick }: { round: DecodedRound; cover?: string; onClick?: () => void }) {
  const played = round.holes.filter((h) => h.played);
  const birdies = played.filter((h) => h.score - h.par < 0).length;
  const rel = round.relativeToPar;
  // Top 3 discs by throw count this round (excluding the "Score"/"Throw" placeholders).
  const counts = new Map<string, number>();
  for (const h of played) for (const t of h.throws) { if (t.discName === "Score" || t.discName === "Throw" || !t.discName) continue; counts.set(t.discName, (counts.get(t.discName) ?? 0) + 1); }
  const topDiscs = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const dotColors = ["#E8B560", "#E8B560", "#E0873F"];
  // GPS rounds show a satellite flight map behind the card; otherwise the course cover.
  const media = flightMapImageUrl(round, 760, 300) ?? cover;

  return (
    <button onClick={onClick} className="group block w-full overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#141d16] text-left transition-colors hover:border-white/[0.12]">
      {/* header */}
      <div className="px-5 py-3.5">
        <span className={`${HEAD} text-[19px] font-bold text-[#F4F1E8]`}>{round.courseName}</span>
        <span className="text-[15px] text-[#7C8B80]" style={MONO}> · {fmtDate(round.date)} · {round.holesPlayed} holes</span>
      </div>
      {/* media */}
      <div className="relative h-[150px] w-full overflow-hidden bg-[radial-gradient(circle_at_35%_30%,#2E4034,#16211B)]">
        {media && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(15,23,18,0.55) 0%, rgba(15,23,18,0.12) 30%, rgba(15,23,18,0.12) 70%, rgba(15,23,18,0.55) 100%), linear-gradient(to top, rgba(15,23,18,0.55), transparent 45%)" }} />
        {/* score left */}
        <div className="absolute bottom-4 left-5 flex items-center gap-1.5">
          <span className={`${HEAD} text-[44px] font-black leading-none drop-shadow`} style={{ color: scoreColor(rel) }}>{fmtToPar(rel)}</span>
          {rel < 0 && <svg viewBox="0 0 12 12" className="h-3 w-3" style={{ marginTop: -18 }}><polygon points="6,1 11,10 1,10" fill="#5fcf80" /></svg>}
        </div>
        {/* total + birdies + discs right */}
        <div className="absolute bottom-4 right-5 text-right">
          <div className={`${HEAD} text-[40px] font-black leading-none text-white drop-shadow`}>{round.total}</div>
          {birdies > 0 && <div className="mt-1 text-[14px] text-white/85 drop-shadow" style={MONO}>{birdies} birdie{birdies === 1 ? "" : "s"}</div>}
          {topDiscs.length > 0 && (
            <div className="mt-2 flex justify-end">
              {topDiscs.map(([, n], i) => (
                <span key={i} className={`${HEAD} grid h-7 w-7 place-items-center rounded-full border-2 text-[12px] font-bold text-white`} style={{ background: "rgba(15,23,18,0.72)", borderColor: dotColors[i], marginLeft: i ? -8 : 0, zIndex: 3 - i }} title={topDiscs[i][0]}>{n}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
