"use client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKS = 27; // trailing ~6 months — reads well for disc-golf cadence

function localKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function cellColor(c: number): string {
  if (c <= 0) return "rgba(255,255,255,0.05)";
  if (c === 1) return "rgba(246,193,101,0.35)";
  if (c === 2) return "rgba(246,193,101,0.65)";
  return "var(--gold)";
}

export default function RoundsHeatmap({ dates }: { dates: number[] }) {
  const counts = new Map<string, number>();
  for (const ms of dates) {
    const k = localKey(new Date(ms));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  const weeks: { key: string; count: number; inRange: boolean; firstOfMonth: boolean; month: number }[][] = [];
  const cur = new Date(start);
  while (cur <= today) {
    const week: { key: string; count: number; inRange: boolean; firstOfMonth: boolean; month: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const inRange = cur <= today;
      week.push({
        key: localKey(cur),
        count: inRange ? counts.get(localKey(cur)) ?? 0 : -1,
        inRange,
        firstOfMonth: cur.getDate() <= 7,
        month: cur.getMonth(),
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div className="w-full">
      {/* month labels */}
      <div className="mb-1 flex gap-[2px] text-[9px] text-[var(--sage-dim)]">
        {weeks.map((w, i) => {
          const showLabel = w[0].firstOfMonth && (i === 0 || weeks[i - 1][0].month !== w[0].month);
          return (
            <div key={i} className="min-w-0 flex-1 whitespace-nowrap">{showLabel ? MONTHS[w[0].month] : ""}</div>
          );
        })}
      </div>
      <div className="flex gap-[2px]">
        {weeks.map((w, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-[2px]">
            {w.map((c, j) => (
              <div key={j} className="aspect-square w-full rounded-[2px]" style={{ background: c.inRange ? cellColor(c.count) : "transparent" }} title={c.inRange && c.count > 0 ? `${c.count} round${c.count > 1 ? "s" : ""}` : undefined} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--sage-dim)]">
        Less
        {[0, 1, 2, 3].map((c) => (
          <span key={c} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: cellColor(c) }} />
        ))}
        More
      </div>
    </div>
  );
}
