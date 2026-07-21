"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getLeagueBySlug, getLeagueEvents, getLeagueMembers, computeStandings, setMemberRole, isLeagueAdmin, type League, type LeagueEvent, type LeagueMember, type StandingRow } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { SectionTitle, Avatar, Pos, btnGold, card, IconPin } from "@/components/leagues/ui";

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function DateBlock({ ms }: { ms: number }) {
  const d = new Date(ms);
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--gold-dim)] leading-none">
      <div className="text-center">
        <div className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[var(--gold)]">{d.getDate()}</div>
        <div className="mt-0.5 text-[9px] font-bold tracking-[0.15em] text-[var(--gold)]/70">{MON[d.getMonth()]}</div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: LeagueEvent["status"] }) {
  const cls = status === "complete" ? "bg-white/[0.06] text-[var(--sage-dim)]"
    : status === "cancelled" ? "bg-[#f08c8c]/15 text-[#f08c8c]"
    : status === "active" ? "bg-[#5fcf80]/15 text-[#5fcf80]"
    : "bg-[var(--gold-dim)] text-[var(--gold)]";
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${cls}`}>{status}</span>;
}

export default function LeaguePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [league, setLeague] = useState<League | null | undefined>(undefined);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [cid, setCid] = useState<string | null>(null);

  useEffect(() => {
    getLeagueBySlug(slug).then((l) => {
      setLeague(l ?? null);
      if (l) {
        getLeagueEvents(l.id).then(setEvents).catch(() => {});
        getLeagueMembers(l.id).then(setMembers).catch(() => {});
        computeStandings(l.id, l.settings.bestN).then(setStandings).catch(() => {});
      }
    }).catch(() => setLeague(null));
  }, [slug]);
  useEffect(() => { if (user) resolveCanonicalId(user.uid).then(setCid).catch(() => {}); }, [user]);

  const admin = useMemo(() => !!league && isLeagueAdmin(league, cid), [league, cid]);
  const [now] = useState(() => Date.now());
  // Private events are link-only: visible on the league page to admins alone.
  const visible = events.filter((e) => !e.isPrivate || admin);
  const upcoming = visible.filter((e) => e.status !== "complete" && e.status !== "cancelled" && e.date > now - 12 * 3600_000);
  const past = visible.filter((e) => !upcoming.includes(e)).reverse();
  const photoOf = useMemo(() => new Map(members.map((m) => [m.id, m.photo])), [members]);

  if (league === undefined) return <main className="mx-auto max-w-4xl px-5 pt-16 text-sm text-[var(--sage-dim)]">Loading…</main>;
  if (league === null) return (
    <main className="mx-auto max-w-4xl px-5 pt-16">
      <p className="text-sm text-[var(--sage-dim)]">League not found. <Link href="/leagues" className="font-bold text-[var(--gold)] hover:underline">All leagues</Link></p>
    </main>
  );

  const EventRow = ({ ev }: { ev: LeagueEvent }) => (
    <Link href={`/leagues/${league.slug}/e/${ev.id}`} className={`${card} group flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/30`}>
      <DateBlock ms={ev.date} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">{ev.name}</div>
        <div className="mt-0.5 truncate text-xs text-[var(--sage)]">
          {fmtTime(ev.date)}{ev.courseName ? ` · ${ev.courseName}` : ""}{ev.roundCount > 1 ? ` · ${ev.roundCount} rounds` : ""}{ev.buyIn ? ` · $${ev.buyIn}` : ""} · {ev.entryCount} in
        </div>
      </div>
      <StatusChip status={ev.status} />
    </Link>
  );

  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);

  return (
    <main className="mx-auto max-w-4xl px-5 pb-28">
      {/* Hero */}
      <section className="pb-10 pt-14">
        <Link href="/leagues" className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]">← Events</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight text-[var(--cream)] sm:text-5xl">{league.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {league.courseName && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]"><IconPin className="h-3.5 w-3.5 shrink-0" /> {league.courseName}</span>}
              <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]">{league.settings.format}</span>
              <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]">{league.settings.startFormat}</span>
              {(league.acePotBalance ?? 0) > 0 && <span className="rounded-full bg-[var(--gold-dim)] px-3 py-1.5 text-xs font-bold text-[var(--gold)] ring-1 ring-[var(--gold)]/20">Ace pot · ${league.acePotBalance}</span>}
            </div>
            {league.settings.description && <p className="mt-4 max-w-xl whitespace-pre-wrap text-sm leading-relaxed text-[var(--sage)]">{league.settings.description}</p>}
            <p className="mt-3 text-xs text-[var(--sage-dim)]">Run by {league.createdByName} · {members.length} member{members.length === 1 ? "" : "s"}</p>
          </div>
          {admin && (
            <Link href={`/leagues/${league.slug}/manage`} className={`${btnGold} shrink-0`}>League tools</Link>
          )}
        </div>
      </section>

      {/* Settings */}
      {/* Upcoming */}
      <section className="mb-12">
        <SectionTitle>Upcoming</SectionTitle>
        {upcoming.length === 0 ? (
          <div className={`${card} px-6 py-10 text-center`}>
            <p className="text-sm text-[var(--sage-dim)]">Nothing on the calendar{admin ? " — schedule the season above." : " yet."}</p>
          </div>
        ) : (
          <div className="grid gap-3">{upcoming.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
        )}
      </section>

      {/* Standings */}
      {standings.length > 0 && (
        <section className="mb-12">
          <SectionTitle right={league.settings.bestN ? <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">best {league.settings.bestN} count</span> : undefined}>Season standings</SectionTitle>
          {top3.length > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-3">
              {[top3[1], top3[0], top3[2]].map((s, col) => s ? (
                <div key={s.id} className={`${card} relative flex flex-col items-center px-3 pb-4 text-center ${col === 1 ? "pt-5 ring-1 ring-[var(--gold)]/25" : "mt-3 pt-4"}`}>
                  <Pos n={col === 1 ? 1 : col === 0 ? 2 : 3} />
                  <Avatar url={photoOf.get(s.id)} name={s.name} size={col === 1 ? 52 : 42} />
                  <div className="mt-2 w-full truncate px-1 text-sm font-bold text-[var(--cream)]">{s.name}</div>
                  {s.division && <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{s.division}</div>}
                  <div className={`mt-1 font-mono font-extrabold ${col === 1 ? "text-2xl text-[var(--gold)]" : "text-lg text-[var(--cream)]"}`}>{s.points}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">pts · {s.played} played</div>
                </div>
              ) : <div key={col} />)}
            </div>
          )}
          {rest.length > 0 && (
            <div className={`${card} overflow-hidden`}>
              {rest.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3.5 border-b border-white/[0.05] px-4 py-3 text-sm last:border-b-0">
                  <Pos n={i + 4} />
                  <Avatar url={photoOf.get(s.id)} name={s.name} size={30} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{s.name}{s.division && <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">{s.division}</span>}</span>
                  <span className="hidden text-xs text-[var(--sage-dim)] sm:inline">{s.played} played{s.bestToPar != null ? ` · best ${fmtToPar(s.bestToPar)}` : ""}</span>
                  <span className="w-12 text-right font-mono text-base font-extrabold text-[var(--cream)]">{s.points}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section className="mb-12">
          <SectionTitle>Past events</SectionTitle>
          <div className="grid gap-3">{past.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
        </section>
      )}

      {/* Members */}
      <section>
        <SectionTitle>Members · {members.length}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] py-1.5 pl-1.5 pr-3.5 text-sm text-[var(--text-body)] ring-1 ring-white/[0.06]">
              <Avatar url={m.photo} name={m.name} size={26} ring={false} />
              {m.username ? <Link href={`/u/${m.username}`} className="font-semibold text-[var(--cream)] hover:underline">{m.name}</Link> : <span className="font-semibold text-[var(--cream)]">{m.name}</span>}
              {typeof m.tag === "number" && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--cream)]">#{m.tag}</span>}
              {m.role !== "member" && <span className="rounded-full bg-[var(--gold-dim)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--gold)]">{m.role}</span>}
              {admin && m.role !== "owner" && (
                <button
                  onClick={async () => {
                    const role = m.role === "director" ? "member" : "director";
                    await setMemberRole(league.id, m.id, role);
                    setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, role } : x)));
                    setLeague({ ...league, adminIds: role === "director" ? [...league.adminIds, m.id] : league.adminIds.filter((id) => id !== m.id) });
                  }}
                  title={m.role === "director" ? "Demote to member" : "Promote to director"}
                  className="text-[10px] font-bold text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]"
                >{m.role === "director" ? "demote" : "promote"}</button>
              )}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
