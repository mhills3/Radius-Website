"use client";

import { type Meetup } from "@/lib/community";

function initials(name: string) {
  return (name || "?").charAt(0).toUpperCase();
}

export default function MeetupCard({ meetup }: { meetup: Meetup }) {
  const d = meetup.dateMillis ? new Date(meetup.dateMillis) : null;
  const dateStr = d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Date TBD";
  const spotsLeft = meetup.maxPlayers ? Math.max(0, meetup.maxPlayers - meetup.playerCount) : null;
  const full = spotsLeft === 0;

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition-colors hover:border-white/[0.12]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--gold)]">{dateStr}{meetup.timeLabel ? ` · ${meetup.timeLabel}` : ""}</div>
          <h3 className="mt-1 truncate font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{meetup.courseName}</h3>
          <div className="text-sm text-[var(--sage-dim)]">hosted by {meetup.hostName}</div>
        </div>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold capitalize text-[var(--text-body)]">{meetup.skillLevel}</span>
      </div>

      {meetup.description && <p className="mt-3 line-clamp-2 text-sm text-[var(--text-body)]">{meetup.description}</p>}

      <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {meetup.playerNames.slice(0, 4).map((n, i) => (
              <span key={i} className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--bg-deep)] bg-[var(--bg-mid)] text-[10px] font-bold text-[var(--cream)]">{initials(n)}</span>
            ))}
          </div>
          <span className="ml-2.5 text-sm text-[var(--text-body)]">
            <span className="font-bold text-[var(--cream)]">{meetup.playerCount}</span>{meetup.maxPlayers ? `/${meetup.maxPlayers}` : ""} playing
          </span>
        </div>
        <span className={`text-xs font-bold ${full ? "text-[#f08c8c]" : "text-[#5fcf80]"}`}>{full ? "Full" : spotsLeft != null ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : "Open"}</span>
      </div>
    </div>
  );
}
