"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { EVENT_EXTRAS, registrationOpen, getLeagueBySlug, getLeagueMembers, setPartnerRequest, getEvent, getCards, checkIn, updateEntry, removeEntry, addWalkupEntry, generateCards, setEventStatus, setRoundScore, updateEventConfig, reassignBagTags, computeStandings, computeSeasonStandings, computeHandicaps, applyHandicaps, subscribeEntries, subscribeLeagueMatches, computeMatchStandings, liveTotal, isLeagueAdmin, eventPoints, EVENT_KINDS, getCourseHoles, setTeamName, getCourseMeta, type CourseMeta, randomizeTeams, setEntryTeam, setTeamScore, sendEventMessage, subscribeEventMessages, type EventMessage, type League, type LeagueEvent, type EventEntry, type EventCard, type LeagueMember, type StandingRow, type SeasonStandings, type LeagueMatch } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { SectionTitle, Avatar, Pos, btnGold, card, plural, BackLink, IconSliders, IconShare, IconClock, IconSparkles, IconMoon, IconHeart, IconTag, IconVenus, IconDollar, IconPin, IconDisc, IconEyeOff, IconUsers, IconCalendar, IconTrophy, IconTarget, IconLeaf } from "@/components/leagues/ui";

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = { league: IconCalendar, tournament: IconTrophy, clinic: IconTarget, cleanup: IconLeaf, social: IconUsers };
const EXTRA_ICON: Record<string, React.ComponentType<{ className?: string }>> = { ace_pool: IconDisc, ctp: IconTarget, bag_tags: IconTag, glow: IconMoon, beginner: IconSparkles, women: IconVenus, juniors: IconUsers, charity: IconHeart };

const warnedNames = new Set<string>();

function UserLink({ username, className, children }: { username?: string; className?: string; children: React.ReactNode }) {
  return username
    ? <Link href={`/u/${username}`} className={`${className ?? ""} transition-colors hover:underline`}>{children}</Link>
    : <span className={className}>{children}</span>;
}

