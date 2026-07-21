"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { createLeague, getMyLeagues, getAllLeagues, getUpcomingEvents, getEntries, LEAGUE_FORMATS, START_FORMATS, type League, type LeagueEvent, type EventEntry } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { inputCls, FieldLabel, SectionTitle, Segmented, btnGold, btnGhost, card, cardHover, Avatar, IconCalendar, IconDisc } from "@/components/leagues/ui";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

function DateBlock({ ms }: { ms: number }) {
  const d = new Date(ms);
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--card-raised)] leading-none">
      <div className="text-center font-mono">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--cream-38)]">{MON[d.getMonth()]}</div>
        <div className="mt-0.5 text-[26px] font-bold text-[var(--cream)]">{d.getDate()}</div>
      </div>
    </div>
  );
}

const KIND_CHIP: Record<string, string> = { league: "LEAGUE", tournament: "TOURNAMENT", clinic: "CLINIC", cleanup: "CLEANUP", social: "SOCIAL" };

function Emblem({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl bg-[var(--accent-green)] font-[family-name:var(--font-heading)] font-extrabold text-[var(--cream)] ring-1 ring-[var(--hair)]"
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
                ${isSel ? "bg-[var(--gold-dim)] font-bold text-[var(--gold)]" : isToday ? "ring-1 ring-[var(--hair-strong)] text-[var(--cream)]" : has ? "text-[var(--cream)] hover:bg-[var(--card-raised)]" : "text-[var(--cream-38)]/60"}`}
            >
              {n}
              {has && !isSel && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--blue)]" />}
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
  const [cid, setCid] = useState<string | null>(null);
  const [live, setLive] = useState<{ ev: LeagueEvent; top: EventEntry[] } | null>(null);

  useEffect(() => {
    getAllLeagues().then(setAll).catch(() => {});
    getUpcomingEvents().then(setUpcoming).catch(() => {});
  }, []);
  useEffect(() => { if (user) { getMyLeagues(user.uid).then(setMine).catch(() => {}); resolveCanonicalId(user.uid).then(setCid).catch(() => {}); } }, [user]);
  // Live tile: an event is "live" when its start time has passed, it isn't done,
  // and players have checked in. Real windows only; no tile otherwise.
  useEffect(() => {
    const nowMs = Date.now();
    const liveEv = upcoming.find((e) => e.status !== "complete" && e.date <= nowMs && nowMs <= e.date + 6 * 3600_000 && e.entryCount > 0);
    if (!liveEv) { Promise.resolve().then(() => setLive(null)); return; }
    getEntries(liveEv.id).then((en) => {
      const scored = en.filter((x) => (typeof x.score === "number" || (x.holeScores?.some((h) => h > 0))) && !x.dnf)
        .sort((a, b) => ((a.score ?? a.holeScores!.reduce((p, c) => p + c, 0)) + (a.penalty ?? 0)) - ((b.score ?? b.holeScores!.reduce((p, c) => p + c, 0)) + (b.penalty ?? 0)));
      setLive({ ev: liveEv, top: scored.slice(0, 3) });
    }).catch(() => setLive(null));
  }, [upcoming]);

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
      {/* Hero — reference: rings motif, hero-grid, legend, live tile right */}
      <section className="relative overflow-hidden border-b border-[var(--hair)] pb-14 pt-[68px]">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-50">
          <svg className="absolute -top-[260px] right-[-180px]" width="900" height="900" viewBox="0 0 900 900" fill="none">
            <circle cx="450" cy="450" r="440" stroke="rgba(244,241,232,.05)" />
            <circle cx="450" cy="450" r="340" stroke="rgba(244,241,232,.06)" />
            <circle cx="450" cy="450" r="240" stroke="rgba(143,189,227,.10)" />
            <circle cx="450" cy="450" r="140" stroke="rgba(232,181,96,.12)" />
            <circle cx="450" cy="450" r="4" fill="rgba(232,181,96,.5)" />
          </svg>
        </div>
        <div className={`relative grid items-center gap-14 ${live ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--blue)]">Events</p>
            <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.06] tracking-[-0.015em] text-[var(--cream)]">Where the local scene plays.</h1>
            <p className="mt-4 max-w-[520px] text-base leading-relaxed text-[var(--cream-60)]">Leagues, weeklies, and tournaments near you. Register in one tap, pay in the app, and score live on real course maps.</p>
            <div className="mt-8 flex items-center gap-7 font-mono text-[11.5px] tracking-[0.08em] text-[var(--cream-60)]">
              <span className="flex items-center gap-2"><i className="h-[9px] w-[9px] rounded-full bg-[var(--blue)]" />The field</span>
              <span className="flex items-center gap-2"><i className="h-[9px] w-[9px] rounded-full bg-[var(--gold)]" />You</span>
            </div>
          </div>
          {live && (
            <Link href={slugOf.get(live.ev.leagueId) ? `/leagues/${slugOf.get(live.ev.leagueId)}/e/${live.ev.id}` : "#"} className="relative block overflow-hidden rounded-2xl border border-[var(--hair)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--hair-strong)]">
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 300px at 80% -10%, rgba(143,189,227,.10), transparent 60%)" }} />
              <div className="relative">
                <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">
                  <i className="pulse-ring h-2 w-2 rounded-full bg-[var(--blue)]" />Live now
                </span>
                <h3 className="mt-3.5 font-[family-name:var(--font-heading)] text-[19px] font-bold text-[var(--cream)]">{live.ev.name}</h3>
                <div className="text-[13px] text-[var(--cream-60)]">{live.ev.courseName ? `${live.ev.courseName} · ` : ""}Round in progress</div>
                {live.top.length > 0 && (
                  <div className="mt-5 border-t border-[var(--hair)]">
                    {live.top.map((e, i) => {
                      const you = cid != null && e.id === cid;
                      const total = (e.score ?? e.holeScores!.filter((h) => h > 0).reduce((p, c) => p + c, 0)) + (e.penalty ?? 0);
                      const thru = typeof e.score !== "number" ? (e.thruHole ?? e.holeScores?.filter((h) => h > 0).length) : null;
                      return (
                        <div key={e.id} className={`grid grid-cols-[34px_1fr_62px_62px] items-center border-b border-[var(--hair)] px-1 py-[11px] text-[13.5px] ${you ? "rounded-lg border-b-transparent bg-[var(--gold-dim)]" : ""}`}>
                          <span className="font-mono text-[var(--cream-38)]">{i + 1}</span>
                          <span className="flex items-center gap-2 font-semibold text-[var(--cream)]">{e.name}{you && <span className="rounded border border-[rgba(232,181,96,.4)] px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.14em] text-[var(--gold)]">You</span>}</span>
                          <span className="text-right font-mono text-xs text-[var(--cream-38)]">{thru ? `THRU ${thru}` : ""}</span>
                          <span className={`text-right font-mono font-bold ${you ? "text-[var(--gold)]" : "text-[var(--blue)]"}`}>{total}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Link>
          )}
        </div>
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
        {tab === "Events" && <span className="text-sm text-[var(--cream-38)]"><span className="font-mono font-bold text-[var(--cream)]">{shownEvents.length}</span> event{shownEvents.length === 1 ? "" : "s"}</span>}
        {user ? (
          <Link href="/leagues/new" className={btnGold}>Create an event</Link>
        ) : (
          <Link href="/login" className={btnGold}>Sign in</Link>
        )}
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
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--card-raised)] text-[var(--blue)]"><IconCalendar className="h-6 w-6" /></span>
                <p className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{upcoming.length === 0 ? "No upcoming events" : "Nothing matches"}</p>
                <p className="mt-1 max-w-xs text-sm text-[var(--sage-dim)]">{upcoming.length === 0 ? "Create one in about a minute." : "Clear the search or day filter."}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {shownEvents.map((ev) => {
                  const slug = slugOf.get(ev.leagueId);
                  const inner = (
                    <>
                      <DateBlock ms={ev.date} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 truncate font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{ev.name}</div>
                          <span className="shrink-0 rounded-full border border-[var(--blue-dim)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--blue)]">{KIND_CHIP[ev.kind ?? ""] ?? "EVENT"}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[13px] text-[var(--cream-60)]">
                          {ev.leagueName}{ev.courseName ? ` · ${ev.courseName}` : ""} · {weekday(ev.date)} {fmtTime(ev.date)}
                        </div>
                        <div className="mt-5 flex gap-[22px]">
                          <span><span className={`block text-[15px] font-bold text-[var(--cream)] ${ev.buyIn ? "font-mono" : ""}`}>{ev.buyIn ? `$${ev.buyIn}` : "Free"}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Buy-in</span></span>
                          <span><span className="block text-[15px] font-bold text-[var(--cream)]">{ev.format}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Format</span></span>
                          <span><span className="block font-mono text-[15px] font-bold text-[var(--blue)]">{ev.entryCount}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Players</span></span>
                          {ev.roundCount > 1 && <span><span className="block font-mono text-[15px] font-bold text-[var(--cream)]">{ev.roundCount}×{ev.holes}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Rounds</span></span>}
                        </div>
                        {ev.capacity && (() => {
                          const pct = Math.min(100, Math.round((ev.entryCount / ev.capacity!) * 100));
                          const hot = pct >= 75;
                          return (
                            <div className="mt-4">
                              <div className="h-[3px] overflow-hidden rounded-[2px] bg-[var(--hair)]">
                                <i className={`block h-full rounded-[2px] ${hot ? "bg-[var(--gold)]" : "bg-[var(--blue)]"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="mt-2 font-mono text-[10.5px] tracking-[0.06em] text-[var(--cream-38)]"><b className="font-medium text-[var(--cream-60)]">{ev.entryCount} of {ev.capacity}</b> registered{hot ? " · filling fast" : ""}</div>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  );
                  return slug ? (
                    <Link key={ev.id} href={`/leagues/${slug}/e/${ev.id}`} className={`${card} ${cardHover} group flex items-start gap-4 p-6`}>{inner}</Link>
                  ) : (
                    <div key={ev.id} className={`${card} flex items-start gap-4 p-6`}>{inner}</div>
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
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--card-raised)] text-[var(--blue)]"><IconDisc className="h-6 w-6" /></span>
                <p className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">No leagues yet</p>
                <p className="mt-1 max-w-xs text-sm text-[var(--sage-dim)]">Start the first one from Create an event.</p>
              </div>
            ) : others.length === 0 ? (
              <p className="text-sm text-[var(--sage-dim)]">{needle ? "No other leagues match." : "You run every league on Radius so far."}</p>
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
    <Link href={`/leagues/${l.slug}`} className={`${card} ${cardHover} group flex items-center gap-4 p-6`}>
      <Emblem name={l.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{l.name}</span>
          {mine && <span className="shrink-0 rounded-full bg-[var(--gold-dim)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--gold)]">Director</span>}
        </div>
        <div className="mt-0.5 truncate text-sm text-[var(--sage)]">{l.courseName || "Rotating courses"} · {l.settings.format}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-xl font-extrabold text-[var(--blue)]">{l.memberCount}</div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">member{l.memberCount === 1 ? "" : "s"}</div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--sage-dim)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}
