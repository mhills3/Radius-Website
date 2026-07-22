"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { createLeague, getMyLeagues, getAllLeagues, getUpcomingEvents, getEntries, getCourseCovers, LEAGUE_FORMATS, START_FORMATS, type League, type LeagueEvent, type EventEntry } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { inputCls, FieldLabel, SectionTitle, Segmented, btnGold, btnGhost, card, cardHover, plural, pluralWord, IconCalendar, IconDisc } from "@/components/leagues/ui";

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };


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
/** Card photo strip: course cover with dissolve-into-card gradients, contour
    fallback when no photo exists or the URL is dead, frosted date chip overlay. */
function CourseStrip({ url, ms }: { url?: string; ms: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const d = new Date(ms);
  return (
    <div className="relative h-[120px] overflow-hidden sm:h-auto sm:min-h-[132px]">
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1E2E26 0%, #1A2821 45%, #16211B 100%)" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(420px 200px at 20% 0%, rgba(45,74,62,.5), transparent 70%)" }} />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 440 264" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden>
          <path d="M-20 210 C 60 190, 120 230, 200 200 S 340 165, 460 195" stroke="rgba(244,241,232,.06)" />
          <path d="M-20 160 C 70 145, 130 185, 210 155 S 345 120, 460 150" stroke="rgba(244,241,232,.07)" />
          <path d="M-20 110 C 80 100, 140 135, 220 110 S 350 78, 460 102" stroke="rgba(143,189,227,.10)" />
          <path d="M-20 60 C 90 58, 150 88, 230 65 S 355 38, 460 58" stroke="rgba(232,181,96,.08)" />
        </svg>
      </div>
      {url && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`} />
      )}
      <div aria-hidden className="absolute inset-0 bg-[rgba(20,27,22,0.25)]" />
      <div aria-hidden className="absolute inset-0 hidden sm:block" style={{ background: "linear-gradient(90deg, transparent 55%, rgba(23,32,25,.92) 100%)" }} />
      <div aria-hidden className="absolute inset-0 sm:hidden" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(23,32,25,.92) 100%)" }} />
      <div className="absolute left-3 top-3 min-w-[46px] rounded-xl border border-[var(--hair)] bg-[rgba(20,27,22,0.85)] px-2 py-1.5 text-center backdrop-blur-[6px]">
        <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[var(--cream-60)]">{d.toLocaleDateString(undefined, { month: "short" })}</div>
        <div className="font-mono text-[19px] font-bold leading-[1.1] text-[var(--cream)]">{d.getDate()}</div>
      </div>
    </div>
  );
}

type UpNext = { href: string; name: string; courseName?: string; date: number } | null;

function Calendar({ eventDays, selected, onSelect, initial, upNext }: { eventDays: Map<string, number>; selected: string | null; onSelect: (k: string | null) => void; initial: Date; upNext: UpNext }) {
  const [view, setView] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const today = initial;
  const y = view.getFullYear(), m = view.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const lead = new Date(y, m, 1).getDay();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const monthCount = [...eventDays.entries()].reduce((acc, [k, n]) => (k.startsWith(`${y}-${m}-`) ? acc + n : acc), 0);
  const nd = upNext ? new Date(upNext.date) : null;
  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between">
        <div className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--cream)]">{MONTH_LONG[m]}<span className="ml-[7px] font-mono text-[13px] font-normal text-[var(--cream-38)]">{y}</span></div>
        <div className="flex gap-2">
          <button onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Previous month" className="grid h-[30px] w-[30px] place-items-center rounded-full border border-[var(--hair)] text-sm leading-none text-[var(--cream-60)] transition-colors hover:border-[var(--hair-strong)] hover:text-[var(--cream)]">‹</button>
          <button onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Next month" className="grid h-[30px] w-[30px] place-items-center rounded-full border border-[var(--hair)] text-sm leading-none text-[var(--cream-60)] transition-colors hover:border-[var(--hair-strong)] hover:text-[var(--cream)]">›</button>
        </div>
      </div>
      <div className="mb-4 mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]"><b className="font-medium text-[var(--blue)]">{plural(monthCount, "event")}</b> this month</div>
      <div className="grid grid-cols-7 gap-[3px] text-center">
        {DAY.map((d, i) => <span key={i} className="py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--cream-38)]">{d}</span>)}
        {Array.from({ length: total }, (_, i) => {
          const offset = i - lead;
          const inMonth = offset >= 0 && offset < daysInMonth;
          const n = inMonth ? offset + 1 : offset < 0 ? prevDays + offset + 1 : offset - daysInMonth + 1;
          if (!inMonth) return <span key={`x${i}`} className="grid h-10 place-items-center rounded-[10px] font-mono text-[12.5px] text-[var(--cream-38)] opacity-40">{n}</span>;
          const k = `${y}-${m}-${n}`;
          const count = eventDays.get(k) ?? 0;
          const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === n;
          const isSel = selected === k;
          return (
            <button
              key={k}
              onClick={() => count > 0 && onSelect(isSel ? null : k)}
              disabled={count === 0 && !isSel}
              className={`relative grid h-10 place-items-center rounded-[10px] font-mono text-[12.5px] transition-colors
                ${isSel ? "bg-[var(--gold-dim)] text-[var(--gold)] shadow-[inset_0_0_0_1px_rgba(232,181,96,0.35)]"
                : isToday ? "text-[var(--cream)] shadow-[inset_0_0_0_1px_var(--hair-strong)] hover:bg-[rgba(244,241,232,0.04)]"
                : count > 0 ? "text-[var(--cream)] hover:bg-[rgba(244,241,232,0.04)]"
                : "text-[var(--cream-60)]"}`}
            >
              {n}
              {count > 0 && <span className={`absolute bottom-[5px] left-1/2 h-1 -translate-x-1/2 rounded-full ${count > 1 ? "w-3 rounded-[2px]" : "w-1"} ${isSel ? "bg-[var(--gold)]" : "bg-[var(--blue)]"}`} />}
            </button>
          );
        })}
      </div>
      {upNext && nd && (
        <Link href={upNext.href} className="group mt-4 flex items-center gap-[13px] border-t border-[var(--hair)] pt-4">
          <span className="min-w-[34px] shrink-0 text-center font-mono leading-[1.1]">
            <span className="block text-[8.5px] uppercase tracking-[0.16em] text-[var(--cream-38)]">{nd.toLocaleDateString(undefined, { month: "short" })}</span>
            <span className="mt-px block text-base font-bold text-[var(--cream)]">{nd.getDate()}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-[var(--cream)]">{upNext.name}</span>
            <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--cream-38)]">{[upNext.courseName, `${nd.toLocaleDateString(undefined, { weekday: "short" })} ${nd.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="text-[15px] text-[var(--cream-38)] transition-colors group-hover:text-[var(--cream)]">›</span>
        </Link>
      )}
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

  const [covers, setCovers] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const ids = upcoming.map((e) => e.courseId).filter((x): x is string => !!x);
    if (ids.length) getCourseCovers(ids).then(setCovers).catch(() => {});
  }, [upcoming]);

  const slugOf = useMemo(() => new Map(all.map((l) => [l.id, l.slug])), [all]);
  const eventDays = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of upcoming) { const k = dayKey(e.date); m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [upcoming]);
  const upNext = useMemo(() => {
    const e = [...upcoming].sort((a, b) => a.date - b.date).find((x) => x.date >= today.getTime() - 3600_000);
    if (!e) return null;
    const s2 = slugOf.get(e.leagueId);
    return s2 ? { href: `/leagues/${s2}/e/${e.id}`, name: e.name, courseName: e.courseName, date: e.date } : null;
  }, [upcoming, slugOf, today]);

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
      {/* Compact page header — one hairline, ends above the controls row */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--hair)] pb-6 pt-10">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-[28px] font-extrabold tracking-[-0.01em] text-[var(--cream)]">Events</h1>
          <p className="mt-1 text-sm text-[var(--cream-60)]">Leagues, weeklies, and tournaments near you.</p>
        </div>
        <div className="flex items-center gap-4">
          {tab === "Events" && <span className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--cream-38)]">{shownEvents.length} upcoming</span>}
          {user ? (
            <Link href="/leagues/new" className={`${btnGold} inline-flex h-11 items-center`}>Create an event</Link>
          ) : (
            <Link href="/login" className={`${btnGold} inline-flex h-11 items-center`}>Sign in</Link>
          )}
        </div>
      </header>

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

      {/* Controls — every control 44px, no hairline touches this row */}
      <section className="mb-6 mt-6 flex flex-wrap items-center gap-3">
        <Segmented tall options={["Events", "Leagues"]} value={tab} onChange={(t) => { setTab(t); setDayFilter(null); }} />
        <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sage-dim)]"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "Events" ? "Search events, leagues, or courses" : "Search leagues or courses"} className={`${inputCls} h-11 pl-11`} />
        </div>
      </section>

      {tab === "Events" ? (
        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Calendar eventDays={eventDays} selected={dayFilter} onSelect={setDayFilter} initial={today} upNext={upNext} />
            {dayFilter && <button onClick={() => setDayFilter(null)} className="mt-3 w-full rounded-full bg-white/[0.05] py-2 text-xs font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">Clear day filter</button>}
          </div>
          <div>
          {live && (
              <Link href={slugOf.get(live.ev.leagueId) ? `/leagues/${slugOf.get(live.ev.leagueId)}/e/${live.ev.id}` : "#"} className="relative mb-3 block overflow-hidden rounded-2xl border border-[var(--hair)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--hair-strong)]">
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
                  <div className="mt-4 flex items-center gap-6 font-mono text-[10.5px] tracking-[0.08em] text-[var(--cream-38)]">
                    <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[var(--blue)]" />The field</span>
                    <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[var(--gold)]" />You</span>
                  </div>
                </div>
              </Link>
            )}
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
                    <div className="grid sm:grid-cols-[220px_1fr]">
                      <CourseStrip url={ev.courseId ? covers.get(ev.courseId) : undefined} ms={ev.date} />
                      <div className="min-w-0 p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 truncate font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{ev.name}</div>
                          <span className="shrink-0 rounded-full border border-[var(--blue-dim)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--blue)]">{KIND_CHIP[ev.kind ?? ""] ?? "EVENT"}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[13px] text-[var(--cream-60)]">
                          {[ev.leagueName !== ev.name ? ev.leagueName : null, `${weekday(ev.date)} ${fmtTime(ev.date)}`].filter(Boolean).join(" · ")}
                        </div>
                        <div className="mt-5 flex gap-[22px]">
                          <span><span className={`block text-[15px] font-bold ${ev.buyIn ? "font-mono text-[var(--blue)]" : "text-[var(--cream)]"}`}>{ev.buyIn ? `$${ev.buyIn}` : "Free"}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Buy-in</span></span>
                          <span><span className="block text-[15px] font-bold text-[var(--cream)]">{ev.format}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Format</span></span>
                          {ev.entryCount > 0 && <span><span className="block font-mono text-[15px] font-bold text-[var(--blue)]">{ev.entryCount}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">{pluralWord(ev.entryCount, "Player")}</span></span>}
                          {ev.roundCount > 1 && <span><span className="block font-mono text-[15px] font-bold text-[var(--blue)]">{ev.roundCount}×{ev.holes}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Rounds</span></span>}
                        </div>
                        {!ev.capacity && (
                          <div className="mt-4 font-mono text-[10.5px] tracking-[0.06em] text-[var(--cream-38)]">{ev.entryCount > 0 ? <><b className="font-medium text-[var(--cream-60)]">{ev.entryCount}</b> checked in</> : "Be the first in"}</div>
                        )}
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
                    </div>
                  );
                  return slug ? (
                    <Link key={ev.id} href={`/leagues/${slug}/e/${ev.id}`} className={`${card} ${cardHover} group block overflow-hidden`}>{inner}</Link>
                  ) : (
                    <div key={ev.id} className={`${card} overflow-hidden`}>{inner}</div>
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
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">{pluralWord(l.memberCount, "member")}</div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--sage-dim)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}