function Fact({ icon: Ic, label, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-[var(--hair)] bg-[var(--card)] bg-gradient-to-b from-white/[0.045] to-transparent px-4 py-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--gold-dim)] text-[var(--gold)]"><Ic className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[var(--cream)]">{label}</span>
        {sub && <span className="block truncate text-xs text-[var(--cream-60)]">{sub}</span>}
      </span>
    </div>
  );
}
const menuItem = "block w-full rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold text-[var(--cream-60)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]";
const pillWord = "inline-flex h-8 items-center rounded-full border border-[var(--hair-strong)] bg-[rgba(20,27,22,0.45)] px-3.5 text-xs text-[var(--cream-60)] backdrop-blur-[6px]";
const pillMono = "inline-flex h-8 items-center rounded-full border border-[var(--hair-strong)] bg-[rgba(20,27,22,0.45)] px-3.5 font-mono text-[11.5px] tracking-[0.06em] text-[var(--cream-60)] backdrop-blur-[6px]";
const fmtDate = (ms: number) => { const d = new Date(ms); return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`; };
const adminInput = "rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-right font-mono text-sm text-[var(--cream)] outline-none transition-colors focus:border-[var(--gold)]";

// Renders the wizard's markdown-lite description: **bold**, _italic_, "- " bullets.
function Desc({ text }: { text: string }) {
  const inline = (line: string, key: number) => {
    const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
    return (
      <span key={key}>
        {parts.map((p, i) =>
          p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-bold text-[var(--cream)]">{p.slice(2, -2)}</strong>
          : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em>
          : p
        )}
      </span>
    );
  };
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(<ul key={`ul${out.length}`} className="my-1 list-disc space-y-0.5 pl-5">{bullets.map((b, i) => <li key={i}>{inline(b, i)}</li>)}</ul>);
      bullets = [];
    }
  };
  lines.forEach((l, i) => {
    if (l.startsWith("- ")) bullets.push(l.slice(2));
    else { flush(); if (l.trim()) out.push(<p key={`p${i}`} className="my-1">{inline(l, i)}</p>); }
  });
  flush();
  return <div className="text-sm leading-relaxed text-[var(--text-body)]">{out}</div>;
}

function StatusChip({ status, liveNow }: { status: LeagueEvent["status"]; liveNow?: boolean }) {
  const frost = "rounded-full border bg-[rgba(20,27,22,0.5)] px-[13px] py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] backdrop-blur-[6px]";
  if (liveNow || status === "active") {
    return (
      <span className={`inline-flex items-center gap-1.5 border-[rgba(143,189,227,.4)] text-[var(--blue)] ${frost}`}>
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--blue)]" /> Live
      </span>
    );
  }
  const tone = status === "cancelled" ? "text-[#f08c8c] border-[#f08c8c]/25" : "text-[var(--cream-60)] border-[var(--hair-strong)]";
  return <span className={`${frost} ${tone}`}>{status}</span>;
}

export default function LeagueEventPage() {
  const { slug, eventId } = useParams<{ slug: string; eventId: string }>();
  const { user } = useAuth();
  const [league, setLeague] = useState<League | null>(null);
  const [event, setEvent] = useState<LeagueEvent | null | undefined>(undefined);
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [cards, setCards] = useState<EventCard[]>([]);
  const [cid, setCid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cardSize, setCardSize] = useState(4);
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector("button")?.focus();
    const close = () => { setMenuOpen(false); setConfirmCancel(false); };
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && menuRef.current) {
        const items = [...menuRef.current.querySelectorAll<HTMLElement>("button")];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);
  const [division, setDivision] = useState("");
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [divFilter, setDivFilter] = useState("");
  const [editScores, setEditScores] = useState(false); // admin: reveal per-row score-entry controls; default is the live read-only board
  const [walkName, setWalkName] = useState(""); // admin: name for a walk-up / paper entrant
  const [walkDiv, setWalkDiv] = useState("");
  const [addingWalk, setAddingWalk] = useState(false);
  const [hcpNote, setHcpNote] = useState("");
  const [tab, setTab] = useState<"about" | "scores" | "standings" | "players" | "chat">("about");
  const [nowTs] = useState(() => Date.now());
  const [staff, setStaff] = useState<LeagueMember[]>([]);
  const [season, setSeason] = useState<SeasonStandings | null>(null);
  const [standingsLoaded, setStandingsLoaded] = useState(false);
  const [stView, setStView] = useState<"gross" | "net" | "team">("gross");
  const [partnerReq, setPartnerReq] = useState("");
  const [partnerSaved, setPartnerSaved] = useState(false);
  const [partnerLoaded, setPartnerLoaded] = useState(false);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [pars, setPars] = useState<number[] | null>(null);
  const [teamSize] = useState(2);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [courseMeta, setCourseMeta] = useState<CourseMeta | null>(null);
  const [coverLoaded, setCoverLoaded] = useState(false);
  useEffect(() => {
    const cId = event?.courseId;
    if (!cId) return;
    getCourseMeta([cId]).then((m) => setCourseMeta(m.get(cId) ?? null)).catch(() => {});
  }, [event?.courseId]);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);

  const reload = async (evId: string) => setCards(await getCards(evId));

  useEffect(() => {
    getLeagueBySlug(slug).then((l) => {
      setLeague(l);
      if (l) getLeagueMembers(l.id).then((ms) => setStaff(ms.filter((m) => m.role !== "member"))).catch(() => {});
    }).catch(() => {});
    getEvent(eventId).then((ev) => {
      setEvent(ev ?? null);
      if (ev) {
        reload(ev.id);
        if (ev.courseId) getCourseHoles(ev.courseId).then((hs) => {
          setPars(hs ? hs.map((h) => h.par) : null);
          if (!hs) console.warn(`[events] course ${ev.courseId} has no par data — scores render raw strokes; backfill pars to enable to-par`);
        }).catch(() => {});
      }
    }).catch(() => setEvent(null));
    const unsubEntries = subscribeEntries(eventId, setEntries);
    const unsubChat = subscribeEventMessages(eventId, setMessages);
    return () => { unsubEntries(); unsubChat(); };
  }, [slug, eventId]);
  useEffect(() => { if (user) resolveCanonicalId(user.uid).then(setCid).catch(() => {}); }, [user]);
  // Prefill the player's existing season partner request (teams/match-play leagues).
  useEffect(() => {
    if (!league?.id || !cid || partnerLoaded) return;
    getLeagueMembers(league.id).then((ms) => { setPartnerReq(ms.find((m) => m.id === cid)?.partnerRequest ?? ""); setPartnerLoaded(true); }).catch(() => setPartnerLoaded(true));
  }, [league?.id, cid, partnerLoaded]);
  const savePartner = async () => {
    if (!league || !cid) return;
    await setPartnerRequest(league.id, cid, partnerReq);
    setPartnerSaved(true); setTimeout(() => setPartnerSaved(false), 2000);
  };
  // Match-play leagues: subscribe to the season's schedule/bracket so players see it.
  useEffect(() => {
    if (!league?.id || league.settings.scoring?.model !== "matchplay") return;
    return subscribeLeagueMatches(league.id, setMatches);
  }, [league?.id, league?.settings.scoring?.model]);
  // Season standings for this event's league — computed on demand when the tab opens.
  useEffect(() => {
    if (tab !== "standings" || !league || standingsLoaded) return;
    computeSeasonStandings(league)
      .then((s) => {
        setSeason(s);
        setStandingsLoaded(true);
        // Default the view to the league's preference (net if net-only), falling back to gross.
        setStView(league.settings.scoring?.view === "net" ? "net" : "gross");
      })
      .catch(() => setStandingsLoaded(true));
  }, [tab, league, standingsLoaded]);

  const admin = useMemo(() => !!league && isLeagueAdmin(league, cid), [league, cid]);
  const me = entries.find((e) => e.id === cid);
  const points = useMemo(() => eventPoints(entries), [entries]);

  const doCheckIn = async () => {
    if (!user || !event || busy) return;
    setBusy(true);
    // Stamp the chosen division; for a single-division league use that lone division (matches iOS).
    const div = division || (divisions.length === 1 ? divisions[0] : undefined);
    try { await checkIn(user.uid, event, div); } finally { setBusy(false); }
  };

  const doGenerate = async () => {
    if (!event || busy) return;
    setBusy(true);
    try { await generateCards(event.id, entries, cardSize); await reload(event.id); } finally { setBusy(false); }
  };

  const saveScore = async (entryId: string) => {
    if (!event) return;
    const raw = scoreDraft[entryId]?.trim();
    const score = raw === "" || raw == null ? undefined : Number(raw);
    if (score != null && !Number.isFinite(score)) return;
    await updateEntry(event.id, entryId, { score });
  };

  const complete = async () => {
    if (!event || !league || busy) return;
    setBusy(true);
    try {
      // Idempotency guard: re-read the live status. reassignBagTags rotates the
      // tag ladder by finish and is NOT idempotent — a double-complete (stale
      // client, double-tap, or a second director) would rotate tags twice and
      // corrupt the ladder. Bail if it's already complete.
      const fresh = await getEvent(event.id);
      if (fresh?.status === "complete") { setEvent({ ...event, status: "complete" }); return; }
      await setEventStatus(event.id, "complete");
      setEvent({ ...event, status: "complete" });
      if (league.settings.bagTags) {
        const changes = await reassignBagTags(league, event.id);
        if (changes.length) setHcpNote("Bag tags reassigned by finish. New tags shown next to each player.");
      }
      await computeStandings(league.id, league.settings.bestN);
    } finally { setBusy(false); }
  };

  const addRound = async () => {
    if (!event || busy) return;
    setBusy(true);
    try {
      const roundCount = Math.min(event.roundCount + 1, 6);
      await updateEventConfig(event.id, { roundCount });
      setEvent({ ...event, roundCount });
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!event || busy) return;
    setBusy(true);
    try { await setEventStatus(event.id, "cancelled"); setEvent({ ...event, status: "cancelled" }); } finally { setBusy(false); }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const patchEntry = async (entryId: string, patch: Parameters<typeof updateEntry>[2]) => {
    if (!event) return;
    await updateEntry(event.id, entryId, patch);
  };

  const dropEntry = async (entryId: string) => {
    if (!event) return;
    await removeEntry(event.id, entryId);
  };

  // Director adds a walk-up / paper entrant (no app account). The live entries
  // subscription brings the new row in; we just clear the field.
  const addWalkup = async () => {
    if (!event || !walkName.trim() || addingWalk) return;
    setAddingWalk(true);
    try {
      const div = walkDiv || (divisions.length === 1 ? divisions[0] : undefined);
      await addWalkupEntry(event, walkName, div);
      setWalkName(""); setWalkDiv("");
    } finally { setAddingWalk(false); }
  };

  // Player self-leave (parity with iOS). Only before the event starts and only
  // when they haven't started scoring.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leaveSelf = async () => {
    if (!event || !cid || busy) return;
    if (!confirmLeave) { setConfirmLeave(true); return; }
    setBusy(true);
    try { await removeEntry(event.id, cid); } finally { setBusy(false); setConfirmLeave(false); }
  };

  const doHandicaps = async () => {
    if (!event || !league || busy) return;
    setBusy(true);
    try {
      const rows = await computeHandicaps(league);
      if (!rows.length) { setHcpNote("Handicaps need history. Complete two events with scored players first."); return; }
      const applied = await applyHandicaps(event.id, entries, rows);
      setHcpNote(applied ? `Applied handicaps to ${applied} player${applied === 1 ? "" : "s"}. Editable per player below.` : "Every handicap computed to zero. Nothing written.");
    } finally { setBusy(false); }
  };

  if (event === undefined) return <main className="mx-auto max-w-4xl px-5 pt-16 text-sm text-[var(--sage-dim)]">Loading…</main>;
  if (event === null) return <main className="mx-auto max-w-4xl px-5 pt-16"><p className="text-sm text-[var(--sage-dim)]">Event not found.</p></main>;

  const entryOf = (id: string) => entries.find((e) => e.id === id);
  const divisions = league?.settings.divisions ?? [];
  const shown = divFilter ? entries.filter((e) => e.division === divFilter) : entries;
  // Never render a literal "You" or an empty name: the gold YOU chip is the
  // only you-marker. Missing names fall back to Player + id tail and log once.
  const nameOf = (e: { id: string; name?: string }) => {
    const n = (e.name ?? "").trim();
    if (n && !/^you$/i.test(n)) return n;
    if (e.id === cid && user?.displayName) return user.displayName;
    if (!warnedNames.has(e.id)) { warnedNames.add(e.id); console.warn(`[events] entry ${e.id} has a missing or placeholder display name`); }
    return `Player ${e.id.slice(-4)}`;
  };
  const nameById = (id: string) => { const e = entryOf(id); return e ? nameOf(e) : `Player ${id.slice(-4)}`; };
  // Every user reference links to their public profile when a username exists.
  const usernameById = (id: string) => entryOf(id)?.username ?? staff.find((m) => m.id === id)?.username;

  const scoreOf = (e: EventEntry) => (typeof e.score === "number" ? e.score : liveTotal(e));
  const adjOf = (e: EventEntry) => scoreOf(e)! + (e.penalty ?? 0) + (e.startingScore ?? 0);
  const parTotal = pars && pars.length === event.holes ? pars.reduce((a, b) => a + b, 0) : null;
  // Numeric to-par for an entry: finished scores against full-round par, live
  // scores against the par of only the holes actually played.
  const deltaOf = (e: EventEntry) => {
    if (parTotal == null) return adjOf(e);
    if (typeof e.score === "number") {
      const roundsPlayed = e.roundScores?.filter((r) => r > 0).length || event.roundCount;
      return adjOf(e) - parTotal * roundsPlayed;
    }
    let strokes = 0, par = 0;
    (e.holeScores ?? []).forEach((h, i) => { if (h > 0) { strokes += h; par += pars![i] ?? 3; } });
    return strokes + (e.penalty ?? 0) + (e.startingScore ?? 0) - par;
  };
  const isLiveBoard = event.status === "scheduled" && entries.some((e) => typeof e.score !== "number" && e.holeScores?.some((h) => h > 0));
  const ranked = [...shown].filter((e) => scoreOf(e) != null && !e.dnf).sort((a, b) => (isLiveBoard ? deltaOf(a) - deltaOf(b) : adjOf(a) - adjOf(b)));
  const unscored = shown.filter((e) => !ranked.includes(e));
  // Signed to-par strings when real pars are loaded; raw strokes otherwise.
  const signed = (d: number) => (d === 0 ? "E" : d > 0 ? `+${d}` : String(d));
  const fmtTotal = (e: EventEntry) => (parTotal == null ? String(adjOf(e)) : signed(deltaOf(e)));
  const fmtLive = fmtTotal;
  const scoreTone = (txt: string, you: boolean) => (you ? "text-[var(--gold)]" : txt === "E" ? "text-[var(--cream-60)]" : "text-[var(--blue)]");
  const allRounds = ranked.flatMap((e) => e.roundScores?.filter((r) => r > 0) ?? []);
  const hotRound = allRounds.length
    ? (parTotal == null ? String(Math.min(...allRounds)) : (() => { const d = Math.min(...allRounds) - parTotal; return d === 0 ? "E" : d > 0 ? `+${d}` : String(d); })())
    : null;
  const anyHcp = entries.some((e) => (e.startingScore ?? 0) !== 0);
  const open = event.status !== "complete" && event.status !== "cancelled";
  // Clinics, cleanups, and socials have no scoring surface at all.
  const scoringKind = event.kind !== "clinic" && event.kind !== "cleanup" && event.kind !== "social";
  const paidCount = entries.filter((e) => e.paid).length;
  const paidOut = entries.reduce((a, e) => a + (e.payout ?? 0), 0);
  const isTeamFormat = event.format === "Doubles" || event.format === "Teams";
  const liveNow = event.status === "scheduled" && nowTs >= event.date && nowTs <= event.date + 6 * 3600_000 && entries.length > 0;
  // You JOIN a scheduled event ahead of time; check-in is the day-of action (opens 2h before start).
  const checkInPhase = nowTs >= event.date - 2 * 3600_000;
  const joinVerb = checkInPhase ? "Check in" : "Join";
  // Completion must stay reachable AFTER the 6h live window — multi-round events,
  // next-morning score entry, and backfilled weeks all finish outside it. Without
  // this the event is stuck "scheduled" forever and never enters standings/recap.
  const canComplete = scoringKind && event.status === "scheduled" && nowTs >= event.date && entries.length > 0;
  const doTeams = async () => {
    if (busy) return;
    setBusy(true);
    try { await randomizeTeams(event.id, entries, event.format === "Doubles" ? 2 : teamSize); } finally { setBusy(false); }
  };
  const sendChat = async () => {
    if (!user || !chatText.trim() || sending) return;
    setSending(true);
    try { await sendEventMessage(user.uid, event.id, chatText); setChatText(""); } finally { setSending(false); }
  };
  const isDirector = (id: string) => !!league && league.adminIds.includes(id);

  // Doubles/Teams leaderboard: entries grouped by teamId, one shared score per team.
  const renderTeamBoard = () => {
    const byTeam = new Map<number, EventEntry[]>();
    const unassigned: EventEntry[] = [];
    for (const e of shown) (e.teamId ? (byTeam.get(e.teamId) ?? byTeam.set(e.teamId, []).get(e.teamId)!) : unassigned).push(e);
    const teamScore = (members: EventEntry[]) => members.find((m) => typeof m.score === "number")?.score;
    // Live unit card: the app mirrors the shared card onto every member's entry,
    // so any member's holeScores IS the team's scorecard.
    const liveOf = (members: EventEntry[]) => members.find((m) => !m.dnf && typeof m.score !== "number" && m.holeScores?.some((h) => h > 0));
    const teams = [...byTeam.entries()]
      .map(([id, members]) => ({ id, members, score: teamScore(members), live: liveOf(members) }))
      .sort((a, b) => ((a.score ?? Infinity) - (b.score ?? Infinity)) || ((a.live ? deltaOf(a.live) : Infinity) - (b.live ? deltaOf(b.live) : Infinity)));
    const teamNumbers = [...byTeam.keys()].sort((a, b) => a - b);
    const teamSelect = (e: EventEntry) => (
      <select
        value={e.teamId ?? ""}
        onChange={(ev2) => setEntryTeam(event!.id, e.id, ev2.target.value === "" ? null : Number(ev2.target.value))}
        title="Move to team"
        className="rounded-lg border border-white/10 bg-white/[0.05] px-1.5 py-1 text-xs text-[var(--cream)] outline-none focus:border-[var(--gold)]"
      >
        <option value="">—</option>
        {[...new Set([...teamNumbers, teamNumbers.length + 1])].map((n) => <option key={n} value={n}>T{n}</option>)}
      </select>
    );
    return (
      <div className="grid gap-3">
        {teams.length === 0 && <div className={`${card} px-6 py-8 text-center text-sm text-[var(--sage-dim)]`}>No teams yet. Randomize above or assign players below.</div>}
        {teams.map((t, i) => (
          <div key={t.id} className={`${card} flex items-center gap-4 p-4 ${i === 0 && t.score != null ? "ring-1 ring-[var(--gold)]/25" : ""}`}>
            <Pos n={t.score != null || t.live ? i + 1 : undefined} />
            <span className="flex -space-x-2">
              {t.members.map((m) => <UserLink key={m.id} username={usernameById(m.id)}><Avatar url={m.photo} name={m.name} size={32} /></UserLink>)}
            </span>
            <span className="min-w-0 flex-1">
              {editingTeam === t.id ? (
                <input
                  autoFocus
                  defaultValue={event!.teamNames?.[String(t.id)] ?? ""}
                  placeholder={t.members.map((m) => nameOf(m)).join(" + ")}
                  maxLength={40}
                  onBlur={async (ev2) => { setEditingTeam(null); try { await setTeamName(event!.id, t.id, ev2.target.value); await reload(event!.id); } catch { /* noop */ } }}
                  onKeyDown={(ev2) => { if (ev2.key === "Enter") (ev2.target as HTMLInputElement).blur(); if (ev2.key === "Escape") setEditingTeam(null); }}
                  className={`${adminInput} w-full max-w-[220px] !text-left`}
                />
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="block truncate font-bold text-[var(--cream)]">{event!.teamNames?.[String(t.id)] || t.members.map((m) => nameOf(m)).join(" + ")}</span>
                  {open && (admin || t.members.some((m) => m.id === cid)) && (
                    <button onClick={() => setEditingTeam(t.id)} title="Name this team" aria-label="Name this team" className="shrink-0 text-[var(--cream-38)] transition-colors hover:text-[var(--cream)]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3 w-3"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                    </button>
                  )}
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{event!.teamNames?.[String(t.id)] ? t.members.map((m) => nameOf(m)).join(" + ") : `Team ${t.id}`}</span>
            </span>
            {t.live && (() => {
              const played = t.live!.holeScores!.map((h, hi) => ({ h, hi })).filter((x) => x.h > 0).slice(-9);
              return (
                <span className="hidden items-center gap-2.5 sm:flex">
                  <span className="flex gap-[4px]">
                    {played.map(({ h, hi }) => {
                      const par = pars?.[hi];
                      const cls = par == null ? "border-[var(--hair-strong)] text-[var(--cream-38)]"
                        : h <= par - 2 ? "border-[var(--blue)] bg-[var(--blue)] font-bold text-[#141B16]"
                        : h === par - 1 ? "border-[var(--blue)] bg-[var(--blue-dim)] text-[var(--blue)]"
                        : h === par ? "border-[var(--hair-strong)] text-[var(--cream-38)]"
                        : "border-[rgba(244,241,232,.24)] text-[var(--cream-60)]";
                      return <span key={hi} className={`grid h-4 w-4 place-items-center rounded-full border font-mono text-[8.5px] ${cls}`}>{h}</span>;
                    })}
                  </span>
                  <span className="font-mono text-xs text-[var(--cream-38)]">THRU {t.live!.thruHole ?? t.live!.holeScores!.filter((h) => h > 0).length}</span>
                  <span className={`font-mono text-base font-extrabold ${scoreTone(fmtLive(t.live!), t.members.some((m) => m.id === cid))}`}>{fmtLive(t.live!)}</span>
                </span>
              );
            })()}
            {admin && open && t.members.map((m) => <span key={m.id}>{teamSelect(m)}</span>)}
            {admin && open ? (
              <input
                key={`t${t.id}-${t.score ?? ""}`}
                inputMode="numeric"
                defaultValue={t.score ?? ""}
                placeholder="—"
                title="Team total"
                onBlur={(ev2) => {
                  const raw = ev2.target.value.trim();
                  const v = raw === "" ? undefined : Number(raw);
                  if (v === undefined || Number.isFinite(v)) setTeamScore(event!.id, t.members, v);
                }}
                onKeyDown={(ev2) => { if (ev2.key === "Enter") (ev2.target as HTMLInputElement).blur(); }}
                className={`${adminInput} w-16`}
              />
            ) : (
              <span className="w-14 text-right font-mono text-lg font-extrabold text-[var(--cream)]">{t.score ?? ""}</span>
            )}
          </div>
        ))}
        {unassigned.length > 0 && (
          <div className={`${card} p-4`}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Unassigned · {unassigned.length}</div>
            <div className="grid gap-2">
              {unassigned.map((e) => (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <UserLink username={usernameById(e.id)}><Avatar url={e.photo} name={nameOf(e)} size={26} /></UserLink>
                  <UserLink username={usernameById(e.id)} className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{nameOf(e)}</UserLink>
                  {admin && open && teamSelect(e)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="relative pb-28">
      {/* Photo hero — course cover melts into the page (reference scrim); decoration
          exists ONLY inside the no-photo contour fallback */}
      <section className="relative h-[280px] overflow-hidden md:h-[340px]">
        <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(500px 260px at 70% 30%, #2b3f2a 0%, transparent 65%), radial-gradient(420px 300px at 20% 80%, #20301f 0%, transparent 70%), linear-gradient(160deg, #233524 0%, #182618 55%, #141B16 100%)" }}>
          {!courseMeta?.cover && (
            <svg viewBox="0 0 1400 340" preserveAspectRatio="xMidYMid slice" fill="none" className="absolute inset-0 h-full w-full opacity-[0.55]">
              <path d="M-20 250 C 260 210, 520 270, 820 235 S 1250 190, 1420 220" stroke="rgba(244,241,232,.08)" />
              <path d="M-20 180 C 300 155, 560 205, 860 170 S 1260 130, 1420 155" stroke="rgba(244,241,232,.06)" />
              <path d="M200 300 C 360 240, 520 200, 700 130" stroke="rgba(232,181,96,.4)" strokeWidth="1.5" strokeDasharray="1 6" strokeLinecap="round" />
              <circle cx="200" cy="300" r="3.5" fill="rgba(232,181,96,.7)" />
              <circle cx="700" cy="130" r="5" stroke="rgba(232,181,96,.7)" />
            </svg>
          )}
        </div>
        {courseMeta?.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={courseMeta.cover} alt="" decoding="async" onLoad={() => setCoverLoaded(true)} onError={() => setCourseMeta((m) => (m ? { ...m, cover: undefined } : m))} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${coverLoaded ? "opacity-100" : "opacity-0"}`} />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(20,27,22,.45) 0%, rgba(20,27,22,.18) 35%, rgba(20,27,22,.85) 70%, #141B16 100%)" }} />
        <div className="relative z-[2] mx-auto flex h-full max-w-4xl flex-col justify-between px-5 pb-[30px] pt-7">
          <div>
            <BackLink href="/leagues" label="Events" />
          </div>
          <div>
            {event.courseName && (
              <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-[var(--cream-60)]">
                <IconPin className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium text-[var(--cream)]">{event.courseName}</span>
                {(courseMeta?.city || courseMeta?.state) && <span className="uppercase">· {[courseMeta?.city, courseMeta?.state].filter(Boolean).join(", ")}</span>}
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-4">
              <h1 className="font-[family-name:var(--font-heading)] text-[clamp(30px,3.6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.015em] text-[var(--cream)]">{event.name}</h1>
              <StatusChip status={event.status} liveNow={liveNow} />
              {open && (
                <span className="ml-auto flex flex-wrap items-center gap-2.5">
                  {!me && !registrationOpen(event, nowTs) ? (
                    <span className="inline-flex items-center rounded-full border border-[var(--hair-strong)] bg-[rgba(20,27,22,0.5)] px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--cream-38)] backdrop-blur-[6px]">Registration is closed</span>
                  ) : user ? (
                    me ? (
                      !(liveNow && cid && ranked.some((x) => x.id === cid)) && (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5fcf80]/25 bg-[rgba(20,27,22,0.5)] px-3.5 py-2 font-mono text-[10.5px] tracking-[0.08em] text-[#5fcf80] backdrop-blur-[6px]">✓ {checkInPhase ? "Checked in" : "You're in"}{divisions.length > 1 && me.division ? ` · ${me.division}` : ""}</span>
                          {open && typeof me.score !== "number" && !me.holeScores?.some((h) => h > 0) && (
                            <button onClick={leaveSelf} disabled={busy} className={`rounded-full px-2.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-colors disabled:opacity-50 ${confirmLeave ? "bg-[#f08c8c]/15 font-bold text-[#f08c8c]" : "text-[var(--cream-38)] hover:text-[#f08c8c]"}`}>{confirmLeave ? "Confirm leave" : "Leave"}</button>
                          )}
                        </span>
                      )
                    ) : (
                      <span className="flex items-center gap-2">
                        {divisions.length > 1 && (
                          <span className="relative">
                            <select value={division} onChange={(e) => setDivision(e.target.value)} className="h-12 appearance-none rounded-full border border-[var(--hair-strong)] bg-[rgba(20,27,22,0.5)] pl-5 pr-11 text-sm font-semibold text-[var(--cream)] outline-none backdrop-blur-[6px] transition-colors focus:border-[var(--gold)]">
                              <option value="">Choose division</option>
                              {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cream-38)]"><path d="M6 9l6 6 6-6" /></svg>
                          </span>
                        )}
                        <button onClick={doCheckIn} disabled={busy || (divisions.length > 1 && !division)} className={btnGold}>{busy ? "…" : joinVerb}</button>
                      </span>
                    )
                  ) : (
                    <Link href="/login" className={btnGold}>Sign in to {joinVerb.toLowerCase()}</Link>
                  )}
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <span className={`${pillMono}`}>{fmtDate(event.date)}</span>
              {(event.kind !== "clinic" && event.kind !== "cleanup") && <span className={`${pillWord}`}>{event.format} · {event.startFormat}</span>}
              {(event.kind !== "clinic" && event.kind !== "cleanup") ? (
                <span className={`${pillMono}`}>{event.roundCount > 1 ? `${event.roundCount} × ${event.holes} holes` : `${event.holes} holes`}</span>
              ) : event.durationMin ? (
                <span className={`${pillMono}`}>{event.durationMin >= 60 ? `${Math.floor(event.durationMin / 60)}h${event.durationMin % 60 ? ` ${event.durationMin % 60}m` : ""}` : `${event.durationMin} min`}</span>
              ) : null}
              {event.kind && EVENT_KINDS.find((k) => k.key === event.kind) && (
                <span className={`${pillWord} gap-1.5`}>{(() => { const Ic = KIND_ICON[event.kind!]; return Ic ? <Ic className="h-3.5 w-3.5" /> : null; })()}{EVENT_KINDS.find((k) => k.key === event.kind)!.label}</span>
              )}
              {event.buyIn ? (
                <span className={`${pillMono} border-[rgba(232,181,96,.4)] text-[var(--gold)]`}>${event.buyIn}</span>
              ) : (
                <span className={`${pillWord} border-[rgba(232,181,96,.4)] text-[var(--gold)]`}>Free</span>
              )}
              {event.isPrivate && (
                <span className={`${pillWord} gap-1.5`}><IconEyeOff className="h-3.5 w-3.5" /> Private. Link only</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-4xl px-5">
        {hcpNote && <p className="mt-3 text-xs text-[var(--gold)]">{hcpNote}</p>}

        {/* Season partner request — teams/match-play leagues. Player requests; director owns the pairings. */}
        {me && league && (league.settings.format === "Doubles" || league.settings.format === "Teams" || league.settings.scoring?.model === "matchplay") && (
          <div className={`${card} mb-6 mt-5 flex flex-wrap items-center gap-3 p-4`}>
            <span className="text-[13px] font-bold text-[var(--cream)]">Season partner</span>
            <input value={partnerReq} onChange={(e) => setPartnerReq(e.target.value)} onBlur={savePartner} placeholder="Who would you like to partner with?" className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-[var(--cream)] outline-none transition-colors focus:border-[var(--gold)]" />
            <button onClick={savePartner} className={`${btnGold} !px-4 !py-2 !text-sm`}>{partnerSaved ? "Saved ✓" : "Save"}</button>
            <p className="w-full text-[11px] text-[var(--cream-38)]">Just a request — your director sets the final teams.</p>
          </div>
        )}
      {/* Tabs — same tab, same route; first label reads Recap once the event completes */}
      <nav className="mb-9 mt-1.5 flex gap-[34px] border-b border-[var(--hair)]">
        {([
          { k: "about" as const, label: event.status === "complete" ? "Recap" : "About", n: 0 },
          ...(scoringKind ? [{ k: "scores" as const, label: "Scores", n: 0 }] : []),
          ...(scoringKind ? [{ k: "standings" as const, label: "Standings", n: 0 }] : []),
          { k: "players" as const, label: "Players", n: entries.length },
          { k: "chat" as const, label: "Chat", n: messages.length },
        ]).map(({ k, label, n }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative px-0.5 py-4 text-[14.5px] font-semibold transition-colors ${tab === k ? "text-[var(--cream)] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[var(--gold)]" : "text-[var(--cream-60)] hover:text-[var(--cream)]"}`}
          >{label}{n > 0 && <span className="ml-1.5 font-mono text-[11px] font-normal text-[var(--cream-38)]">{n}</span>}</button>
        ))}
        {admin && (
          <Link href={`/leagues/${slug}/manage`} className="ml-auto flex items-center gap-1.5 px-0.5 py-4 text-[14.5px] font-semibold text-[var(--gold)] transition-colors hover:text-[var(--gold-bright)]">
            <IconSliders className="h-4 w-4" />Director tools
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3.5 w-3.5"><path d="M9 6l6 6-6 6" /></svg>
          </Link>
        )}
      </nav>

      {/* About */}
      {tab === "about" && (
        <section className="mb-[44px] grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-11">
          <div className="min-w-0">
            {scoringKind && event.status === "complete" && ranked.length > 0 && (
              <div className="mb-10">
                <div className="mb-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Final results</div>
                <div className={`${card} overflow-hidden`}>
                  <div className="grid h-[42px] grid-cols-[56px_1fr_90px_90px] items-center bg-[rgba(0,0,0,0.16)] px-[22px] font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--cream-38)]">
                    <span>Pos</span><span>Player</span><span className="text-right">Rds</span><span className="text-right">Total</span>
                  </div>
                  {(() => {
                    const myIdx = cid ? ranked.findIndex((x) => x.id === cid) : -1;
                    const rows = ranked.slice(0, 4);
                    const appended = myIdx >= 4;
                    if (appended) rows.push(ranked[myIdx]);
                    return rows.map((e, ri) => {
                      const i = ranked.indexOf(e);
                      const you = cid != null && e.id === cid;
                      return (
                        <div
                          key={e.id}
                          className={`grid h-14 grid-cols-[56px_1fr_90px_90px] items-center border-b border-[var(--hair)] px-[22px] text-sm last:border-b-0 ${you ? "border-l-[3px] border-l-[var(--gold)] pl-[19px]" : ""} ${appended && ri === rows.length - 1 ? "border-t border-t-[var(--hair-strong)]" : ""}`}
                          style={you ? { background: "linear-gradient(90deg, rgba(232,181,96,.13), rgba(232,181,96,.04))" } : undefined}
                        >
                          <span className={`font-mono ${you ? "text-[var(--gold)]" : i === 0 ? "text-[var(--cream)]" : "text-[var(--cream-38)]"}`}>{i + 1}</span>
                          <span className="flex min-w-0 items-center gap-[11px] font-semibold text-[var(--cream)]">
                            <UserLink username={usernameById(e.id)}><Avatar url={e.photo} name={nameOf(e)} size={30} ring={false} gold={you} /></UserLink>
                            <UserLink username={usernameById(e.id)} className="truncate">{nameOf(e)}</UserLink>
                            {you && <span className="rounded border border-[rgba(232,181,96,.4)] px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.14em] text-[var(--gold)]">You</span>}
                            {(e.payout ?? 0) > 0 && <span className="font-mono text-xs font-bold text-[#5fcf80]">${e.payout}</span>}
                          </span>
                          <span className="text-right font-mono text-[var(--cream-60)]">{e.roundScores?.filter((r) => r > 0).join(" · ") ?? ""}</span>
                          <span className={`text-right font-mono text-[15px] font-bold ${scoreTone(fmtTotal(e), you)}`}>{fmtTotal(e)}</span>
                        </div>
                      );
                    });
                  })()}
                  <div className="flex items-center justify-between bg-[rgba(0,0,0,0.12)] px-[22px] py-[13px]">
                    <button onClick={() => setTab("scores")} className="text-[13px] font-semibold text-[var(--cream-60)] transition-colors hover:text-[var(--cream)]">View full leaderboard →</button>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--cream-38)]">{plural(ranked.length, "player")} · {plural(event.roundCount, "round")}</span>
                  </div>
                </div>
              </div>
            )}

            {scoringKind && liveNow && ranked.length > 0 && (
              <div className="mb-10">
                <div className={`${card} overflow-hidden`}>
                  <div className="flex items-center justify-between px-5 pb-3 pt-4">
                    <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--blue)]"><span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--blue)]" /> Live</span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--cream-38)]">{plural(ranked.length, "player")} scoring</span>
                  </div>
                  {(() => {
                    const myIdx = cid ? ranked.findIndex((x) => x.id === cid) : -1;
                    const rows = ranked.slice(0, 3);
                    if (myIdx >= 3) rows.push(ranked[myIdx]);
                    return rows.map((e) => {
                      const i = ranked.indexOf(e);
                      const you = cid != null && e.id === cid;
                      const thru = e.thruHole ?? e.holeScores?.filter((h) => h > 0).length;
                      return (
                        <div key={e.id} className={`grid grid-cols-[34px_1fr_62px_62px] items-center border-t border-[var(--hair)] px-5 py-[11px] text-[13.5px] ${you ? "bg-[var(--gold-dim)]" : ""}`}>
                          <span className={`font-mono ${you ? "text-[var(--gold)]" : "text-[var(--cream-38)]"}`}>{i + 1}</span>
                          <span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--cream)]"><UserLink username={usernameById(e.id)} className="truncate">{nameOf(e)}</UserLink>{you && <span className="rounded border border-[rgba(232,181,96,.4)] px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.14em] text-[var(--gold)]">You</span>}</span>
                          <span className="text-right font-mono text-xs text-[var(--cream-38)]">{typeof e.score !== "number" && thru ? `THRU ${thru}` : ""}</span>
                          <span className={`text-right font-mono font-bold ${scoreTone(fmtLive(e), you)}`}>{fmtLive(e)}</span>
                        </div>
                      );
                    });
                  })()}
                  <button onClick={() => setTab("scores")} className="block w-full border-t border-[var(--hair)] px-5 py-3 text-left text-[13px] font-semibold text-[var(--cream-60)] transition-colors hover:text-[var(--cream)]">View live scores →</button>
                </div>
              </div>
            )}

            {event.description ? (
              <div className="mb-10">
                <div className="mb-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--blue)]">About this {event.kind === "tournament" ? "tournament" : event.kind === "league" ? "league" : "event"}</div>
                <Desc text={event.description} />
              </div>
            ) : null}

            <div className="mb-10">
              <div className="mb-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--blue)]">Details</div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(() => {
                  const kindDef = EVENT_KINDS.find((k) => k.key === event.kind);
                  return (
                    <>
                      {kindDef && <Fact icon={KIND_ICON[event.kind!] ?? IconCalendar} label={kindDef.label} />}
                      {event.kind !== "clinic" && event.kind !== "cleanup" && <Fact icon={IconDisc} label={event.format} sub={`${event.startFormat} start`} />}
                      {event.kind !== "clinic" && event.kind !== "cleanup" ? (
                        <Fact icon={IconTarget} label={event.roundCount > 1 ? `${event.roundCount} × ${event.holes} holes` : `${event.holes} holes`} />
                      ) : event.durationMin ? (
                        <Fact icon={IconClock} label={event.durationMin >= 60 ? `${Math.floor(event.durationMin / 60)}h${event.durationMin % 60 ? ` ${event.durationMin % 60}m` : ""}` : `${event.durationMin} min`} sub="Planned length" />
                      ) : null}
                      {event.focus && <Fact icon={IconTarget} label={event.focus} sub={event.skillLevel ? `${event.skillLevel}` : "Session focus"} />}
                      {event.workList && event.workList.length > 0 && <Fact icon={IconLeaf} label="Work list" sub={event.workList.join(" · ")} />}
                      {event.meetingPoint && <Fact icon={IconPin} label="Meet at" sub={event.meetingPoint} />}
                      {event.bring && <Fact icon={IconTag} label="Bring" sub={event.bring} />}
                      {event.kind !== "cleanup" && <Fact icon={IconDollar} label={event.buyIn ? (event.kind === "clinic" ? "Price" : "Pay to play") : "Free to play"} sub={event.buyIn ? `$${event.buyIn}${event.kind === "clinic" ? "" : " buy-in"}` : undefined} />}
                      {event.payoutPlaces && <Fact icon={IconTrophy} label={`Top ${event.payoutPlaces} paid`} sub="Payouts from the pot" />}
                      {scoringKind && divisions.length > 0 && <Fact icon={IconUsers} label="Divisions" sub={divisions.join(" · ")} />}
                      {(event.extras ?? []).map((x) => {
                        const t = EVENT_EXTRAS.find((e2) => e2.key === x);
                        return t ? <Fact key={x} icon={EXTRA_ICON[x] ?? IconDisc} label={t.label} sub={t.hint} /> : null;
                      })}
                    </>
                  );
                })()}
              </div>
            </div>

            {(event.contactEmail || event.contactPhone) && (
              <p className="text-sm text-[var(--cream-60)]">
                Contact:{" "}
                {event.contactEmail && <a href={`mailto:${event.contactEmail}`} className="font-semibold text-[var(--gold)] hover:underline">{event.contactEmail}</a>}
                {event.contactEmail && event.contactPhone && " · "}
                {event.contactPhone && <a href={`tel:${event.contactPhone}`} className="font-semibold text-[var(--gold)] hover:underline">{event.contactPhone}</a>}
              </p>
            )}
            {!event.description && admin && league && event.status !== "complete" && (
              <p className="mt-10 text-[13px] text-[var(--cream-38)]">No description yet. <Link href={`/leagues/${league.slug}/manage`} className="text-[var(--cream-60)] underline decoration-[var(--hair-strong)] underline-offset-2 hover:text-[var(--gold)]">Add one from Director tools.</Link></p>
            )}
          </div>
          <div className="grid content-start gap-4 lg:sticky lg:top-6">
            {scoringKind && event.status === "complete" && ranked.length > 0 && (
              <div className="relative overflow-hidden rounded-2xl border border-[rgba(232,181,96,0.35)] bg-[var(--card)] p-6">
                <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(340px 200px at 85% -20%, rgba(232,181,96,.20), transparent 65%), radial-gradient(280px 180px at -10% 110%, rgba(232,181,96,.09), transparent 60%), linear-gradient(180deg, rgba(232,181,96,.05), transparent 55%)" }} />
                <IconTrophy className="pointer-events-none absolute -right-5 -top-5 h-32 w-32 rotate-12 text-[var(--gold)] opacity-[0.08]" />
                <div className="relative">
                  <div className="flex items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--gold)]">
                    <span aria-hidden className="h-px w-5 bg-[rgba(232,181,96,0.5)]" />Winner<span aria-hidden className="h-px flex-1 bg-[rgba(232,181,96,0.22)]" />
                  </div>
                  <div className="mt-5 flex items-center gap-4">
                    <span className="relative shrink-0">
                      <span aria-hidden className="absolute -inset-2.5 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(232,181,96,0.35), transparent)" }} />
                      <UserLink username={usernameById(ranked[0].id)} className="relative block rounded-full border-2 border-[var(--gold)] p-[3px]"><Avatar url={ranked[0].photo} name={nameOf(ranked[0])} size={56} ring={false} /></UserLink>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-[family-name:var(--font-heading)] text-[20px] font-extrabold leading-tight text-[var(--cream)]"><UserLink username={usernameById(ranked[0].id)}>{nameOf(ranked[0])}</UserLink></div>
                      {(ranked[0].roundScores?.filter((r) => r > 0).length ?? 0) > 1 && <div className="mt-1 font-mono text-[12px] text-[var(--cream-60)]">rounds of {ranked[0].roundScores!.filter((r) => r > 0).join(", ")}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-[42px] font-bold leading-none tracking-[-0.02em] text-[var(--gold)]">{fmtTotal(ranked[0])}</div>
                      <div className="mt-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cream-38)]">Final</div>
                    </div>
                  </div>
                  {(() => {
                    const w = ranked[0];
                    const played = pars && w.holeScores ? w.holeScores.slice(0, event.holes).map((h, i) => ({ h, i })).filter((x) => x.h > 0) : [];
                    const birdies = played.filter((x) => x.h < (pars![x.i] ?? 3)).length;
                    return (
                      <>
                        {played.length > 0 && (
                          <div className="mt-5 border-t border-[rgba(232,181,96,0.2)] pt-4">
                            <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--cream-38)]">{event.roundCount > 1 ? "Final round card" : "Winning card"}{played.length < event.holes ? ` · thru ${played.length}` : ""}</div>
                            <div className="grid grid-cols-9 gap-1.5">
                              {played.map(({ h, i }) => {
                                const par = pars![i] ?? 3;
                                const tone = h <= par - 2 ? "bg-[var(--gold)] text-[#141B16]"
                                  : h === par - 1 ? "bg-[var(--blue)] text-[#141B16]"
                                  : h === par ? "bg-white/[0.06] text-[var(--cream)]"
                                  : "border border-[var(--hair-strong)] text-[var(--cream-38)]";
                                return <span key={i} title={`Hole ${i + 1} · par ${par}`} className={`grid h-9 place-items-center rounded-lg font-mono text-[13.5px] font-bold ${tone}`}>{h}</span>;
                              })}
                            </div>
                            <div className="mt-2.5 flex items-center gap-4 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--cream-38)]">
                              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[3px] bg-[var(--gold)]" />Eagle</span>
                              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[3px] bg-[var(--blue)]" />Birdie</span>
                              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[3px] bg-white/[0.12]" />Par</span>
                            </div>
                          </div>
                        )}
                        {(hotRound != null || birdies > 0 || (w.payout ?? 0) > 0) && (
                          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-[rgba(232,181,96,0.2)] pt-4">
                            {hotRound != null && <div><div className="font-mono text-base font-bold text-[var(--cream)]">{hotRound}</div><div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Hot round</div></div>}
                            {birdies > 0 && <div><div className="font-mono text-base font-bold text-[var(--blue)]">{birdies}</div><div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--cream-38)]">{birdies === 1 ? "Birdie" : "Birdies"}</div></div>}
                            {(w.payout ?? 0) > 0 && <div><div className="font-mono text-base font-bold text-[#5fcf80]">${w.payout}</div><div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--cream-38)]">Payout</div></div>}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {scoringKind && liveNow && me && cid && ranked.some((x) => x.id === cid) && (() => {
              const myIdx = ranked.findIndex((x) => x.id === cid);
              const mineDelta = deltaOf(ranked[myIdx]);
              const tied = ranked.filter((x) => deltaOf(x) === mineDelta).length > 1;
              const back = mineDelta - deltaOf(ranked[0]);
              const thru = me.thruHole ?? me.holeScores?.filter((h) => h > 0).length ?? 0;
              const holesLeft = Math.max(0, event.holes - thru);
              const pos = tied ? `T${ranked.findIndex((x) => deltaOf(x) === mineDelta) + 1}` : `${myIdx + 1}${["st", "nd", "rd"][myIdx] ?? "th"}`;
              const standing = back === 0 ? (tied ? "tied for the lead" : "leading") : `${back} back`;
              const line = `${pos} of ${ranked.length} · ${standing}${holesLeft > 0 && holesLeft < event.holes ? ` with ${plural(holesLeft, "hole")} to play` : ""}`;
              return (
                <div className={`${card} p-6`}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Your position</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10.5px] tracking-[0.08em] text-[#5fcf80]">✓{divisions.length > 1 && me.division ? ` ${me.division}` : " In"}</span>
                  </div>
                  <div className="font-[family-name:var(--font-heading)] text-[15px] font-semibold leading-relaxed text-[var(--cream)]">{line}</div>
                </div>
              );
            })()}

            {open && (
              <button onClick={() => setTab("players")} className={`${card} block w-full p-6 text-left transition-colors hover:border-[var(--hair-strong)]`}>
                <div className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--blue)]">Field</div>
                {entries.length > 0 && (
                  <div className="mb-3.5 flex items-center">
                    <span className="flex -space-x-2">
                      {entries.slice(0, 6).map((e) => (
                        <span key={e.id} className="rounded-full ring-2 ring-[var(--forest)]"><Avatar url={e.photo} name={nameOf(e)} size={28} ring={false} /></span>
                      ))}
                    </span>
                    {entries.length > 6 && <span className="z-10 -ml-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--card-raised)] font-mono text-[10px] font-semibold text-[var(--cream-60)] ring-2 ring-[var(--forest)]">+{entries.length - 6}</span>}
                  </div>
                )}
                {event.capacity ? (() => {
                  const pct = Math.min(100, Math.round((entries.length / event.capacity!) * 100));
                  const hot = pct >= 75;
                  return (
                    <>
                      <div className="h-[3px] overflow-hidden rounded-[2px] bg-[var(--hair)]">
                        <i className={`block h-full rounded-[2px] ${hot ? "bg-[var(--gold)]" : "bg-[var(--blue)]"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2 font-mono text-[10.5px] tracking-[0.06em] text-[var(--cream-38)]"><b className="font-medium text-[var(--cream-60)]">{entries.length} of {event.capacity}</b> registered{hot ? " · filling fast" : ""}</div>
                    </>
                  );
                })() : (
                  <div className="font-mono text-[10.5px] tracking-[0.06em] text-[var(--cream-38)]">{entries.length > 0 ? <><b className="font-medium text-[var(--cream-60)]">{entries.length}</b> {checkInPhase ? "checked in" : "joined"}</> : (checkInPhase ? "Be the first in" : "Be the first to join")}</div>
                )}
              </button>
            )}

            {/* TODO: registration rail card lands here when paid events ship (buy-in checkout). Deliberately not built yet. */}

            <div className={`${card} p-6`}>
              <div className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--blue)]">Schedule</div>
              <div className="ml-[5px] border-l border-[var(--hair-strong)] pl-[22px]">
                <div className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full border-2 border-[var(--blue)] bg-[var(--forest)]" />
                  <div className="font-[family-name:var(--font-heading)] text-[14.5px] font-semibold text-[var(--cream)]">{event.kind === "clinic" ? "Session" : event.kind === "cleanup" ? "Work day" : event.roundCount === 1 ? "Round 1" : event.roundCount === 2 ? "Rounds 1 and 2" : `Rounds 1–${event.roundCount}`}</div>
                  <div className="mt-1 font-mono text-xs text-[var(--blue)]">{fmtDate(event.date)}</div>
                  <div className="mt-[3px] text-[12.5px] text-[var(--cream-60)]">{event.kind === "clinic" || event.kind === "cleanup"
                    ? [event.durationMin ? (event.durationMin >= 60 ? `${Math.floor(event.durationMin / 60)}h${event.durationMin % 60 ? ` ${event.durationMin % 60}m` : ""}` : `${event.durationMin} min`) : null, event.meetingPoint, event.courseName].filter(Boolean).join(" · ")
                    : `${event.holes} holes${event.roundCount > 1 ? " per round" : ""} · ${event.startFormat}${event.courseName ? ` · ${event.courseName}` : ""}`}</div>
                </div>
              </div>
            </div>

            {staff.length > 0 && (
              <div className={`${card} p-6`}>
                <div className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Staff</div>
                <div className="grid gap-3">
                  {staff.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 text-sm">
                      {m.username ? <Link href={`/u/${m.username}`}><Avatar url={m.photo} name={m.name} size={30} /></Link> : <Avatar url={m.photo} name={m.name} size={30} />}
                      <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{m.username ? <Link href={`/u/${m.username}`} className="hover:underline">{m.name}</Link> : m.name}</span>
                      <span className="rounded border border-[rgba(232,181,96,.4)] px-[7px] py-[3px] font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--gold)]">{m.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Players */}
      {tab === "players" && (
        <section className="mb-[44px]">
          {entries.length === 0 ? (
            <div className={`${card} px-6 py-12 text-center text-sm text-[var(--sage-dim)]`}>Nobody has checked in yet.</div>
          ) : (
            <div className={`${card} overflow-hidden`}>
              {entries.map((e) => (
                <div key={e.id} className="flex items-center gap-3.5 border-b border-white/[0.05] px-4 py-3 text-sm last:border-b-0">
                  {e.username ? <Link href={`/u/${e.username}`}><Avatar url={e.photo} name={nameOf(e)} size={32} /></Link> : <Avatar url={e.photo} name={nameOf(e)} size={32} />}
                  <span className="min-w-0 flex-1">
                    <span className="truncate font-bold text-[var(--cream)]">{e.username ? <Link href={`/u/${e.username}`} className="hover:underline">{nameOf(e)}</Link> : nameOf(e)}</span>
                    <span className="block text-xs text-[var(--sage-dim)]">Checked in {new Date(e.checkedInAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  </span>
                  {typeof e.tag === "number" && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--cream)]">#{e.tag}</span>}
                  {divisions.length > 1 && e.division && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">{e.division}</span>}
                  {typeof e.teamId === "number" && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--text-body)]">T{e.teamId}</span>}
                  {event.buyIn && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${e.paid ? "bg-[#5fcf80]/15 text-[#5fcf80]" : "bg-white/[0.05] text-[var(--sage-dim)]"}`}>{e.paid ? "Paid" : "Unpaid"}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Money */}
      {tab === "scores" && event.buyIn && (
        <section className="mb-[44px] grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Buy-in", value: `$${event.buyIn}` },
            { label: "Paid", value: `${paidCount}/${entries.length}` },
            { label: "Collected", value: `$${paidCount * event.buyIn}` },
            { label: "Remaining", value: `$${paidCount * event.buyIn - paidOut}`, gold: true },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3.5`}>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">{s.label}</div>
              <div className={`mt-1 font-mono text-xl font-extrabold ${s.gold ? "text-[var(--gold)]" : "text-[var(--cream)]"}`}>{s.value}</div>
            </div>
          ))}
          {admin && event.payoutPlaces && paidCount > 0 ? (() => {
            const pot = paidCount * event.buyIn!;
            const curves: Record<number, number[]> = { 2: [60, 40], 3: [50, 30, 20], 4: [40, 30, 20, 10], 5: [35, 25, 20, 12, 8] };
            const curve = curves[Math.min(event.payoutPlaces!, 5)] ?? curves[3];
            const cuts = curve.map((pct) => Math.round((pot * pct) / 100));
            return (
              <p className="col-span-2 font-mono text-[10.5px] tracking-[0.06em] text-[var(--cream-38)] sm:col-span-4">
                Suggested from the ${pot} pot: {cuts.map((c, i) => `${i + 1}${["st", "nd", "rd"][i] ?? "th"} $${c}`).join(" · ")} — enter actual payouts on the rows.
              </p>
            );
          })() : null}
        </section>
      )}

      {/* Leaderboard */}
      {tab === "scores" && scoringKind && (
      <section className="mb-[44px]">
        <SectionTitle
          right={(divisions.length > 1 && entries.some((e) => e.division)) || (admin && open) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {divisions.length > 1 && entries.some((e) => e.division) && (
                <>
                  <button onClick={() => setDivFilter("")} className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${!divFilter ? "bg-[var(--gold)] text-[#141B16]" : "bg-[var(--card)] text-[var(--cream-38)] hover:text-[var(--cream)]"}`}>All</button>
                  {divisions.map((d) => (
                    <button key={d} onClick={() => setDivFilter(divFilter === d ? "" : d)} className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${divFilter === d ? "bg-[var(--gold)] text-[#141B16]" : "bg-[var(--card)] text-[var(--cream-38)] hover:text-[var(--cream)]"}`}>{d}</button>
                  ))}
                </>
              )}
              {admin && open && (
                <button onClick={() => setEditScores((v) => !v)} className={`ml-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${editScores ? "bg-[var(--gold)] text-[#141B16]" : "border border-[var(--hair-strong)] text-[var(--cream-60)] hover:text-[var(--cream)]"}`}>{editScores ? "Done" : "Enter scores"}</button>
              )}
              {admin && open && canComplete && <button onClick={complete} disabled={busy} className="rounded-full bg-[var(--gold)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">Complete</button>}
              {admin && open && (
                <div className="relative" ref={menuRef}>
                  <button onClick={() => { setMenuOpen((o) => !o); setConfirmCancel(false); }} aria-label="More director actions" className="grid h-7 w-7 place-items-center rounded-full text-[var(--cream-60)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]">⋯</button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full z-20 mt-2 min-w-[200px] rounded-xl border border-[var(--hair)] bg-[var(--card-raised)] p-1.5">
                      {!isTeamFormat && <button onClick={() => { doHandicaps(); setMenuOpen(false); }} className={menuItem}>Apply handicaps</button>}
                      {isTeamFormat && <button onClick={() => { doTeams(); setMenuOpen(false); }} className={menuItem}>Randomize teams</button>}
                      {event.roundCount < 6 && <button onClick={() => { addRound(); setMenuOpen(false); }} className={menuItem}>Add round {event.roundCount + 1}</button>}
                      <button onClick={() => { copyLink(); }} className={menuItem}>{copied ? "Link copied ✓" : "Copy event link"}</button>
                      <button onClick={() => { if (confirmCancel) { cancel(); setMenuOpen(false); setConfirmCancel(false); } else setConfirmCancel(true); }} className={`${menuItem} text-[#f08c8c] hover:bg-[#f08c8c]/10 hover:text-[#f08c8c] ${confirmCancel ? "font-bold" : ""}`}>{confirmCancel ? "Confirm cancel event" : "Cancel event"}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : undefined}
        >Leaderboard · {entries.length}</SectionTitle>

        {admin && open && editScores && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--hair)] bg-[var(--card)] p-2.5">
            <span className="pl-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cream-38)]">Add player</span>
            <input
              value={walkName}
              onChange={(ev2) => setWalkName(ev2.target.value)}
              onKeyDown={(ev2) => { if (ev2.key === "Enter") addWalkup(); }}
              placeholder="Walk-up name"
              className={`${adminInput} h-9 min-w-0 flex-1 !text-left`}
            />
            {divisions.length > 1 && (
              <select value={walkDiv} onChange={(ev2) => setWalkDiv(ev2.target.value)} className={`${adminInput} h-9 !text-left`}>
                <option value="">Division…</option>
                {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <button onClick={addWalkup} disabled={!walkName.trim() || addingWalk} className="h-9 rounded-[10px] bg-[var(--gold)] px-4 text-[13px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-40">{addingWalk ? "Adding…" : "Add"}</button>
          </div>
        )}

        {entries.length === 0 ? (
          <div className={`${card} grid place-items-center px-6 py-14 text-center`}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconDisc className="h-6 w-6" /></span>
            <p className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">Nobody&apos;s checked in yet</p>
            <p className="mt-1 text-sm text-[var(--cream-38)]">Share the check-in link to fill the field.</p>
          </div>
        ) : isTeamFormat ? (
          renderTeamBoard()
        ) : (
          <>
          {(() => {
            const myIdx = cid ? ranked.findIndex((e) => e.id === cid) : -1;
            if (myIdx <= 0) return null;
            const meRow = ranked[myIdx];
            const back = adjOf(meRow) - adjOf(ranked[0]);
            const played = meRow.holeScores?.filter((h) => h > 0).length ?? 0;
            const toPlay = typeof meRow.score !== "number" && played > 0 ? event.holes - (meRow.thruHole ?? played) : 0;
            const tied = ranked.filter((e) => adjOf(e) === adjOf(meRow)).length > 1;
            return (
              <div className="mb-4 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-dim)] px-5 py-4">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Your position</div>
                <div className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">
                  {tied ? "T" : ""}{myIdx + 1} · {back} back{toPlay > 0 ? ` with ${toPlay} to play` : ""}
                </div>
              </div>
            );
          })()}
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center gap-3.5 bg-[var(--forest)] px-4 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--cream-38)]">
              <span className="w-8">Pos</span><span className="flex-1">Player</span><span className="hidden w-[184px] text-right sm:block">Last 9</span><span className="w-8 text-right">Thru</span>{event.roundCount > 1 && <span className="hidden w-10 text-right sm:block">Rd</span>}<span className="w-20 text-right">Total</span>
            </div>
            {[...ranked, ...unscored].map((e, i) => {
              const isRanked = ranked.includes(e);
              const pos = isRanked ? i + 1 : undefined;
              const you = cid != null && e.id === cid;
              const playedHoles = e.holeScores?.filter((h) => h > 0) ?? [];
              const last9 = playedHoles.slice(-9);
              const thruN = typeof e.score !== "number" && playedHoles.length > 0 ? (e.thruHole ?? playedHoles.length) : null;
              return (
                <div key={e.id} className={`flex min-h-[58px] items-center gap-3.5 border-b border-[var(--hair)] px-4 py-2.5 text-sm transition-colors last:border-b-0 ${you ? "border-l-[3px] border-l-[var(--gold)] bg-gradient-to-r from-[var(--gold-dim)] via-transparent to-transparent" : ""}`}>
                  <Pos n={pos} />
                  <UserLink username={usernameById(e.id)}><Avatar url={e.photo} name={nameOf(e)} size={34} /></UserLink>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-bold text-[var(--cream)]">{e.username ? <Link href={`/u/${e.username}`} className="hover:underline">{nameOf(e)}</Link> : nameOf(e)}</span>
                      {you && <span className="rounded-full bg-[var(--gold)] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#141B16]">YOU</span>}
                      {typeof e.tag === "number" && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--cream)]" title="Bag tag">#{e.tag}</span>}
                      {(e.payout ?? 0) > 0 && <span className="rounded-full bg-[#5fcf80]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#5fcf80]" title="Payout">${e.payout}</span>}
                      {(e.startingScore ?? 0) !== 0 && <span className="rounded-full bg-[var(--gold-dim)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--gold)]" title="Handicap adjustment">HCP {e.startingScore! > 0 ? `+${e.startingScore}` : e.startingScore}</span>}
                      {divisions.length > 1 && e.division && !divFilter && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">{e.division}</span>}
                      {e.dnf && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">DNF</span>}
                      {admin && e.walkup && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]" title="Director-added walk-up — score by hand">Walk-up</span>}
                      {typeof e.score !== "number" && liveTotal(e) != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#5fcf80]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5fcf80]">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5fcf80]" />
                          thru {e.thruHole ?? e.holeScores!.filter((n) => n > 0).length}
                        </span>
                      )}
                    </span>
                    {event.status === "complete" && typeof e.score === "number" && (
                      <span className="mt-0.5 block text-[10px] font-bold text-[var(--sage-dim)]">{points.get(e.id) ?? ""} pts</span>
                    )}
                  </span>
                  {(e.penalty ?? 0) > 0 && admin && open && <span className="font-mono text-xs font-bold text-[#f08c8c]">+{e.penalty}</span>}

                  {admin && open && editScores ? (
                    <span className="flex items-center gap-1.5">
                      <button onClick={() => patchEntry(e.id, { paid: !e.paid })} title={e.paid ? "Mark unpaid" : "Mark paid"} className={`rounded-full px-2 py-1.5 font-mono text-xs font-bold transition-colors ${e.paid ? "bg-[#5fcf80]/15 text-[#5fcf80]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}>$</button>
                      <button onClick={() => patchEntry(e.id, { penalty: (e.penalty ?? 0) > 0 ? undefined : 2 })} title={(e.penalty ?? 0) > 0 ? `Penalty +${e.penalty} — click to clear` : "Add +2 penalty"} className={`rounded-full px-2 py-1.5 font-mono text-xs font-bold transition-colors ${(e.penalty ?? 0) > 0 ? "bg-[#f08c8c]/15 text-[#f08c8c]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}>{(e.penalty ?? 0) > 0 ? `+${e.penalty}` : "P"}</button>
                      <button onClick={() => patchEntry(e.id, { dnf: !e.dnf })} title={e.dnf ? "Clear DNF" : "Mark DNF"} className={`rounded-full px-2 py-1.5 font-mono text-[10px] font-bold transition-colors ${e.dnf ? "bg-white/[0.1] text-[var(--cream)]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}>DNF</button>
                      <input
                        key={`${e.id}-hcp-${e.startingScore ?? ""}`}
                        inputMode="numeric"
                        defaultValue={e.startingScore ?? ""}
                        placeholder="hcp"
                        title="Handicap adjustment (added to total) — blank to clear"
                        onBlur={(ev2) => {
                          const raw = ev2.target.value.trim();
                          const v = raw === "" ? undefined : Number(raw);
                          if (v === undefined || Number.isFinite(v)) patchEntry(e.id, { startingScore: v });
                        }}
                        onKeyDown={(ev2) => { if (ev2.key === "Enter") (ev2.target as HTMLInputElement).blur(); }}
                        className={`${adminInput} w-12 text-xs text-[var(--gold)]`}
                      />
                      {event.roundCount > 1 ? (
                        Array.from({ length: event.roundCount }, (_, ri) => (
                          <input
                            key={`${e.id}-r${ri}-${e.roundScores?.[ri] ?? ""}`}
                            inputMode="numeric"
                            defaultValue={e.roundScores?.[ri] || ""}
                            placeholder={`R${ri + 1}`}
                            title={`Round ${ri + 1} total`}
                            onBlur={(ev2) => {
                              const raw = ev2.target.value.trim();
                              const v = raw === "" ? undefined : Number(raw);
                              if (v === undefined || Number.isFinite(v)) setRoundScore(event.id, e, ri, v, event.roundCount);
                            }}
                            onKeyDown={(ev2) => { if (ev2.key === "Enter") (ev2.target as HTMLInputElement).blur(); }}
                            className={`${adminInput} w-12 text-xs`}
                          />
                        ))
                      ) : (
                        <input
                          inputMode="numeric"
                          defaultValue={e.score ?? ""}
                          placeholder="—"
                          onChange={(ev2) => setScoreDraft((s) => ({ ...s, [e.id]: ev2.target.value }))}
                          onBlur={() => saveScore(e.id)}
                          onKeyDown={(ev2) => { if (ev2.key === "Enter") (ev2.target as HTMLInputElement).blur(); }}
                          className={`${adminInput} w-14`}
                        />
                      )}
                      <button onClick={() => dropEntry(e.id)} title="Remove from event" className="rounded-full px-1.5 py-1 text-xs text-[var(--sage-dim)] transition-colors hover:text-[#f08c8c]">✕</button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-3.5">
                      <span className="hidden w-[184px] items-center justify-end gap-[5px] sm:flex">
                        {last9.length > 0 && (
                          <>
                          {last9.map((h, hi) => {
                            const holeIdx = playedHoles.length - last9.length + hi;
                            const par = pars?.[holeIdx];
                            const cls = par == null ? "border-[var(--hair-strong)] text-[var(--cream-38)]"
                              : h <= par - 2 ? "border-[var(--blue)] bg-[var(--blue)] font-bold text-[#141B16]"
                              : h === par - 1 ? "border-[var(--blue)] bg-[var(--blue-dim)] text-[var(--blue)]"
                              : h === par ? "border-[var(--hair-strong)] text-[var(--cream-38)]"
                              : "border-[rgba(244,241,232,.24)] text-[var(--cream-60)]";
                            return <span key={hi} className={`grid h-4 w-4 place-items-center rounded-full border font-mono text-[8.5px] ${cls}`}>{h}</span>;
                          })}
                          </>
                        )}
                      </span>
                      <span className="w-8 text-right font-mono text-xs text-[var(--cream-38)]">{thruN != null ? thruN : ""}</span>
                      {event.roundCount > 1 && (
                        <span className="hidden w-10 text-right font-mono text-xs text-[var(--cream-60)] sm:block">{(() => { const rs = e.roundScores?.filter((r) => r > 0); return rs?.length ? rs[rs.length - 1] : ""; })()}</span>
                      )}
                      <span className={`w-20 text-right font-mono text-lg font-extrabold ${scoreOf(e) == null || e.dnf ? "text-[var(--cream-38)]" : scoreTone(fmtLive(e), you)}`}>
                        {scoreOf(e) == null ? "" : e.dnf ? scoreOf(e) : fmtLive(e)}
                        {scoreOf(e) != null && !e.dnf && parTotal != null && <span className="ml-1 align-middle text-[10px] font-normal text-[var(--cream-38)]">({anyHcp ? adjOf(e) : scoreOf(e)})</span>}
                      </span>
                      {admin && event.status === "complete" && (
                        <input
                          key={`${e.id}-pay-${e.payout ?? ""}`}
                          inputMode="numeric"
                          defaultValue={e.payout ?? ""}
                          placeholder="$"
                          title="Payout — director ledger"
                          onBlur={(ev2) => {
                            const raw = ev2.target.value.trim();
                            const v = raw === "" ? undefined : Number(raw);
                            if (v === undefined || Number.isFinite(v)) patchEntry(e.id, { payout: v });
                          }}
                          onKeyDown={(ev2) => { if (ev2.key === "Enter") (ev2.target as HTMLInputElement).blur(); }}
                          className={`${adminInput} w-12 text-xs text-[#5fcf80]`}
                        />
                      )}

                    </span>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
        {admin && open && editScores && entries.length > 0 && (
          <p className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--cream-38)]">Director score entry. App rounds attach automatically when players publish.</p>
        )}
      </section>
      )}

      {/* Season standings — mirrors the iOS event Standings tab (podium + your-rank + field) */}
      {tab === "standings" && (() => {
        // Match-play leagues show the schedule + match standings + bracket (read-only for players).
        if (league?.settings.scoring?.model === "matchplay") {
          const reg = matches.filter((m) => !m.bracket);
          const mpRounds = [...new Set(reg.map((m) => m.round))].sort((a, b) => a - b);
          const mp = computeMatchStandings(matches, league.settings.scoring);
          const bracket = matches.filter((m) => m.bracket);
          const brRounds = [...new Set(bracket.map((m) => m.round))].sort((a, b) => a - b);
          const maxR = brRounds.length ? brRounds[brRounds.length - 1] : 0;
          const fin = bracket.filter((m) => m.round === maxR);
          const champ = fin.length === 1 && fin[0].winnerId && fin[0].winnerId !== "tie" ? (fin[0].winnerId === fin[0].sideAId ? fin[0].sideAName : fin[0].sideBName) : null;
          const mine = (m: LeagueMatch) => cid != null && (m.sideAId === cid || m.sideBId === cid);
          const side = (m: LeagueMatch, k: "a" | "b") => {
            const id = k === "a" ? m.sideAId : m.sideBId, name = k === "a" ? m.sideAName : m.sideBName;
            const won = m.winnerId === id, tie = m.winnerId === "tie";
            return <span className={`min-w-0 flex-1 truncate ${k === "b" ? "text-left" : "text-right"} ${won ? "font-bold text-[var(--gold)]" : tie ? "text-[var(--cream-60)]" : "text-[var(--cream)]"}`}>{name}</span>;
          };
          return (
            <section className="mb-[44px] space-y-5">
              <SectionTitle>Match play</SectionTitle>
              {matches.length === 0 ? (
                <div className={`${card} grid place-items-center px-6 py-14 text-center`}>
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconTrophy className="h-6 w-6" /></span>
                  <p className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">Schedule coming soon</p>
                  <p className="mt-1 max-w-xs text-sm text-[var(--cream-38)]">Your director sets the weekly matchups — they&apos;ll show here.</p>
                </div>
              ) : (
                <>
                  {mp.length > 0 && (
                    <div className={`${card} overflow-hidden`}>
                      <div className="border-b border-[var(--hair)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Standings</div>
                      {mp.map((row, i) => (
                        <div key={row.id} className={`flex items-center gap-3 border-b border-[var(--hair)] px-4 py-2.5 text-sm last:border-b-0 ${row.id === cid ? "bg-[var(--gold)]/[0.06]" : ""}`}>
                          <span className="w-6 font-mono text-xs text-[var(--cream-38)]">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{row.name}</span>
                          <span className="font-mono text-xs text-[var(--cream-38)]">{row.wins}-{row.ties}-{row.losses}</span>
                          <span className="w-10 text-right font-mono font-bold text-[var(--gold)]">{row.points}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {mpRounds.map((r) => (
                    <div key={r} className={`${card} p-4`}>
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--blue)]">Week {r}</h3>
                      <div className="space-y-1.5">
                        {reg.filter((m) => m.round === r).map((m) => (
                          <div key={m.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${mine(m) ? "bg-[var(--gold)]/[0.06] ring-1 ring-[var(--gold)]/25" : "bg-white/[0.03]"}`}>
                            {side(m, "a")}
                            <span className="shrink-0 font-mono text-[10px] text-[var(--cream-38)]">{m.winnerId ? "final" : "vs"}</span>
                            {side(m, "b")}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {bracket.length > 0 && (
                    <div className={`${card} p-4`}>
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Playoffs</h3>
                      {champ && <div className="mb-3 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/[0.1] px-4 py-2.5 text-center font-[family-name:var(--font-heading)] font-bold text-[var(--gold)]">🏆 {champ}</div>}
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {brRounds.map((r) => (
                          <div key={r} className="flex min-w-[170px] flex-col justify-around gap-3">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cream-38)]">{r === maxR && fin.length === 1 ? "Final" : `Round ${r}`}</div>
                            {bracket.filter((m) => m.round === r).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)).map((m) => (
                              <div key={m.id} className="overflow-hidden rounded-lg border border-[var(--hair)] text-xs">
                                <div className={`truncate px-2.5 py-2 ${m.winnerId === m.sideAId ? "bg-[var(--gold)]/15 font-bold text-[var(--gold)]" : "text-[var(--cream)]"}`}>{m.sideAName}</div>
                                <div className={`truncate border-t border-[var(--hair)] px-2.5 py-2 ${m.winnerId === m.sideBId ? "bg-[var(--gold)]/15 font-bold text-[var(--gold)]" : "text-[var(--cream)]"}`}>{m.sideBName}</div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        }
        const SILVER = "#BFC7D4", BRONZE = "#C29461", GOLD_HEX = "#E8B560";
        const photoOf = new Map(entries.filter((e) => e.photo).map((e) => [e.id, e.photo as string]));
        const g = season?.gross ?? [], nt = season?.net ?? [], teamRows = season?.teams ?? [];
        const view = league?.settings.scoring?.view; // "gross" | "net" | "both" | undefined
        const showNet = view === "net" || view === "both";
        const showTeam = teamRows.length > 0;
        const eff: "gross" | "net" | "team" = (stView === "team" && !showTeam) || (stView === "net" && !showNet) ? "gross" : stView;
        const rows: StandingRow[] = eff === "team" ? teamRows.map((t) => ({ id: t.id, name: t.name, played: t.played, points: t.points })) : eff === "net" ? nt : g;
        const viewPills = [{ k: "gross" as const, label: "Gross" }, ...(showNet ? [{ k: "net" as const, label: "Net" }] : []), ...(showTeam ? [{ k: "team" as const, label: "Teams" }] : [])];
        const myIdx = cid && eff !== "team" ? rows.findIndex((r) => r.id === cid) : -1;
        const ordinal = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };
        const col = (rank: number, row: StandingRow, tone: string, pedestal: number, avatar: number, title: string, delta: number | null, crowned: boolean) => {
          const you = cid != null && row.id === cid;
          const photo = photoOf.get(row.id);
          return (
            <div key={rank} className="flex min-w-0 flex-1 flex-col items-center">
              {crowned && <svg viewBox="0 0 24 24" fill="currentColor" className="mb-1 h-[18px] w-[18px]" style={{ color: GOLD_HEX, filter: "drop-shadow(0 0 8px rgba(232,181,96,0.7))" }}><path d="M3 8l3.6 3L12 4l5.4 7L21 8l-1.7 10.5H4.7L3 8z" /></svg>}
              <div className="relative grid place-items-center overflow-hidden rounded-full" style={{ width: avatar, height: avatar, boxShadow: `0 0 0 ${crowned ? 3 : 2.5}px ${tone}, 0 0 ${crowned ? 16 : 7}px ${tone}${crowned ? "88" : "44"}` }}>
                <div className="absolute inset-0 rounded-full bg-white/[0.08]" />
                <span className="relative font-[family-name:var(--font-heading)] font-bold text-white/70" style={{ fontSize: avatar * 0.4 }}>{row.name.charAt(0).toUpperCase()}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photo && <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              </div>
              <div className="mt-1.5 font-mono text-[7px] font-black uppercase tracking-[0.14em]" style={{ color: tone }}>{title}</div>
              <div className={`mt-0.5 max-w-full truncate px-1 font-[family-name:var(--font-heading)] font-bold ${crowned ? "text-[13px]" : "text-[11px]"} ${you ? "text-[var(--gold)]" : "text-[var(--cream)]"}`}>{row.name}</div>
              <div className={`font-[family-name:var(--font-heading)] font-black tabular-nums ${crowned ? "text-[26px] leading-tight" : "text-lg"}`} style={{ color: tone }}>{row.points}</div>
              {delta != null && delta > 0
                ? <div className="font-[family-name:var(--font-heading)] text-[8px] font-bold tabular-nums text-[var(--cream-38)]">−{delta} back</div>
                : <div className="font-[family-name:var(--font-heading)] text-[7px] font-black uppercase tracking-[0.2em] text-[var(--cream-38)]">Pts</div>}
              <div className="mt-1.5 flex w-full max-w-[96px] justify-center rounded-t-lg pt-1.5 font-[family-name:var(--font-heading)] text-base font-black" style={{ height: pedestal, background: `linear-gradient(to bottom, ${tone}66, ${tone}0d)`, color: tone }}>{rank}</div>
            </div>
          );
        };
        return (
          <section className="mb-[44px]">
            <SectionTitle right={viewPills.length > 1 ? (
              <div className="inline-flex rounded-full border border-[var(--hair-strong)] bg-[var(--card)] p-0.5">
                {viewPills.map((v) => (
                  <button key={v.k} onClick={() => setStView(v.k)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${eff === v.k ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--cream-60)] hover:text-[var(--cream)]"}`}>{v.label}</button>
                ))}
              </div>
            ) : undefined}>Season standings</SectionTitle>
            {!standingsLoaded ? (
              <div className={`${card} grid place-items-center px-6 py-14 text-sm text-[var(--cream-38)]`}>Loading standings…</div>
            ) : rows.length === 0 ? (
              <div className={`${card} grid place-items-center px-6 py-14 text-center`}>
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconTrophy className="h-6 w-6" /></span>
                <p className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">The podium is empty</p>
                <p className="mt-1 max-w-xs text-sm text-[var(--cream-38)]">Season points land here once the league&apos;s first event completes.</p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-[11px] text-[var(--cream-38)]">{plural(rows.length, "player")} · season points settle after every event</p>
                <div className="relative mb-4 flex items-end justify-center gap-2.5">
                  <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-56 max-w-md" style={{ background: "radial-gradient(220px 180px at 50% 20%, rgba(232,181,96,0.14), transparent 70%)" }} />
                  {rows.length > 1 && col(2, rows[1], SILVER, 54, 52, "Chasing", rows[0].points - rows[1].points, false)}
                  {col(1, rows[0], GOLD_HEX, 86, 70, "Season leader", null, true)}
                  {rows.length > 2 && col(3, rows[2], BRONZE, 38, 46, "In the hunt", rows[0].points - rows[2].points, false)}
                </div>
                {myIdx >= 0 && (
                  <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-[var(--gold)]/35 px-4 py-3" style={{ background: "linear-gradient(to right, rgba(232,181,96,0.14), var(--card))" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]"><path d="M6 2a1 1 0 0 1 1 1v1h10.6a.5.5 0 0 1 .4.8L16 8.5l2 3.7a.5.5 0 0 1-.4.8H7v9a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1z" /></svg>
                    <span className="font-[family-name:var(--font-heading)] text-[13px] font-bold text-[var(--cream)]">You&apos;re {ordinal(myIdx + 1)} of {rows.length}</span>
                    <span className="ml-auto text-[11px] tabular-nums">
                      {myIdx === 0
                        ? <span className="font-semibold text-[var(--gold)]">Leading the season</span>
                        : <span className="text-[var(--cream-60)]">{rows[0].points - rows[myIdx].points} pts off the lead</span>}
                    </span>
                  </div>
                )}
                {rows.length > 3 && (
                  <div className="flex flex-col gap-1.5">
                    {rows.slice(3).map((row, i) => {
                      const rank = i + 4;
                      const you = cid != null && row.id === cid;
                      return (
                        <div key={row.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${you ? "border-[var(--gold)]/40 bg-[var(--gold)]/[0.08]" : "border-white/[0.07] bg-[var(--card)]"}`}>
                          <span className={`w-6 shrink-0 font-[family-name:var(--font-heading)] text-[13px] font-black tabular-nums ${you ? "text-[var(--gold)]" : "text-[var(--cream-38)]"}`}>{rank}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[13.5px] font-semibold text-[var(--cream)]">{row.name}</span>
                              {you && <span className="rounded-full bg-[var(--gold)] px-1.5 py-0.5 font-[family-name:var(--font-heading)] text-[8px] font-black text-[#141B16]">YOU</span>}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--cream-38)]">
                              <span>{plural(row.played, "event")}</span>
                              {row.division && <span>{row.division}</span>}
                              {row.bestToPar != null && <span className="font-semibold text-[var(--blue)]">best {row.bestToPar === 0 ? "E" : row.bestToPar > 0 ? `+${row.bestToPar}` : row.bestToPar}</span>}
                            </div>
                          </div>
                          <span className="flex items-baseline gap-1">
                            <span className={`font-[family-name:var(--font-heading)] text-[17px] font-black tabular-nums ${you ? "text-[var(--gold)]" : "text-[var(--blue)]"}`}>{row.points}</span>
                            <span className="text-[9px] text-[var(--cream-38)]">pts</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        );
      })()}

      {/* Event chat — two-way, per event (UDisc only has one-way admin blasts) */}
      {tab === "chat" && (
      <section className="mb-[44px]">
        <SectionTitle>Event chat{messages.length > 0 ? ` · ${messages.length}` : ""}</SectionTitle>
        <div className={`${card} flex max-h-[420px] flex-col`}>
          <div className="min-h-[120px] flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="grid place-items-center py-8 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconUsers className="h-5 w-5" /></span>
                <p className="mt-3 text-sm text-[var(--sage-dim)]">No messages yet. Updates and trash talk land here.</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5">
                <UserLink username={usernameById(m.senderId)}><Avatar url={m.senderPhoto} name={m.senderName} size={28} /></UserLink>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <UserLink username={usernameById(m.senderId)} className="text-sm font-bold text-[var(--cream)]">{m.senderName}</UserLink>
                    {isDirector(m.senderId) && <span className="rounded-full bg-[var(--gold-dim)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[var(--gold)]">Director</span>}
                    <span className="text-[10px] text-[var(--sage-dim)]">{new Date(m.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-body)]">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.06] p-3">
            {user && (me || admin) ? (
              <div className="flex items-end gap-2">
                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  rows={1}
                  placeholder="Message the event…"
                  className="max-h-24 min-h-[42px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]"
                />
                <button onClick={sendChat} disabled={!chatText.trim() || sending} className="shrink-0 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{sending ? "…" : "Send"}</button>
              </div>
            ) : (
              <p className="py-1 text-center text-xs text-[var(--sage-dim)]">{user ? "Check in to join the event chat." : "Sign in and check in to join the event chat."}</p>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Cards */}
      {tab === "scores" && (
      <section>
        <SectionTitle
          right={admin && open && entries.length > 1 ? (
            <div className="flex items-center gap-2">
              <select value={cardSize} onChange={(e) => setCardSize(Number(e.target.value))} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--cream)] outline-none">
                {[3, 4, 5].map((n) => <option key={n} value={n}>cards of {n}</option>)}
              </select>
              <button onClick={doGenerate} disabled={busy} className="rounded-full bg-white/[0.06] px-4 py-1.5 text-xs font-bold text-[var(--cream)] transition-colors hover:bg-white/[0.1] disabled:opacity-50">
                {cards.length ? "Reshuffle" : "Generate cards"}
              </button>
            </div>
          ) : undefined}
        >Cards</SectionTitle>
        {cards.length === 0 ? (
          <p className="text-sm text-[var(--sage-dim)]">No cards yet.{admin ? " Generate them once players check in." : ""}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div key={c.id} className={`${card} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-[family-name:var(--font-heading)] text-sm font-extrabold text-[var(--cream)]">Card {c.number}</span>
                  <span className="rounded-lg bg-[var(--gold-dim)] px-2 py-1 font-mono text-[10px] font-bold text-[var(--gold)]">HOLE {c.startHole}</span>
                </div>
                <div className="space-y-2">
                  {c.playerIds.map((pid) => (
                    <div key={pid} className="flex items-center gap-2 text-sm text-[var(--text-body)]">
                      <UserLink username={usernameById(pid)}><Avatar url={entryOf(pid)?.photo} name={nameById(pid)} size={22} ring={false} /></UserLink>
                      <UserLink username={usernameById(pid)} className="truncate">{nameById(pid)}</UserLink>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
      </div>
    </main>
  );
}
