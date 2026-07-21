"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { createLeague, getMyLeagues, getAllLeagues, getUpcomingEvents, LEAGUE_FORMATS, START_FORMATS, type League, type LeagueEvent } from "@/lib/leagues";
import { inputCls, FieldLabel, SectionTitle, Segmented, btnGold, btnGhost, card, IconCalendar, IconPin, IconDisc } from "@/components/leagues/ui";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

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

function Emblem({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl bg-[var(--gold-dim)] font-[family-name:var(--font-heading)] font-extrabold text-[var(--gold)] ring-1 ring-[var(--gold)]/20"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >{(name || "?").charAt(0).toUpperCase()}</span>
  );
}

/** Month calendar with activity dots — click a marked day to filter the list. */
function Calendar({ eventDays, selected, onSelect, initial }: { eventDays: Set<string>; selected: string | null; onSelect: (k: string | null) => void; initial: Date }) {
  const [view, setView] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const today = initial;
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lead = first.getDay();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  return (
    <div className={`${card} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-full text-[var(--sage)] transition-colors hover:bg-white/[0.06] hover:text-[var(--cream)]">‹</button>
        <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--cream)]">{MONTH_LONG[view.getMonth()]} {view.getFullYear()}</span>
        <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-full text-[var(--sage)] transition-colors hover:bg-white/[0.06] hover:text-[var(--cream)]">›</button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DAY.map((d, i) => <span key={i} className="pb-1 text-[9px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{d}</span>)}
        {cells.map((n, i) => {
          if (n === null) return <span key={`x${i}`} />;
          const k = `${view.getFullYear()}-${view.getMonth()}-${n}`;
          const has = eventDays.has(k);
          const isToday = today.getFullYear() === view.getFullYear() && today.getMonth() === view.getMonth() && today.getDate() === n;
          const isSel = selected === k;
          return (
            <button
              key={k}
              onClick={() => has && onSelect(isSel ? null : k)}
              disabled={!has && !isSel}
              className={`relative mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition-colors
                ${isSel ? "bg-[var(--gold)] text-[#16221b]" : isToday ? "ring-1 ring-[var(--gold)]/50 text-[var(--cream)]" : has ? "text-[var(--cream)] hover:bg-white/[0.07]" : "text-[var(--sage-dim)]/50"}`}
            >
              {n}
              {has && !isSel && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--gold)]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LeaguesPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<League[]>([]);
  const [all, setAll] = useState<League[]>([]);
  const [upcoming, setUpcoming] = useState<LeagueEvent[]>([]);
  const [tab, setTab] = useState("Events");
  const [q, setQ] = useState("");
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [format, setFormat] = useState<string>(LEAGUE_FORMATS[0]);
  const [startFormat, setStartFormat] = useState<string>(START_FORMATS[0]);
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");
  const [today] = useState(() => new Date());

  useEffect(() => {
    getAllLeagues().then(setAll).catch(() => {});
    getUpcomingEvents().then(setUpcoming).catch(() => {});
  }, []);
  useEffect(() => { if (user) getMyLeagues(user.uid).then(setMine).catch(() => {}); }, [user]);

  const slugOf = useMemo(() => new Map(all.map((l) => [l.id, l.slug])), [all]);
  const eventDays = useMemo(() => new Set(upcoming.map((e) => dayKey(e.date))), [upcoming]);

  const needle = q.trim().toLowerCase();
  const shownEvents = upcoming.filter((e) =>
    (!dayFilter || dayKey(e.date) === dayFilter)
    && (!needle || `${e.name} ${e.leagueName} ${e.courseName ?? ""}`.toLowerCase().includes(needle))
  );
  const shownLeagues = (list: League[]) => (!needle ? list : list.filter((l) => `${l.name} ${l.courseName ?? ""}`.toLowerCase().includes(needle)));

  const submit = async () => {
    if (!user || !name.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const l = await createLeague(user.uid, { name, courseName: courseName.trim() || undefined, settings: { format, startFormat, description: description.trim() } });
      if (l) { setMine((m) => [l, ...m]); setAll((a) => [l, ...a]); setCreating(false); setName(""); setCourseName(""); setDescription(""); setTab("Leagues"); }
      else setErr("Couldn't create the league — are you signed in?");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create the league.");
    } finally { setBusy(false); }
  };

  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const weekday = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: "short" });

  const others = shownLeagues(all.filter((l) => !mine.some((m) => m.id === l.id)));
  const mineShown = shownLeagues(mine);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-28">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-6 pb-8 pt-14">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Radius Events</p>
          <h1 className="mt-2 font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight text-[var(--cream)]">Find your next event</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--sage)]">League nights, tournaments, and clinics — live leaderboards, honest handicaps, bag tags that move. Free for everyone.</p>
        </div>
        {user ? (
          <Link href="/leagues/new" className={btnGold}>Create an event</Link>
        ) : (
          <Link href="/login" className={btnGold}>Sign in to start a league</Link>
        )}
      </section>

      {/* Create */}
      {creating && (
        <section className={`${card} mb-10 p-6 sm:p-8`}>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--cream)]">New league</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <FieldLabel>League name</FieldLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northshore Tuesday Nights" className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <FieldLabel>Home course <span className="normal-case tracking-normal text-[var(--sage-dim)]">— optional, events can rotate</span></FieldLabel>
              <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Search or type a course" className={inputCls} />
            </label>
            <div><FieldLabel>Format</FieldLabel><Segmented options={[...LEAGUE_FORMATS]} value={format} onChange={setFormat} /></div>
            <div><FieldLabel>Start</FieldLabel><Segmented options={[...START_FORMATS]} value={startFormat} onChange={setStartFormat} /></div>
            <label className="block sm:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Buy-ins, expectations, where to meet…" className={inputCls} />
            </label>
          </div>
          {err && <p className="mt-4 text-sm text-[#f08c8c]">{err}</p>}
          <div className="mt-6 flex items-center gap-3">
            <button onClick={submit} disabled={!name.trim() || busy} className={btnGold}>{busy ? "Creating…" : "Create league"}</button>
            <button onClick={() => setCreating(false)} className={btnGhost}>Cancel</button>
          </div>
        </section>
      )}

      {/* Controls */}
      <section className="mb-8 flex flex-wrap items-center gap-3">
        <Segmented options={["Events", "Leagues"]} value={tab} onChange={(t) => { setTab(t); setDayFilter(null); }} />
        <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sage-dim)]"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "Events" ? "Search events, leagues, or courses" : "Search leagues or courses"} className={`${inputCls} pl-11`} />
        </div>
        {tab === "Events" && <span className="text-sm text-[var(--sage-dim)]"><span className="font-mono font-bold text-[var(--cream)]">{shownEvents.length}</span> event{shownEvents.length === 1 ? "" : "s"}</span>}
      </section>

      {tab === "Events" ? (
        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Calendar eventDays={eventDays} selected={dayFilter} onSelect={setDayFilter} initial={today} />
            {dayFilter && <button onClick={() => setDayFilter(null)} className="mt-3 w-full rounded-full bg-white/[0.05] py-2 text-xs font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">Clear day filter</button>}
          </div>
          <div>
            {shownEvents.length === 0 ? (
              <div className={`${card} grid place-items-center px-6 py-16 text-center`}>
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconCalendar className="h-6 w-6" /></span>
                <p className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{upcoming.length === 0 ? "No upcoming events" : "Nothing matches"}</p>
                <p className="mt-1 max-w-xs text-sm text-[var(--sage-dim)]">{upcoming.length === 0 ? "Start a league and schedule the season — it takes about a minute." : "Try clearing the search or the day filter."}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {shownEvents.map((ev) => {
                  const slug = slugOf.get(ev.leagueId);
                  const inner = (
                    <>
                      <DateBlock ms={ev.date} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--gold)]">{ev.leagueName}</div>
                        <div className="mt-0.5 truncate font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">{ev.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--sage)]">
                          {ev.courseName && <span className="inline-flex items-center gap-1.5"><IconPin className="h-3.5 w-3.5 shrink-0" /> {ev.courseName}</span>}
                          <span>{fmtTime(ev.date)}</span>
                          {ev.roundCount > 1 && <span className="text-[var(--gold)]">{ev.roundCount} rounds</span>}
                          {ev.kind && ev.kind !== "league" && <span className="uppercase tracking-wide text-[var(--sage-dim)]">{ev.kind}</span>}
                          {ev.buyIn && <span>${ev.buyIn} buy-in</span>}
                          <span>{ev.entryCount} in</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-[var(--text-body)] ring-1 ring-white/[0.06]">{weekday(ev.date)}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--sage-dim)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
                    </>
                  );
                  return slug ? (
                    <Link key={ev.id} href={`/leagues/${slug}/e/${ev.id}`} className={`${card} group flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/30`}>{inner}</Link>
                  ) : (
                    <div key={ev.id} className={`${card} flex items-center gap-4 p-4`}>{inner}</div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          {mineShown.length > 0 && (
            <section className="mb-10">
              <SectionTitle>Your leagues</SectionTitle>
              <div className="grid gap-3">{mineShown.map((l) => <LeagueCard key={l.id} l={l} mine />)}</div>
            </section>
          )}
          <section>
            <SectionTitle>All leagues</SectionTitle>
            {others.length === 0 && all.length === 0 ? (
              <div className={`${card} grid place-items-center px-6 py-16 text-center`}>
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconDisc className="h-6 w-6" /></span>
                <p className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">No leagues yet</p>
                <p className="mt-1 max-w-xs text-sm text-[var(--sage-dim)]">Be the first — your weekly crew deserves better than a spreadsheet.</p>
              </div>
            ) : others.length === 0 ? (
              <p className="text-sm text-[var(--sage-dim)]">{needle ? "No other leagues match." : "You're running every league on Radius so far. Legend."}</p>
            ) : (
              <div className="grid gap-3">{others.map((l) => <LeagueCard key={l.id} l={l} />)}</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function LeagueCard({ l, mine }: { l: League; mine?: boolean }) {
  return (
    <Link href={`/leagues/${l.slug}`} className={`${card} group flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/30`}>
      <Emblem name={l.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{l.name}</span>
          {mine && <span className="shrink-0 rounded-full bg-[var(--gold-dim)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--gold)]">Director</span>}
        </div>
        <div className="mt-0.5 truncate text-sm text-[var(--sage)]">{l.courseName || "Rotating courses"} · {l.settings.format}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-xl font-extrabold text-[var(--cream)]">{l.memberCount}</div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">member{l.memberCount === 1 ? "" : "s"}</div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--sage-dim)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}
