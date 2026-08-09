"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getMyLeagues, getAllLeagues, getLeaguesByIds, getUpcomingEvents, getLeagueEvents, getEntries, getCourseMeta, isLeagueAdmin, registrationOpen, type CourseMeta, type League, type LeagueEvent, type EventEntry } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { inputCls, Segmented, btnGold, card, cardHover, plural, pluralWord, IconCalendar, IconTrophy, IconTarget, IconLeaf, IconUsers, IconPin, IconUser, IconLiveDot } from "@/components/leagues/ui";

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const signedUpCache = new Map<string, boolean>();
const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };


const KIND_CHIP: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  league: { label: "LEAGUE", icon: IconCalendar },
  tournament: { label: "TOURNAMENT", icon: IconTrophy },
  clinic: { label: "CLINIC", icon: IconTarget },
  cleanup: { label: "CLEANUP", icon: IconLeaf },
  social: { label: "SOCIAL", icon: IconUsers },
};


/** Month calendar with activity dots — click a marked day to filter the list. */
/** Card photo strip: course cover with dissolve-into-card gradients, contour
    fallback when no photo exists or the URL is dead, frosted date chip overlay. */
function CourseStrip({ url, isLogo, ms, distMi, noDate }: { url?: string; isLogo?: boolean; ms: number; distMi?: number | null; noDate?: boolean }) {
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
          className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${isLogo ? "object-contain p-5" : "object-cover"} ${loaded ? "opacity-100" : "opacity-0"}`} />
      )}
      {!isLogo && <div aria-hidden className="absolute inset-0 bg-[rgba(20,27,22,0.25)]" />}
      {!isLogo && <div aria-hidden className="absolute inset-0 hidden sm:block" style={{ background: "linear-gradient(90deg, transparent 55%, rgba(23,32,25,.92) 100%)" }} />}
      {!isLogo && <div aria-hidden className="absolute inset-0 sm:hidden" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(23,32,25,.92) 100%)" }} />}
      {distMi != null && (
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border border-[var(--hair)] bg-[rgba(20,27,22,0.85)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-[var(--cream-60)] backdrop-blur-[6px]">
          <IconPin className="h-3 w-3" />{distMi < 10 ? distMi.toFixed(1) : Math.round(distMi)} MI
        </span>
      )}
      {!noDate && (
        <div className="absolute left-3 top-3 min-w-[46px] rounded-xl border border-[var(--hair)] bg-[rgba(20,27,22,0.85)] px-2 py-1.5 text-center backdrop-blur-[6px]">
          <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[var(--cream-60)]">{d.toLocaleDateString(undefined, { month: "short" })}</div>
          <div className="font-mono text-[19px] font-bold leading-[1.1] text-[var(--cream)]">{d.getDate()}</div>
        </div>
      )}
    </div>
  );
}

function LiveEventTile({ ev, href, top, cid }: { ev: LeagueEvent; href: string; top: EventEntry[]; cid: string | null }) {
  return (
    <Link href={href} className="relative block overflow-hidden rounded-2xl border border-[var(--hair)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--hair-strong)]">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 300px at 80% -10%, rgba(143,189,227,.10), transparent 60%)" }} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">
            <i className="pulse-ring h-2 w-2 rounded-full bg-[var(--blue)]" />Live now
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--cream-38)]">{plural(ev.entryCount, "player")}</span>
        </div>
        <h3 className="mt-3.5 font-[family-name:var(--font-heading)] text-[19px] font-bold text-[var(--cream)]">{ev.name}</h3>
        <div className="text-[13px] text-[var(--cream-60)]">{[ev.leagueName !== ev.name ? ev.leagueName : null, ev.courseName, "Round in progress"].filter(Boolean).join(" · ")}</div>
        {top.length > 0 && (
          <div className="mt-5 border-t border-[var(--hair)]">
            {top.map((e, i) => {
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
        <div className="mt-4 text-[13px] font-semibold text-[var(--cream-60)]">Watch live scores →</div>
      </div>
    </Link>
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
  const [pastEvents, setPastEvents] = useState<LeagueEvent[]>([]);
  const [pastLoaded, setPastLoaded] = useState(false);
  const [myPast, setMyPast] = useState(false); // My events sub-toggle: Upcoming | Past
  const [tab, setTab] = useState("Events");
  const [q, setQ] = useState("");
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [today] = useState(() => new Date());
  const [cid, setCid] = useState<string | null>(null);
  const [live, setLive] = useState<{ ev: LeagueEvent; top: EventEntry[] } | null>(null);

  useEffect(() => {
    getAllLeagues().then(setAll).catch(() => {});
    getUpcomingEvents().then(setUpcoming).catch(() => {});
    // Past/results archive — lazy-loaded when the Past tab is first opened.
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

  const [courseMeta, setCourseMetaMap] = useState<Map<string, CourseMeta>>(new Map());
  useEffect(() => {
    // Cover art for every event we render — upcoming AND past. Past loads lazily, so without
    // pastEvents here their cards fell back to the contour art with no cover photo.
    const ids = [...new Set([...upcoming, ...pastEvents].map((e) => e.courseId).filter((x): x is string => !!x))];
    if (ids.length) getCourseMeta(ids).then(setCourseMetaMap).catch(() => {});
  }, [upcoming, pastEvents]);
  // Where filter: browser geolocation + radius; distance shown on cards once located.
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState(false);
  const [radiusMi, setRadiusMi] = useState(50);
  const [kindFilter, setKindFilter] = useState("all");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!typeMenuOpen) return;
    const h = (e: MouseEvent) => { if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) setTypeMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [typeMenuOpen]);
  // Scope filter (All events | My events) — lives left of the type filter on the Events tab.
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const scopeMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scopeMenuOpen) return;
    const h = (e: MouseEvent) => { if (scopeMenuRef.current && !scopeMenuRef.current.contains(e.target as Node)) setScopeMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [scopeMenuOpen]);
  // "My events" is now a scope of the Events tab (not its own top toggle).
  const myMode = tab === "Events" && scope === "mine";
  const requestLocation = () => {
    if (userLoc) { setUserLoc(null); return; }
    if (!navigator.geolocation) { setLocErr(true); return; }
    setLocBusy(true); setLocErr(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocBusy(false); },
      () => { setLocErr(true); setLocBusy(false); },
      { maximumAge: 300_000, timeout: 12_000 }
    );
  };
  const milesTo = (e: LeagueEvent): number | null => {
    if (!userLoc || !e.courseId) return null;
    const m = courseMeta.get(e.courseId);
    if (!m?.lat || !m?.lng) return null;
    const toR = (x: number) => (x * Math.PI) / 180;
    const h = Math.sin(toR(m.lat - userLoc.lat) / 2) ** 2 + Math.cos(toR(userLoc.lat)) * Math.cos(toR(m.lat)) * Math.sin(toR(m.lng - userLoc.lng) / 2) ** 2;
    return 2 * 3958.8 * Math.asin(Math.sqrt(h));
  };

  const slugOf = useMemo(() => new Map(all.map((l) => [l.id, l.slug])), [all]);
  const logoOf = useMemo(() => new Map(all.filter((l) => l.logoUrl).map((l) => [l.id, l.logoUrl!])), [all]);
  // Spectator surface: everything currently in progress, registration state irrelevant.
  const liveEvents = useMemo(() => {
    const t = today.getTime();
    return upcoming.filter((e) => e.status !== "complete" && e.date <= t && t <= e.date + 6 * 3600_000 && e.entryCount > 0);
  }, [upcoming, today]);
  const [liveBoards, setLiveBoards] = useState<Map<string, EventEntry[]>>(new Map());
  useEffect(() => {
    if (tab !== "Live now" || liveEvents.length === 0) return;
    let dead = false;
    Promise.all(liveEvents.slice(0, 12).map(async (e) => {
      const en = await getEntries(e.id).catch(() => [] as EventEntry[]);
      const scored = en.filter((x) => (typeof x.score === "number" || x.holeScores?.some((h) => h > 0)) && !x.dnf)
        .sort((a, b) => ((a.score ?? a.holeScores!.reduce((p, c) => p + c, 0)) + (a.penalty ?? 0)) - ((b.score ?? b.holeScores!.reduce((p, c) => p + c, 0)) + (b.penalty ?? 0)));
      return [e.id, scored.slice(0, 3)] as const;
    })).then((pairs) => { if (!dead) setLiveBoards(new Map(pairs)); });
    return () => { dead = true; };
  }, [tab, liveEvents]);

  const calendarSource = useMemo(() => (myMode ? upcoming : upcoming.filter((e) => registrationOpen(e))), [myMode, upcoming]);
  const eventDays = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of calendarSource) { const k = dayKey(e.date); m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [calendarSource]);
  const upNext = useMemo(() => {
    const e = [...calendarSource].sort((a, b) => a.date - b.date).find((x) => x.date >= today.getTime() - 3600_000);
    if (!e) return null;
    const s2 = slugOf.get(e.leagueId);
    return s2 ? { href: `/leagues/${s2}/e/${e.id}`, name: e.name, courseName: e.courseName, date: e.date } : null;
  }, [calendarSource, slugOf, today]);

  // My events = events you run OR are signed up for (checked in).
  const [signedUp, setSignedUp] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!myMode || !cid || upcoming.length === 0) return;
    let dead = false;
    (async () => {
      const { fsGet } = await import("@/lib/firestoreRest");
      const hits = await Promise.all(upcoming.map(async (e) => {
        const key = `${e.id}_${cid}`;
        if (!signedUpCache.has(key)) signedUpCache.set(key, !!(await fsGet(`leagueEvents/${e.id}/entries/${cid}`, ["checkedInAt"])));
        return signedUpCache.get(key) ? e.id : null;
      }));
      if (!dead) setSignedUp(new Set(hits.filter((x): x is string => !!x)));
    })();
    return () => { dead = true; };
  }, [tab, cid, upcoming]);
  const adminLeagueIds = useMemo(() => new Set(mine.filter((l) => isLeagueAdmin(l, cid)).map((l) => l.id)), [mine, cid]);
  // My events surfaces leagues you're CHECKED INTO too (not just ones you admin),
  // so a player who signed up on any device sees the league here (matches iOS).
  const [memberLeagues, setMemberLeagues] = useState<League[]>([]);
  useEffect(() => {
    if (!myMode) return;
    const memberLeagueIds = [...new Set(upcoming.filter((e) => signedUp.has(e.id)).map((e) => e.leagueId))]
      .filter((id) => !mine.some((l) => l.id === id));
    if (memberLeagueIds.length === 0) { setMemberLeagues([]); return; }
    let dead = false;
    getLeaguesByIds(memberLeagueIds).then((ls) => { if (!dead) setMemberLeagues(ls); }).catch(() => {});
    return () => { dead = true; };
  }, [tab, upcoming, signedUp, mine]);
  // My events → Past: completed events from the leagues you run or belong to (lazy).
  useEffect(() => {
    if (!myMode || !myPast || pastLoaded) return;
    const ids = [...new Set([...mine.map((l) => l.id), ...memberLeagues.map((l) => l.id)])];
    if (ids.length === 0) { setPastLoaded(true); return; }
    Promise.all(ids.map((id) => getLeagueEvents(id).catch(() => [] as LeagueEvent[]))).then((lists) => {
      const seen = new Set<string>();
      const past = lists.flat().filter((e) => e.status === "complete" && !seen.has(e.id) && seen.add(e.id)).sort((a, b) => b.date - a.date);
      setPastEvents(past); setPastLoaded(true);
    }).catch(() => setPastLoaded(true));
  }, [tab, myPast, pastLoaded, mine, memberLeagues]);
  // Private events never enter the public feed, so pull them for leagues you run.
  const [privateMine, setPrivateMine] = useState<LeagueEvent[]>([]);
  useEffect(() => {
    if (!myMode || adminLeagueIds.size === 0) { setPrivateMine([]); return; }
    let dead = false;
    Promise.all([...adminLeagueIds].map((id) => getLeagueEvents(id).catch(() => [] as LeagueEvent[]))).then((lists) => {
      if (dead) return;
      const nowMs = Date.now();
      const seen = new Set(upcoming.map((e) => e.id));
      setPrivateMine(lists.flat().filter((e) => e.isPrivate && e.status === "scheduled" && e.date >= nowMs - 6 * 3600_000 && !seen.has(e.id)));
    });
    return () => { dead = true; };
  }, [tab, adminLeagueIds, upcoming]);

  const needle = q.trim().toLowerCase();
  // Public feed hides events past their registration close; entrants/admins keep them under My events.
  const myPastView = myMode && myPast;
  const tabEvents = myMode
    ? (myPast
        ? pastEvents
        : [...upcoming.filter((e) => adminLeagueIds.has(e.leagueId) || signedUp.has(e.id)), ...privateMine]
            .sort((a, b) => a.date - b.date))
    : upcoming.filter((e) => registrationOpen(e));
  const shownEvents = tabEvents.filter((e) =>
    (!dayFilter || dayKey(e.date) === dayFilter)
    && (kindFilter === "all" || (e.kind ?? "league") === kindFilter)
    && (!needle || `${e.name} ${e.leagueName} ${e.courseName ?? ""}`.toLowerCase().includes(needle))
    && (!userLoc || (milesTo(e) ?? Infinity) <= radiusMi)
  ).sort((a, b) => myPastView ? b.date - a.date : ((userLoc ? (milesTo(a) ?? Infinity) - (milesTo(b) ?? Infinity) : 0) || a.date - b.date));

  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const weekday = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: "short" });


  return (
    <main className="mx-auto max-w-5xl px-5 pb-28">
      {/* Compact page header — one hairline, ends above the controls row */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--hair)] pb-6 pt-10">
        <div>
          <h1 className="flex items-center gap-2.5 font-[family-name:var(--font-heading)] text-[28px] font-extrabold tracking-[-0.01em] text-[var(--cream)]">Events<span className="rounded-full bg-[var(--gold-dim)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--gold)]">Beta</span></h1>
          <p className="mt-1 text-sm text-[var(--cream-60)]">Leagues, weeklies, and tournaments near you.</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--cream-38)]">{tab === "Live now" ? `${liveEvents.length} live` : myPastView ? `${shownEvents.length} completed` : `${shownEvents.length} upcoming`}</span>
          {user ? (
            <Link href="/leagues/new" className={`${btnGold} inline-flex h-11 items-center`}>Create an event</Link>
          ) : (
            <Link href="/login" className={`${btnGold} inline-flex h-11 items-center`}>Sign in</Link>
          )}
        </div>
      </header>

      {/* Controls — every control 44px, no hairline touches this row */}
      <section className="mb-6 mt-6 flex flex-wrap items-center gap-3">
        <Segmented tall options={["Events", "Live now"]} icons={{ Events: IconCalendar, "Live now": IconLiveDot }} value={tab} onChange={(t) => { setTab(t); setDayFilter(null); }} />
        {tab !== "Live now" && <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sage-dim)]"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, leagues, or courses" className={`${inputCls} h-11 pl-11`} />
        </div>}
      </section>

      {/* Filter rail — where (geolocation + radius) and event type; when lives in the calendar */}
      {tab !== "Live now" && <section className="-mt-2 mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={requestLocation}
          disabled={locBusy}
          className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors disabled:opacity-60 ${userLoc ? "border-[rgba(232,181,96,.4)] bg-[var(--gold-dim)] text-[var(--gold)]" : "border-[var(--hair-strong)] text-[var(--cream-60)] hover:text-[var(--cream)]"}`}
        >
          <IconPin className="h-3.5 w-3.5" />
          {locBusy ? "Locating…" : "Near me"}
          {userLoc && <span aria-hidden className="ml-0.5 text-[var(--gold)]/70">✕</span>}
        </button>
        {userLoc && (
          <span className="flex items-center gap-1">
            {[25, 50, 100].map((r) => (
              <button key={r} onClick={() => setRadiusMi(r)} className={`h-9 rounded-full px-3 font-mono text-[11.5px] font-semibold transition-colors ${radiusMi === r ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "text-[var(--cream-38)] hover:text-[var(--cream)]"}`}>{r} mi</button>
            ))}
          </span>
        )}
        {locErr && <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--cream-38)]">Location unavailable</span>}
        <span aria-hidden className="mx-1.5 h-6 w-px bg-[var(--hair)]" />
        {/* Scope filter — All events vs My events (sits left of the type filter) */}
        <div className="relative" ref={scopeMenuRef}>
          <button
            onClick={() => setScopeMenuOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={scopeMenuOpen}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${scope === "mine" || scopeMenuOpen ? "border-[rgba(232,181,96,.4)] bg-[var(--gold-dim)] text-[var(--gold)]" : "border-[var(--hair-strong)] text-[var(--cream-60)] hover:text-[var(--cream)]"}`}
          >
            <IconUser className="h-3.5 w-3.5" />
            {scope === "mine" ? "My events" : "All events"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`h-3 w-3 transition-transform ${scopeMenuOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {scopeMenuOpen && (
            <div role="listbox" className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[180px] overflow-hidden rounded-2xl border border-[var(--hair-strong)] bg-[var(--card)] p-1.5 shadow-2xl">
              {([["all", "All events", IconCalendar], ["mine", "My events", IconUser]] as const).map(([key, label, Ic]) => (
                <button
                  key={key}
                  role="option"
                  aria-selected={scope === key}
                  onClick={() => { setScope(key); setScopeMenuOpen(false); setMyPast(false); setDayFilter(null); }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors ${scope === key ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "text-[var(--cream-60)] hover:bg-white/[0.04] hover:text-[var(--cream)]"}`}
                >
                  <Ic className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {scope === key && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-[var(--gold)]"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
              ))}
            </div>
          )}
        </div>
        {(() => {
          const opts = [{ key: "all", label: "All types", Ic: null as React.ComponentType<{ className?: string }> | null }, ...Object.entries(KIND_CHIP).map(([key, v]) => ({ key, label: v.label.charAt(0) + v.label.slice(1).toLowerCase(), Ic: v.icon as React.ComponentType<{ className?: string }> | null }))];
          const active = opts.find((o) => o.key === kindFilter) ?? opts[0];
          const ActiveIc = active.Ic;
          const on = kindFilter !== "all";
          return (
            <div className="relative" ref={typeMenuRef}>
              <button
                onClick={() => setTypeMenuOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={typeMenuOpen}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${on || typeMenuOpen ? "border-[rgba(232,181,96,.4)] bg-[var(--gold-dim)] text-[var(--gold)]" : "border-[var(--hair-strong)] text-[var(--cream-60)] hover:text-[var(--cream)]"}`}
              >
                {ActiveIc && <ActiveIc className="h-3.5 w-3.5" />}
                {active.label}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`h-3 w-3 transition-transform ${typeMenuOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {typeMenuOpen && (
                <div role="listbox" className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[190px] overflow-hidden rounded-2xl border border-[var(--hair-strong)] bg-[var(--card)] p-1.5 shadow-2xl">
                  {opts.map(({ key, label, Ic }) => (
                    <button
                      key={key}
                      role="option"
                      aria-selected={kindFilter === key}
                      onClick={() => { setKindFilter(key); setTypeMenuOpen(false); }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors ${kindFilter === key ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "text-[var(--cream-60)] hover:bg-white/[0.04] hover:text-[var(--cream)]"}`}
                    >
                      {Ic ? <Ic className="h-4 w-4 shrink-0" /> : <span className="grid h-4 w-4 shrink-0 place-items-center text-[var(--cream-38)]">•</span>}
                      <span className="flex-1">{label}</span>
                      {kindFilter === key && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-[var(--gold)]"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </section>}

      {tab === "Live now" ? (
        <section className="mx-auto max-w-3xl">
          {liveEvents.length === 0 ? (
            <div className={`${card} grid place-items-center px-6 py-16 text-center`}>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--card-raised)] text-[var(--blue)]"><IconCalendar className="h-6 w-6" /></span>
              <p className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">Nothing is live right now</p>
              <p className="mt-1 max-w-xs text-sm text-[var(--sage-dim)]">When a round is in progress, its leaderboard shows here.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {liveEvents.map((ev) => {
                const slug = slugOf.get(ev.leagueId);
                return <LiveEventTile key={ev.id} ev={ev} href={slug ? `/leagues/${slug}/e/${ev.id}` : "#"} top={liveBoards.get(ev.id) ?? []} cid={cid} />;
              })}
            </div>
          )}
        </section>
      ) : (
      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Calendar eventDays={eventDays} selected={dayFilter} onSelect={setDayFilter} initial={today} upNext={upNext} />
            {dayFilter && <button onClick={() => setDayFilter(null)} className="mt-3 w-full rounded-full bg-white/[0.05] py-2 text-xs font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">Clear day filter</button>}
          </div>
          <div>
          {tab === "Events" && !myMode && liveEvents.length > 0 && (
            <button onClick={() => setTab("Live now")} className="mb-3 inline-flex items-center gap-2.5 rounded-full border border-[var(--blue-dim)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--blue)] transition-colors hover:border-[var(--blue)]/40">
              <i className="pulse-ring h-2 w-2 rounded-full bg-[var(--blue)]" />{plural(liveEvents.length, "event")} live now →
            </button>
          )}
          {live && (myMode || registrationOpen(live.ev)) && (
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
            {myMode && (
              <div className="mb-4 inline-flex rounded-full border border-[var(--hair-strong)] bg-[var(--card)] p-0.5">
                {[["Upcoming", false], ["Past", true]].map(([label, val]) => (
                  <button key={label as string} onClick={() => setMyPast(val as boolean)} className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${myPast === val ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--cream-60)] hover:text-[var(--cream)]"}`}>{label as string}</button>
                ))}
              </div>
            )}
            {shownEvents.length === 0 ? (
              <div className={`${card} grid place-items-center px-6 py-16 text-center`}>
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--card-raised)] text-[var(--blue)]"><IconCalendar className="h-6 w-6" /></span>
                <p className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{myPastView ? (pastLoaded ? "No past results yet" : "Loading past events…") : myMode ? (user ? "Nothing on your calendar" : "Sign in to see your events") : upcoming.length === 0 ? "No upcoming events" : "Nothing matches"}</p>
                <p className="mt-1 max-w-xs text-sm text-[var(--sage-dim)]">{myPastView ? "Completed events from your leagues land here — tap one for the results." : myMode ? (user ? "Events you run or are checked into show up here." : "Your check-ins and leagues land here.") : upcoming.length === 0 ? "Create one in about a minute." : "Clear the search or day filter."}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {shownEvents.map((ev) => {
                  const slug = slugOf.get(ev.leagueId);
                  const inner = (
                    <div className="grid sm:grid-cols-[220px_1fr]">
                      {(() => { const logo = logoOf.get(ev.leagueId); const d = milesTo(ev); return <CourseStrip url={logo ?? (ev.courseId ? courseMeta.get(ev.courseId)?.cover : undefined)} isLogo={!!logo} ms={ev.date} distMi={d} />; })()}
                      <div className="min-w-0 p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 truncate font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{ev.name}</div>
                          {(() => { const k = KIND_CHIP[ev.kind ?? ""]; const Ic = k?.icon; return (
                            <span className="flex shrink-0 items-center gap-1.5">
                              {ev.isPrivate && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--hair-strong)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--cream-38)]">Private</span>}
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--blue-dim)] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--blue)]">{Ic && <Ic className="h-3 w-3" />}{k?.label ?? "EVENT"}</span>
                            </span>
                          ); })()}
                        </div>
                        <div className="mt-0.5 truncate text-[13px] text-[var(--cream-60)]">
                          {[ev.leagueName !== ev.name ? ev.leagueName : null,
                            ev.roundStarts && ev.roundStarts.length > 1
                              ? ev.roundStarts.map((ms, i) => `R${i + 1} ${new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`).join(" · ")
                              : `${weekday(ev.date)} ${fmtTime(ev.date)}`,
                          ].filter(Boolean).join(" · ")}
                        </div>
                        <div className="mt-5 flex gap-[22px]">
                          <span><span className={`block text-[15px] font-bold ${ev.buyIn ? "font-mono text-[var(--blue)]" : "text-[var(--cream)]"}`}>{ev.buyIn ? `$${ev.buyIn}` : "Free"}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Buy-in</span></span>
                          <span><span className="block text-[15px] font-bold text-[var(--cream)]">{ev.format}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Format</span></span>
                          {ev.entryCount > 0 && <span><span className="block font-mono text-[15px] font-bold text-[var(--blue)]">{ev.entryCount}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">{pluralWord(ev.entryCount, "Player")}</span></span>}
                          {ev.roundCount > 1 && <span><span className="block font-mono text-[15px] font-bold text-[var(--blue)]">{ev.roundCount}×{ev.holes}</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Rounds</span></span>}
                        </div>
                        {!ev.capacity && (
                          <div className="mt-4 font-mono text-[10.5px] tracking-[0.06em] text-[var(--cream-38)]">{ev.entryCount > 0 ? <><b className="font-medium text-[var(--cream-60)]">{ev.entryCount}</b> joined</> : "Be the first to join"}</div>
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
      )}
    </main>
  );
}

