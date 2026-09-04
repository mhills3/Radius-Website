"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getLeagueBySlug, getLeagueEvents, getLeagueMembers, getEntries, updateEntry, checkInEntry, getCards, generateGroups, setCardTeeTime, setCardStartHole, shiftEventTeeTimesByRound, moveEntryToCard, getCourseHoleCount, updateEventDetails, createEvents, deleteEvent, computeStandings, updateLeagueSettings, setAcePot, setMemberRoles, setMemberDivision, setLeagueLogo, isLeagueAdmin, subscribeLeagueTeams, createLeagueTeam, updateLeagueTeam, deleteLeagueTeam, subscribeLeagueMatches, generateSchedule, setMatchResult, computeMatchStandings, generateBracket, advanceBracket, LEAGUE_FORMATS, TEAM_SIZES, START_FORMATS, isTeamFormat, SUGGESTED_DIVISIONS, type League, type LeagueEvent, type LeagueMember, type EventEntry, type EventCard, type StandingRow, type LeagueTeam, type LeagueMatch } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { storage } from "@/lib/firebase";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { inputCls, FieldLabel, Segmented, Avatar, Pos, btnGold, btnGhost, card, cardHover, IconCalendar, IconUsers, IconPlus, IconPin, IconClock, IconShare } from "@/components/leagues/ui";

// ─── League tools: the director console (UDisc "League tools" equivalent).
// Persistent sidebar, dashboard-first, every admin control in one place.

type Section = "dashboard" | "members" | "teams" | "matchplay" | "events" | "teetimes" | "standings" | "settings" | "quicklink";
const fmtHM = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const fmtDate = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateInput = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const toTimeInput = (ms: number) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const rowInput = "rounded-xl border border-[var(--hair-strong)] bg-[var(--card)] px-3.5 py-3 text-base text-[var(--cream)] outline-none transition-colors focus:border-[var(--gold)] [color-scheme:dark]";
function edFromEvent(ev: LeagueEvent) {
  const rs = ev.roundStarts ?? [];
  const start = rs[0] ?? ev.date;
  const extra = Array.from({ length: Math.max(0, ev.roundCount - 1) }, (_, i) => { const ms = rs[i + 1] ?? start; return { date: toDateInput(ms), time: toTimeInput(ms) }; });
  const regMs = ev.registrationCloseAt || start;
  return { name: ev.name, date: toDateInput(start), time: toTimeInput(start), rounds: ev.roundCount, holes: ev.holes, buyIn: ev.buyIn ? String(ev.buyIn) : "", cap: ev.capacity ? String(ev.capacity) : "", extra, reg: `${toDateInput(regMs)}T${toTimeInput(regMs)}`, teeSize: ev.teeGroupSize ?? 4, teeInterval: ev.teeIntervalMin ?? 10 };
}
const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

export default function LeagueManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [league, setLeague] = useState<League | null | undefined>(undefined);
  const [brandNote, setBrandNote] = useState("");
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [entries, setEntries] = useState<EventEntry[]>([]); // primary event's entries — powers per-player division control
  const [teeCards, setTeeCards] = useState<EventCard[]>([]); // selected event's tee-time groups
  const [teeEntries, setTeeEntries] = useState<EventEntry[]>([]); // selected event's entries (names/photos)
  const [teeEventId, setTeeEventId] = useState<string | null>(null); // which event's tee sheet (leagues have many)
  const [teeSize, setTeeSize] = useState(4);
  const [teeInt, setTeeInt] = useState(10);
  const [flexEnd, setFlexEnd] = useState(""); // Flex play-window end (datetime-local)
  const [courseHoleCount, setCourseHoleCount] = useState<number | null>(null); // real hole count of the event's course
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [cid, setCid] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Settings drafts
  const [divisionsList, setDivisionsList] = useState<string[]>([]);
  const [newDivision, setNewDivision] = useState("");
  const [teamSizeDraft, setTeamSizeDraft] = useState(2);
  const [bestNDraft, setBestNDraft] = useState("");
  const [modelDraft, setModelDraft] = useState<"placement" | "strokeplay" | "matchplay">("placement");
  const [curveDraft, setCurveDraft] = useState<"linear" | "decay" | "table">("linear");
  const [curveTableDraft, setCurveTableDraft] = useState<number[]>([]);
  const [viewDraft, setViewDraft] = useState<"gross" | "net" | "both">("gross");
  const [descDraft, setDescDraft] = useState("");
  const [hcpPctDraft, setHcpPctDraft] = useState("");
  const [hcpCapDraft, setHcpCapDraft] = useState("");
  const [bagTagsDraft, setBagTagsDraft] = useState(false);
  const [checkInsDraft, setCheckInsDraft] = useState(false);
  const [caddyDraft, setCaddyDraft] = useState(true);
  const [acePotDraft, setAcePotDraft] = useState("");
  const [formatDraft, setFormatDraft] = useState<string>(LEAGUE_FORMATS[0]);
  const [startDraft, setStartDraft] = useState<string>(START_FORMATS[0]);
  const [saved, setSaved] = useState(false);

  // Scheduler
  const [evName, setEvName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("17:30");
  const [weeks, setWeeks] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [buyIn, setBuyIn] = useState("");
  const [holes, setHoles] = useState(18);
  const [cap, setCap] = useState("");

  // Event editor (single-event / tournament containers). `extra` holds round 2..N day/time.
  const [ed, setEd] = useState<{ name: string; date: string; time: string; rounds: number; holes: number; buyIn: string; cap: string; extra: { date: string; time: string }[]; reg: string; teeSize: number; teeInterval: number }>({ name: "", date: "", time: "17:30", rounds: 1, holes: 18, buyIn: "", cap: "", extra: [], reg: "", teeSize: 4, teeInterval: 10 });
  const [eventSaved, setEventSaved] = useState(false);
  const [editEvent, setEditEvent] = useState(false); // false = clean summary, true = edit form

  const [roleMenu, setRoleMenu] = useState<string | null>(null); // which member's role checklist is open

  useEffect(() => {
    getLeagueBySlug(slug).then((l) => {
      setLeague(l ?? null);
      if (l) {
        getLeagueEvents(l.id).then(setEvents).catch(() => {});
        getLeagueMembers(l.id).then(setMembers).catch(() => {});
        computeStandings(l.id, l.settings.bestN).then(setStandings).catch(() => {});
        setDivisionsList((l.settings.divisions ?? []).length > 1 ? (l.settings.divisions ?? []) : []);
        setTeamSizeDraft(l.settings.teamSize && l.settings.teamSize > 0 ? l.settings.teamSize : 2);
        setBestNDraft(l.settings.bestN ? String(l.settings.bestN) : "");
        setModelDraft(l.settings.scoring?.model ?? "placement");
        setCurveDraft(l.settings.scoring?.curve === "decay" ? "decay" : l.settings.scoring?.curve === "table" ? "table" : "linear");
        setCurveTableDraft(Array.isArray(l.settings.scoring?.curveTable) && l.settings.scoring!.curveTable!.length ? l.settings.scoring!.curveTable! : []);
        setViewDraft(l.settings.scoring?.view ?? "gross");
        setDescDraft(l.settings.description);
        setHcpPctDraft(l.settings.handicapPercent ? String(l.settings.handicapPercent) : "");
        setHcpCapDraft(l.settings.handicapCap ? String(l.settings.handicapCap) : "");
        setBagTagsDraft(l.settings.bagTags === true);
        setCheckInsDraft(l.settings.checkIns === true);
        setCaddyDraft(l.settings.caddyAllowed !== false);
        setAcePotDraft(l.acePotBalance != null ? String(l.acePotBalance) : "");
        setFormatDraft(l.settings.format);
        setStartDraft(l.settings.startFormat);
      }
    }).catch(() => setLeague(null));
  }, [slug]);
  useEffect(() => { if (user) resolveCanonicalId(user.uid).then(setCid).catch(() => {}); }, [user]);
  useEffect(() => { if (!league?.id) return; return subscribeLeagueTeams(league.id, setTeams); }, [league?.id]);
  useEffect(() => { if (!league?.id) return; return subscribeLeagueMatches(league.id, setMatches); }, [league?.id]);

  const admin = useMemo(() => !!league && isLeagueAdmin(league, cid), [league, cid]);
  const [now] = useState(() => Date.now());
  // Multi-day events stay "upcoming/live" until their LAST round (+ buffer), not just round 1.
  const eventEnd = (e: LeagueEvent) => (e.roundStarts && e.roundStarts.length ? e.roundStarts[e.roundStarts.length - 1] : e.date);
  const upcoming = events.filter((e) => e.status !== "complete" && e.status !== "cancelled" && eventEnd(e) > now - 12 * 3600_000);
  const past = events.filter((e) => !upcoming.includes(e)).reverse();
  const photoOf = useMemo(() => new Map(members.map((m) => [m.id, m.photo])), [members]);

  const isMatchPlay = league?.settings.scoring?.model === "matchplay";
  const isTeamLeague = isTeamFormat(league?.settings.format);
  // Container nature drives the console wording: a tournament shouldn't say "League" everywhere.
  const containerKind = league?.kind || upcoming[0]?.kind || past[0]?.kind || events[0]?.kind || "league";
  const isLeagueKind = containerKind === "league";
  const NOUN = isLeagueKind ? "League" : containerKind === "tournament" ? "Tournament" : "Event";
  const nextEvent = upcoming[0] ?? null;
  const primaryEvent = nextEvent ?? past[0] ?? events[0] ?? null;
  const primaryEventId = primaryEvent?.id ?? null;
  const divisions = (league?.settings.divisions ?? []).filter((d) => d && d !== "Open").length ? (league!.settings.divisions ?? []) : [];
  useEffect(() => { if (!primaryEventId) { setEntries([]); return; } getEntries(primaryEventId).then(setEntries).catch(() => {}); }, [primaryEventId]);
  const entryOf = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  // Tee sheet targets a selectable event (leagues have many); defaults to the next/primary event.
  const teeEvent = events.find((e) => e.id === teeEventId) ?? primaryEvent;
  const teeEid = teeEvent?.id ?? null;
  useEffect(() => { setTeeEventId(primaryEventId); }, [primaryEventId]);
  useEffect(() => { if (!teeEid) { setTeeCards([]); setTeeEntries([]); return; } getCards(teeEid).then(setTeeCards).catch(() => {}); getEntries(teeEid).then(setTeeEntries).catch(() => {}); }, [teeEid]);
  useEffect(() => { if (teeEvent) { setTeeSize(teeEvent.teeGroupSize ?? 4); setTeeInt(teeEvent.teeIntervalMin ?? 10); setFlexEnd(teeEvent.windowEndsAt ? `${toDateInput(teeEvent.windowEndsAt)}T${toTimeInput(teeEvent.windowEndsAt)}` : ""); } }, [teeEid]); // eslint-disable-line react-hooks/exhaustive-deps
  const teeEntryOf = useMemo(() => new Map(teeEntries.map((e) => [e.id, e])), [teeEntries]);
  useEffect(() => { const cid2 = teeEvent?.courseId; if (!cid2) { setCourseHoleCount(null); return; } getCourseHoleCount(cid2).then(setCourseHoleCount).catch(() => setCourseHoleCount(null)); }, [teeEvent?.courseId]);
  // Prefer the EVENT's configured hole count (the layout being played) over the course base — a
  // shotgun on an 18-hole layout at a 9-basket course must spread across 18, not 9.
  const holeCount = teeEvent?.holes ?? courseHoleCount ?? 18;
  useEffect(() => { if (primaryEvent) setEd(edFromEvent(primaryEvent)); }, [primaryEventId]); // eslint-disable-line react-hooks/exhaustive-deps
  // A tournament/one-off is really a single event — exit straight to it, skipping the container page.
  const exitHref = !isLeagueKind && primaryEvent ? `/leagues/${slug}/e/${primaryEvent.id}` : `/leagues/${slug}`;
  const scoringContainer = containerKind === "league" || containerKind === "tournament";
  const startsNoun = (f?: string) => (f === "Tee times" ? "Tee times" : f === "Shotgun" ? "Shotgun" : "Groups");
  const teeFormat = teeEvent?.startFormat ?? "Shotgun";
  // Day-of check-in: enabled per-league, unlocks ~3h before the event start.
  const checkInsOn = league?.settings.checkIns === true;
  const checkInOpen = !!(checkInsOn && primaryEvent && now >= primaryEvent.date - 3 * 3600_000);
  const nav: { key: Section; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "members", label: "Players" },
    ...(isTeamLeague ? [{ key: "teams" as const, label: "Teams" }] : []),
    ...(isMatchPlay ? [{ key: "matchplay" as const, label: "Match play" }] : []),
    { key: "events", label: isLeagueKind ? "Events" : "Event" },
    ...(scoringContainer && primaryEvent ? [{ key: "teetimes" as const, label: startsNoun(primaryEvent.startFormat) }] : []),
    { key: "settings", label: "Settings" },
    { key: "quicklink", label: "Quick link" },
  ];

  const manualDone = league?.settings.checklistDone ?? [];
  const checklist = league ? [
    { key: "settings", label: `${NOUN} settings`, done: !!league.settings.description || (league.settings.divisions ?? []).length > 1, hint: "Description, format, and defaults", go: "settings" as Section },
    { key: "divisions", label: "Divisions", done: (league.settings.divisions ?? []).length > 1, hint: "Add divisions so players self-sort at check-in", go: "settings" as Section },
    { key: "schedule", label: isLeagueKind ? "First event" : "Schedule it", done: events.length > 0, hint: isLeagueKind ? "Schedule a night or a whole season" : "Set the date, rounds, and tee times", go: "events" as Section },
    { key: "scoring", label: "Scoring configured", done: !!league.settings.scoring?.model || !!league.settings.bestN || standings.length > 0, hint: "Model, points-per-place, and best-N", go: "settings" as Section },
  ].map((c) => ({ ...c, done: c.done || manualDone.includes(c.key) })) : [];

  const toggleChecklist = async (key: string) => {
    if (!league) return;
    const next = manualDone.includes(key) ? manualDone.filter((k) => k !== key) : [...manualDone, key];
    const settings = { ...league.settings, checklistDone: next };
    setLeague({ ...league, settings });
    await updateLeagueSettings(league.id, settings);
  };

  // Setup checklist: celebrate on completion, then gracefully collapse away (instead of cutting).
  const allDone = checklist.length > 0 && checklist.every((c) => c.done);
  const [checklistPhase, setChecklistPhase] = useState<"list" | "celebrate" | "collapse" | "gone">("list");
  const prevAllDone = useRef<boolean | null>(null);
  useEffect(() => {
    if (!league) return;
    const prev = prevAllDone.current;
    prevAllDone.current = allDone;
    if (prev === null) { setChecklistPhase(allDone ? "gone" : "list"); return; }
    if (allDone && !prev) setChecklistPhase("celebrate");
    else if (!allDone) setChecklistPhase("list");
  }, [league, allDone]);
  useEffect(() => {
    if (checklistPhase === "celebrate") { const t = setTimeout(() => setChecklistPhase("collapse"), 1900); return () => clearTimeout(t); }
    if (checklistPhase === "collapse") { const t = setTimeout(() => setChecklistPhase("gone"), 650); return () => clearTimeout(t); }
  }, [checklistPhase]);

  const saveSettings = async () => {
    if (!league || busy) return;
    setBusy(true); setSaved(false);
    try {
      const divisions = divisionsList.map((x) => x.trim()).filter(Boolean);
      const bestN = Number(bestNDraft) > 0 ? Math.floor(Number(bestNDraft)) : undefined;
      const handicapPercent = Number(hcpPctDraft) > 0 ? Math.min(150, Math.floor(Number(hcpPctDraft))) : undefined;
      const handicapCap = Number(hcpCapDraft) > 0 ? Math.floor(Number(hcpCapDraft)) : undefined;
      const scoring = { ...(league.settings.scoring ?? {}), model: modelDraft, view: viewDraft, aggregate: (bestN ? "bestN" : "sum") as "sum" | "bestN",
        curve: modelDraft === "placement" ? curveDraft : undefined,
        curveTable: modelDraft === "placement" && curveDraft === "table" && curveTableDraft.length ? curveTableDraft.map((n) => Math.max(0, Math.round(n))) : undefined };
      const settings = { ...league.settings, format: formatDraft, teamSize: isTeamFormat(formatDraft) ? teamSizeDraft : undefined, startFormat: startDraft, divisions: divisions.length > 1 ? divisions : undefined, bestN, handicapPercent, handicapCap, bagTags: bagTagsDraft, checkIns: checkInsDraft, caddyAllowed: caddyDraft, description: descDraft.trim(), scoring };
      await updateLeagueSettings(league.id, settings);
      const acePot = acePotDraft.trim() !== "" && Number(acePotDraft) >= 0 ? Number(acePotDraft) : undefined;
      if (acePot != null && acePot !== league.acePotBalance) await setAcePot(league.id, acePot);
      setLeague({ ...league, acePotBalance: acePot ?? league.acePotBalance, settings: { ...settings, divisions: divisions.length > 1 ? divisions : ["Open"] } });
      // Propagate format/start-format to not-yet-complete events so existing events reflect the change.
      if (startDraft !== league.settings.startFormat || formatDraft !== league.settings.format) {
        const live = events.filter((e) => e.status !== "complete" && e.status !== "cancelled");
        await Promise.all(live.map((e) => updateEventDetails(e.id, { startFormat: startDraft, format: formatDraft })));
        if (live.length) { const fresh = await getLeagueEvents(league.id); setEvents(fresh); }
      }
      computeStandings(league.id, bestN).then(setStandings).catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setBusy(false); }
  };

  const addDivision = (name?: string) => {
    const v = (name ?? newDivision).trim();
    if (!v) return;
    if (!divisionsList.some((d) => d.toLowerCase() === v.toLowerCase())) setDivisionsList((xs) => [...xs, v]);
    setNewDivision("");
  };

  const assignDivision = async (memberId: string, division: string) => {
    if (!league) return;
    // League default on the member, and — if they're entered in the primary event — stamp the entry
    // so tee-time grouping and division standings pick it up immediately.
    await setMemberDivision(league.id, memberId, division);
    setMembers((cur) => cur.map((m) => (m.id === memberId ? { ...m, division: division || undefined } : m)));
    if (primaryEventId && entryOf.has(memberId)) {
      await updateEntry(primaryEventId, memberId, { division });
      setEntries((cur) => cur.map((e) => (e.id === memberId ? { ...e, division: division || undefined } : e)));
    }
  };

  const startEditEvent = () => {
    if (primaryEvent) setEd(edFromEvent(primaryEvent));
    setEditEvent(true);
  };

  const reloadTee = async () => { if (teeEid) setTeeCards(await getCards(teeEid)); };
  const genTee = async () => {
    if (!teeEvent || busy) return;
    setBusy(true);
    try {
      await generateGroups(teeEvent.id, teeEntries, { format: teeEvent.startFormat, size: teeSize, intervalMin: teeInt, roundStarts: teeEvent.roundStarts ?? [teeEvent.date], roundCount: teeEvent.roundCount, divisions: league?.settings.divisions, holeCount });
      await reloadTee();
      const fresh = await getLeagueEvents(league!.id); setEvents(fresh);
    } finally { setBusy(false); }
  };
  const editTee = async (cardId: string, hhmm: string) => {
    if (!teeEvent || !hhmm) return;
    const rnd = teeCards.find((c) => c.id === cardId)?.round ?? 1;
    const base = new Date(teeEvent.roundStarts?.[rnd - 1] ?? teeEvent.date);
    const [h, m] = hhmm.split(":").map(Number);
    base.setHours(h, m, 0, 0);
    setTeeCards((cur) => cur.map((c) => (c.id === cardId ? { ...c, teeTime: base.getTime() } : c)));
    await setCardTeeTime(teeEvent.id, cardId, base.getTime());
  };
  const editHole = async (cardId: string, hole: number) => {
    if (!teeEvent || !hole) return;
    setTeeCards((cur) => cur.map((c) => (c.id === cardId ? { ...c, startHole: hole } : c)));
    await setCardStartHole(teeEvent.id, cardId, hole);
  };
  const saveFlexWindow = async () => {
    if (!teeEvent || busy) return;
    setBusy(true);
    try {
      await updateEventDetails(teeEvent.id, { windowEndsAt: flexEnd ? new Date(flexEnd).getTime() : null });
      const fresh = await getLeagueEvents(league!.id); setEvents(fresh);
    } finally { setBusy(false); }
  };
  const moveTee = async (pid: string, toCardId: string) => {
    if (!teeEvent) return;
    await moveEntryToCard(teeEvent.id, pid, toCardId);
    await reloadTee();
  };

  const setRoundTime = (i: number, patch: { date?: string; time?: string }) =>
    setEd((s) => { const extra = [...(s.extra ?? [])]; while (extra.length <= i) extra.push({ date: s.date, time: s.time }); extra[i] = { ...extra[i], ...patch }; return { ...s, extra }; });

  const saveEvent = async () => {
    if (!league || !primaryEvent || busy || !ed.date) return;
    setBusy(true); setEventSaved(false);
    try {
      const round1 = new Date(`${ed.date}T${ed.time || "17:30"}`).getTime();
      const roundStarts = ed.rounds > 1
        ? [round1, ...Array.from({ length: ed.rounds - 1 }, (_, i) => {
            const rv = ed.extra?.[i];
            return new Date(`${rv?.date || ed.date}T${rv?.time || ed.time || "17:30"}`).getTime();
          })]
        : null;
      // If any round's start moved, shift that round's tee groups by its own delta so the sheet
      // follows the new dates (keeps the director's grouping + relative stagger).
      const oldStarts = primaryEvent.roundStarts && primaryEvent.roundStarts.length > 1 ? primaryEvent.roundStarts : [primaryEvent.date];
      const newStarts = roundStarts ?? [round1];
      const deltas = newStarts.map((s, i) => s - (oldStarts[i] ?? oldStarts[oldStarts.length - 1] ?? primaryEvent.date));
      await updateEventDetails(primaryEvent.id, {
        name: ed.name, date: round1, roundStarts, roundCount: ed.rounds, holes: ed.holes,
        buyIn: ed.buyIn.trim() === "" ? null : Number(ed.buyIn), capacity: ed.cap.trim() === "" ? null : Number(ed.cap),
        registrationCloseAt: ed.reg ? new Date(ed.reg).getTime() : null,
      });
      if (primaryEvent.startFormat === "Tee times" && deltas.some((d) => d !== 0)) {
        await shiftEventTeeTimesByRound(primaryEvent.id, deltas);
        if (teeEid === primaryEvent.id) setTeeCards(await getCards(primaryEvent.id));
      }
      const fresh = await getLeagueEvents(league.id); setEvents(fresh);
      setEditEvent(false); // collapse back to the clean summary
      setEventSaved(true); setTimeout(() => setEventSaved(false), 2500);
    } finally { setBusy(false); }
  };

  const [confirmDel, setConfirmDel] = useState(false);
  const deleteThisEvent = async () => {
    if (!league || !primaryEvent || busy) return;
    setBusy(true);
    try {
      await deleteEvent(primaryEvent.id);
      setConfirmDel(false);
      router.push("/leagues"); // leave the just-deleted event's director tools → Events home
    } catch { setBusy(false); }
  };

  const toggleCheckIn = async (memberId: string) => {
    if (!primaryEventId) return;
    const arrived = !entryOf.get(memberId)?.arrivedAt;
    const at = Date.now();
    setEntries((cur) => cur.map((e) => (e.id === memberId ? { ...e, arrivedAt: arrived ? at : undefined } : e)));
    await checkInEntry(primaryEventId, memberId, arrived, at);
  };

  // Role checklist (a person can be several at once). Owner is implicit and not editable here.
  const rolesOf = (m: LeagueMember): string[] => (m.roles && m.roles.length ? m.roles : m.role === "director" ? ["director"] : ["player"]);
  const toggleRole = async (m: LeagueMember, key: string) => {
    if (!league) return;
    const cur = rolesOf(m);
    const next = cur.includes(key) ? cur.filter((r) => r !== key) : [...cur, key];
    const role = next.includes("admin") || next.includes("director") ? "director" : "member";
    setMembers((c) => c.map((x) => (x.id === m.id ? { ...x, roles: next as LeagueMember["roles"], role } : x)));
    await setMemberRoles(league.id, m.id, next);
  };

  const schedule = async () => {
    if (!user || !league || !startDate || busy) return;
    setBusy(true);
    try {
      const base = new Date(`${startDate}T${startTime || "17:30"}`);
      const dates = Array.from({ length: Math.max(1, Math.min(weeks, 26)) }, (_, i) => base.getTime() + i * 7 * 24 * 3600_000);
      const created = await createEvents(user.uid, league, { name: evName, dates, roundCount: rounds, holes, buyIn: Number(buyIn) > 0 ? Number(buyIn) : undefined, capacity: Number(cap) > 0 ? Number(cap) : undefined, kind: containerKind });
      setEvents((prev) => [...prev, ...created].sort((a, b) => a.date - b.date));
      setEvName("");
    } finally { setBusy(false); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* unavailable */ }
  };

  if (league === undefined) return <main className="mx-auto max-w-5xl px-5 pt-16 text-sm text-[var(--sage-dim)]">Loading…</main>;
  if (league === null) return <main className="mx-auto max-w-5xl px-5 pt-16"><p className="text-sm text-[var(--sage-dim)]">Not found.</p></main>;
  if (!admin) return (
    <main className="mx-auto max-w-5xl px-5 pt-16">
      <p className="text-sm text-[var(--sage-dim)]">Director tools are for directors of this league. <Link href={`/leagues/${league.slug}`} className="font-bold text-[var(--gold)] hover:underline">Back to {league.name}</Link></p>
    </main>
  );

  const EventRow = ({ ev }: { ev: LeagueEvent }) => (
    <Link href={`/leagues/${league.slug}/e/${ev.id}`} className={`${card} ${cardHover} group flex items-center gap-3.5 p-3.5`}>
      <div className="w-9 shrink-0 leading-[1.15]">
        <div className="text-[9.5px] uppercase tracking-[0.2em] text-[var(--cream-38)]">{new Date(ev.date).toLocaleDateString(undefined, { month: "short" })}</div>
        <div className="text-[20px] font-bold text-[var(--cream)]">{new Date(ev.date).getDate()}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-[var(--cream)]">{ev.name}</div>
        <div className="truncate text-xs text-[var(--cream-38)]">
          {ev.roundStarts && ev.roundStarts.length > 1
            ? ev.roundStarts.map((ms, i) => `R${i + 1} ${new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`).join(" · ")
            : fmtDate(ev.date)}
          {ev.entryCount > 0 ? <> · <span className="">{ev.entryCount}</span> in</> : ""}
        </div>
      </div>
      {ev.status === "scheduled" && Date.now() >= ev.date && Date.now() <= ev.date + 6 * 3600_000 && ev.entryCount > 0 ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--blue-dim)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--blue)]"><span className="live-dot h-1 w-1 rounded-full bg-[var(--blue)]" />Live</span>
      ) : (
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${ev.status === "cancelled" ? "border-[#f08c8c]/25 text-[#f08c8c]" : "border-[var(--hair)] text-[var(--cream-60)]"}`}>{ev.status}</span>
      )}
    </Link>
  );

  return (
    <div className="relative mx-auto max-w-6xl px-5 pb-24">
      {/* Console header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] py-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Director tools</p>
          <h1 className="mt-0.5 font-[family-name:var(--font-heading)] text-xl font-extrabold text-[var(--cream)]">{league.name}</h1>
        </div>
        <Link href={exitHref} className="text-xs font-bold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">Exit director tools →</Link>
      </div>

      <div className="grid gap-8 pt-8 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-6 lg:flex-col lg:self-start">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => setSection(n.key)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-bold transition-colors ${section === n.key ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "text-[var(--cream-60)] hover:bg-[var(--card)] hover:text-[var(--cream)]"}`}
            >{n.label}</button>
          ))}
        </nav>

        {/* Content */}
        <div className="min-w-0">
          {section === "dashboard" && (
            <div className="grid gap-8">
              {/* Setup checklist — celebrates completion, then gracefully collapses away */}
              {checklistPhase !== "gone" && (
              <div className={`overflow-hidden transition-all duration-[600ms] ease-out ${checklistPhase === "collapse" ? "-mt-8 max-h-0 -translate-y-3 opacity-0" : "max-h-[760px] opacity-100"}`}>
                {checklistPhase === "list" ? (
                <div className={`${card} p-6`}>
                  <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{NOUN} setup · {checklist.filter((c) => c.done).length}/{checklist.length} complete</h2>
                  <div className="mt-4 grid gap-2">
                    {checklist.map((c, ci) => {
                      const isNext = !c.done && checklist.findIndex((x) => !x.done) === ci;
                      return (
                      <div key={c.key} className={`group flex items-center gap-3 rounded-xl border border-[var(--hair)] bg-[var(--forest)] px-4 py-3 transition-colors hover:border-[var(--hair-strong)] ${isNext ? "border-l-[3px] border-l-[rgba(232,181,96,0.45)]" : ""}`}>
                        <button onClick={() => toggleChecklist(c.key)} title={c.done ? "Mark not done" : "Mark done"} className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors ${c.done ? "bg-[var(--gold)] text-[#141B16]" : isNext ? "border border-[var(--gold)]/60 text-transparent hover:border-[var(--gold)]" : "border border-[var(--hair-strong)] text-transparent hover:border-[var(--cream-38)]"}`}>✓</button>
                        <button onClick={() => setSection(c.go)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-bold ${c.done ? "text-[var(--cream-38)] line-through decoration-[var(--hair-strong)]" : "text-[var(--cream)]"}`}>{c.label}</span>
                            <span className="block text-xs text-[var(--cream-38)]">{c.hint}</span>
                          </span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--cream-38)] group-hover:text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                      </div>
                      );
                    })}
                  </div>
                </div>
                ) : (
                <div className={`${card} fade-up relative overflow-hidden p-8 text-center`}>
                  <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-40 max-w-md" style={{ background: "radial-gradient(200px 140px at 50% -10%, rgba(232,181,96,0.22), transparent 70%)" }} />
                  <div className="check-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--gold)] text-[#141B16]" style={{ boxShadow: "0 0 0 6px rgba(232,181,96,0.12), 0 0 34px rgba(232,181,96,0.4)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8"><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="mt-5 font-[family-name:var(--font-heading)] text-xl font-black text-[var(--cream)]">You&apos;re all set</h2>
                  <p className="mt-1.5 text-sm text-[var(--cream-60)]">{NOUN} setup complete — you&apos;re ready to run it.</p>
                </div>
                )}
              </div>
              )}

              {/* Quick navigation */}
              <div className="grid gap-3 sm:grid-cols-3">
                <button onClick={() => setSection("quicklink")} className={`${card} ${cardHover} group p-6 text-left`}>
                  <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--gold-dim)] text-[var(--gold)]"><IconShare /></span>
                  <div className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">Share</div>
                  <div className="mt-0.5 text-xs text-[var(--cream-60)]">Public page &amp; check-in links.</div>
                </button>
                <button onClick={() => setSection("events")} className={`${card} ${cardHover} group p-6 text-left`}>
                  <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--gold-dim)] text-[var(--gold)]"><IconCalendar /></span>
                  <div className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">All events</div>
                  <div className="mt-0.5 text-xs text-[var(--cream-60)]">{upcoming.length} upcoming · {past.length} past</div>
                </button>
                <button onClick={() => setSection("members")} className={`${card} ${cardHover} group p-6 text-left`}>
                  <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--gold-dim)] text-[var(--gold)]"><IconUsers /></span>
                  <div className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">Players</div>
                  <div className="mt-0.5 text-xs text-[var(--cream-60)]">{members.length} player{members.length === 1 ? "" : "s"} · roles &amp; divisions</div>
                </button>
              </div>

              {/* Upcoming */}
              <div>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Upcoming events</h3>
                {upcoming.length === 0 ? <p className="text-sm text-[var(--sage-dim)]">Nothing scheduled. Create the first event.</p> : <div className="grid gap-2.5">{upcoming.slice(0, 5).map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>}
              </div>
            </div>
          )}

          {section === "members" && (
            <div className="grid gap-4">
            {checkInsOn && (
              <p className="px-1 text-[11px] font-semibold text-[var(--gold)]">{checkInOpen ? "Check-in is open — mark players in as they arrive." : primaryEvent ? `Check-in unlocks ~3h before start (${fmtDate(primaryEvent.date)}).` : "Check-in is on; it unlocks ~3h before the event."}</p>
            )}
            <div className={card}>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3.5 border-b border-white/[0.05] px-5 py-3.5 last:border-b-0">
                  {m.username ? <Link href={`/u/${m.username}`}><Avatar url={m.photo} name={m.name} size={36} /></Link> : <Avatar url={m.photo} name={m.name} size={36} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {m.username ? <Link href={`/u/${m.username}`} className="truncate text-sm font-bold text-[var(--cream)] hover:underline">{m.name}</Link> : <span className="truncate text-sm font-bold text-[var(--cream)]">{m.name}</span>}
                      {typeof m.tag === "number" && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-bold text-[var(--cream)]">#{m.tag}</span>}
                    </span>
                    {m.username && <span className="block text-xs text-[var(--sage-dim)]">@{m.username}</span>}
                  </span>
                  {checkInsOn && entryOf.has(m.id) && (
                    checkInOpen ? (
                      <button onClick={() => toggleCheckIn(m.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${entryOf.get(m.id)?.arrivedAt ? "bg-[#5fcf80]/15 text-[#5fcf80] hover:bg-[#5fcf80]/25" : "border border-[var(--hair-strong)] text-[var(--cream-60)] hover:text-[var(--cream)]"}`}>{entryOf.get(m.id)?.arrivedAt ? "✓ Checked in" : "Check in"}</button>
                    ) : entryOf.get(m.id)?.arrivedAt ? (
                      <span className="shrink-0 rounded-full bg-[#5fcf80]/15 px-3 py-1.5 text-xs font-bold text-[#5fcf80]">✓ Checked in</span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-[var(--hair)] px-3 py-1.5 text-xs font-semibold text-[var(--cream-38)]">Check-in locked</span>
                    )
                  )}
                  {divisions.length > 1 && (
                    <select
                      value={entryOf.get(m.id)?.division ?? m.division ?? ""}
                      onChange={(e) => assignDivision(m.id, e.target.value)}
                      title="Player division"
                      className="shrink-0 rounded-lg border border-[var(--hair-strong)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--cream)] outline-none transition-colors focus:border-[var(--gold)]"
                    >
                      <option value="">No division</option>
                      {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                  {m.role === "owner" ? (
                    <span className="shrink-0 rounded-full bg-[var(--gold-dim)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[var(--gold)]">Owner</span>
                  ) : (() => {
                    const roles = rolesOf(m);
                    const label = roles.length ? roles.map((r) => r[0].toUpperCase() + r.slice(1)).join(" · ") : "No role";
                    return (
                      <div className="relative shrink-0">
                        <button onClick={() => setRoleMenu(roleMenu === m.id ? null : m.id)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:border-[var(--cream-38)]">
                          {label}
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3 text-[var(--cream-38)]"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                        {roleMenu === m.id && (
                          <>
                            <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setRoleMenu(null)} />
                            <div className="absolute right-0 top-full z-20 mt-2 min-w-[170px] rounded-xl border border-[var(--hair)] bg-[var(--card-raised)] p-1.5">
                              {[{ key: "player", label: "Player", hint: "Plays in the event" }, { key: "admin", label: "Admin", hint: "Can manage" }, { key: "director", label: "Director", hint: "Runs the show" }].map((r) => {
                                const on = roles.includes(r.key);
                                return (
                                  <button key={r.key} onClick={() => toggleRole(m, r.key)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]">
                                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-black ${on ? "border-[var(--gold)] bg-[var(--gold)] text-[#141B16]" : "border-[var(--hair-strong)] text-transparent"}`}>✓</span>
                                    <span className="min-w-0"><span className="block text-[13px] font-semibold text-[var(--cream)]">{r.label}</span><span className="block text-[10.5px] text-[var(--cream-38)]">{r.hint}</span></span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
              {divisions.length > 1 && members.length > 0 && (
                <p className="px-5 py-3 text-[11px] text-[var(--sage-dim)]">Set each player&apos;s division — it flows into their event entry, tee-time grouping, and division standings.</p>
              )}
              {members.length === 0 && <p className="p-6 text-sm text-[var(--sage-dim)]">No players yet. Share an event check-in link.</p>}
            </div>
            </div>
          )}

          {section === "teams" && (() => {
            const assigned = new Set(teams.flatMap((t) => t.memberIds));
            const unassigned = members.filter((m) => !assigned.has(m.id));
            const addTo = (t: LeagueTeam, memberId: string) => updateLeagueTeam(league.id, t.id, { memberIds: [...t.memberIds, memberId] });
            const removeFrom = (t: LeagueTeam, memberId: string) => updateLeagueTeam(league.id, t.id, { memberIds: t.memberIds.filter((x) => x !== memberId) });
            return (
              <div className="space-y-5">
                <div className={`${card} p-5`}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">Teams · {teams.length}</h2>
                    <button onClick={() => createLeagueTeam(league.id, `Team ${teams.length + 1}`)} className={`${btnGold} !px-4 !py-2 !text-sm`}>+ New team</button>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--sage-dim)]">Players sign up individually and can request a partner. You form and own the teams here — reshuffle any time during the season.</p>
                </div>

                {teams.map((t) => (
                  <div key={t.id} className={`${card} p-4`}>
                    <div className="flex items-center gap-2">
                      <input defaultValue={t.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) updateLeagueTeam(league.id, t.id, { name: v }); }} className={`${inputCls} !py-1.5 font-bold`} />
                      <button onClick={() => deleteLeagueTeam(league.id, t.id)} title="Disband team" className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm text-[var(--sage-dim)] transition-colors hover:bg-white/[0.05] hover:text-[#f08c8c]">✕</button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {t.memberIds.map((id) => { const m = members.find((x) => x.id === id); return (
                        <span key={id} className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] py-1 pl-1 pr-2 ring-1 ring-white/[0.07]">
                          <Avatar url={m?.photo} name={m?.name || "?"} size={22} ring={false} />
                          <span className="text-[13px] font-semibold text-[var(--cream)]">{m?.name || `${id.slice(0, 6)}…`}</span>
                          <button onClick={() => removeFrom(t, id)} title="Remove" className="text-[var(--sage-dim)] transition-colors hover:text-[#f08c8c]">✕</button>
                        </span>
                      ); })}
                      {t.memberIds.length === 0 && <span className="text-xs text-[var(--sage-dim)]">No players yet — add one →</span>}
                      {unassigned.length > 0 && (
                        <select value="" onChange={(e) => { if (e.target.value) addTo(t, e.target.value); }} className={`${inputCls} !w-auto !py-1.5 !text-xs`}>
                          <option value="">+ Add player…</option>
                          {unassigned.map((m) => <option key={m.id} value={m.id}>{m.name}{m.partnerRequest ? ` (wants ${m.partnerRequest})` : ""}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                ))}

                <div className={`${card} p-4`}>
                  <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--cream)]">Unassigned · {unassigned.length}</h3>
                  <div className="mt-3 space-y-2">
                    {unassigned.map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <Avatar url={m.photo} name={m.name} size={28} ring={false} />
                        <span className="min-w-0 flex-1">
                          <span className="truncate text-sm font-semibold text-[var(--cream)]">{m.name}</span>
                          {m.partnerRequest && <span className="ml-2 text-xs font-semibold text-[var(--gold)]">wants: {m.partnerRequest}</span>}
                        </span>
                        {teams.length > 0 ? (
                          <select value="" onChange={(e) => { const t = teams.find((x) => x.id === e.target.value); if (t) addTo(t, m.id); }} className={`${inputCls} !w-auto !py-1.5 !text-xs`}>
                            <option value="">Add to…</option>
                            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        ) : (
                          <button onClick={() => createLeagueTeam(league.id, `${m.name}'s team`, [m.id])} className={`${btnGhost} !px-3 !py-1.5 !text-xs`}>New team</button>
                        )}
                      </div>
                    ))}
                    {unassigned.length === 0 && <p className="text-sm text-[var(--sage-dim)]">Everyone&apos;s on a team.</p>}
                  </div>
                </div>
              </div>
            );
          })()}

          {section === "matchplay" && (() => {
            const sides = teams.length > 0 ? teams.map((t) => ({ id: t.id, name: t.name })) : members.map((m) => ({ id: m.id, name: m.name }));
            const usingTeams = teams.length > 0;
            const reg = matches.filter((m) => !m.bracket);
            const rounds = [...new Set(reg.map((m) => m.round))].sort((a, b) => a - b);
            const mp = computeMatchStandings(matches, league.settings.scoring);
            return (
              <div className="space-y-5">
                <div className={`${card} p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">Match-play schedule</h2>
                      <p className="mt-1 text-xs text-[var(--sage-dim)]">Round-robin across your {usingTeams ? `${teams.length} teams` : `${members.length} players`} — everyone plays everyone once.</p>
                    </div>
                    <button onClick={async () => { if (sides.length < 2 || busy) return; setBusy(true); try { await generateSchedule(league.id, sides); } finally { setBusy(false); } }} disabled={busy || sides.length < 2} className={`${btnGold} !px-4 !py-2 !text-sm`}>{reg.length > 0 ? "Regenerate" : "Generate schedule"}</button>
                  </div>
                  {sides.length < 2 && <p className="mt-2 text-xs text-[#f08c8c]">Add at least 2 {usingTeams ? "teams (in the Teams tab)" : "members"} first.</p>}
                </div>

                {rounds.map((r) => (
                  <div key={r} className={`${card} p-4`}>
                    <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Week {r}</h3>
                    <div className="space-y-2">
                      {reg.filter((m) => m.round === r).map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-sm">
                          <button onClick={() => setMatchResult(league.id, m.id, m.winnerId === m.sideAId ? null : m.sideAId)} className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-right transition-colors ${m.winnerId === m.sideAId ? "bg-[var(--gold)]/15 font-bold text-[var(--gold)]" : "bg-white/[0.05] text-[var(--cream)] hover:bg-white/[0.1]"}`}>{m.sideAName}</button>
                          <button onClick={() => setMatchResult(league.id, m.id, m.winnerId === "tie" ? null : "tie")} className={`shrink-0 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors ${m.winnerId === "tie" ? "bg-white/[0.15] text-[var(--cream)]" : "text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}>tie</button>
                          <button onClick={() => setMatchResult(league.id, m.id, m.winnerId === m.sideBId ? null : m.sideBId)} className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left transition-colors ${m.winnerId === m.sideBId ? "bg-[var(--gold)]/15 font-bold text-[var(--gold)]" : "bg-white/[0.05] text-[var(--cream)] hover:bg-white/[0.1]"}`}>{m.sideBName}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {reg.length === 0 && <div className={`${card} p-6 text-sm text-[var(--sage-dim)]`}>No schedule yet — generate one above once you&apos;ve got your {usingTeams ? "teams" : "players"} set.</div>}

                {mp.length > 0 && (
                  <div className={`${card} overflow-hidden`}>
                    <div className="border-b border-white/[0.05] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Match standings</div>
                    {mp.map((row, i) => (
                      <div key={row.id} className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-2.5 text-sm last:border-b-0">
                        <span className="w-6 text-xs text-[var(--sage-dim)]">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{row.name}</span>
                        <span className="text-xs text-[var(--sage-dim)]">{row.wins}-{row.ties}-{row.losses}</span>
                        <span className="w-10 text-right font-bold text-[var(--gold)]">{row.points}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Playoff bracket */}
                {(() => {
                  const bracket = matches.filter((m) => m.bracket);
                  const brRounds = [...new Set(bracket.map((m) => m.round))].sort((a, b) => a - b);
                  const maxR = brRounds.length ? brRounds[brRounds.length - 1] : 0;
                  const finalMatch = bracket.find((m) => m.round === maxR && [...new Set(bracket.filter((x) => x.round === maxR).map((x) => x.id))].length === 1);
                  const champ = finalMatch?.winnerId && finalMatch.winnerId !== "tie" ? (finalMatch.winnerId === finalMatch.sideAId ? finalMatch.sideAName : finalMatch.sideBName) : null;
                  const curRound = bracket.filter((m) => m.round === maxR);
                  const canAdvance = curRound.length > 1 && curRound.every((m) => m.winnerId && m.winnerId !== "tie");
                  return (
                    <div className={`${card} p-4`}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Playoff bracket</h3>
                        <div className="flex items-center gap-2">
                          {canAdvance && <button onClick={() => advanceBracket(league.id)} className={`${btnGhost} !px-3 !py-1.5 !text-xs`}>Advance round →</button>}
                          <button onClick={() => mp.length >= 2 && generateBracket(league.id, mp.map((r) => ({ id: r.id, name: r.name })))} disabled={mp.length < 2} className={`${btnGold} !px-3 !py-1.5 !text-xs`}>{bracket.length ? "Reseed" : "Seed bracket"}</button>
                        </div>
                      </div>
                      {bracket.length === 0 ? (
                        <p className="text-sm text-[var(--sage-dim)]">Seed the top finishers into a single-elimination bracket once the regular season wraps.</p>
                      ) : (
                        <>
                          {champ && <div className="mb-3 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/[0.1] px-4 py-2.5 text-center font-[family-name:var(--font-heading)] font-bold text-[var(--gold)]">🏆 {champ} — champion</div>}
                          <div className="flex gap-4 overflow-x-auto pb-2">
                            {brRounds.map((r) => (
                              <div key={r} className="flex min-w-[190px] flex-col justify-around gap-3">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{r === maxR && curRound.length === 1 ? "Final" : `Round ${r}`}</div>
                                {bracket.filter((m) => m.round === r).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)).map((m) => (
                                  <div key={m.id} className="overflow-hidden rounded-lg border border-white/[0.07]">
                                    {[["A", m.sideAId, m.sideAName], ["B", m.sideBId, m.sideBName]].map(([k, sid, sname]) => (
                                      <button key={k} onClick={() => setMatchResult(league.id, m.id, m.winnerId === sid ? null : (sid as string))} className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-xs transition-colors ${m.winnerId === sid ? "bg-[var(--gold)]/15 font-bold text-[var(--gold)]" : "text-[var(--cream)] hover:bg-white/[0.05]"} ${k === "A" ? "border-b border-white/[0.06]" : ""}`}>
                                        <span className="min-w-0 truncate">{sname as string}</span>
                                        {m.winnerId === sid && <span>✓</span>}
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {section === "events" && (
            <div className="grid gap-8">
              {isLeagueKind ? (
                <div className={`${card} p-6`}>
                  <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">Schedule events</h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <label className="block sm:col-span-3"><FieldLabel>Event name <span className="normal-case tracking-normal text-[var(--sage-dim)]">— defaults to “{league.name}”</span></FieldLabel><input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder={league.name} className={inputCls} /></label>
                    <label className="block"><FieldLabel>First date</FieldLabel><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></label>
                    <label className="block"><FieldLabel>Tee time</FieldLabel><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} /></label>
                    <label className="block"><FieldLabel>Repeat weekly ×</FieldLabel><input type="number" min={1} max={26} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 1)} className={inputCls} /></label>
                    <div><FieldLabel>Rounds</FieldLabel><Segmented options={["1", "2", "3"]} value={String(rounds)} onChange={(v) => setRounds(Number(v))} /></div>
                    <div><FieldLabel>Holes per round</FieldLabel><Segmented options={["9", "18"]} value={String(holes)} onChange={(v) => setHoles(Number(v))} /></div>
                    <label className="block"><FieldLabel>Buy-in ($)</FieldLabel><input inputMode="numeric" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} placeholder="0" className={inputCls} /></label>
                    <label className="block"><FieldLabel>Field cap</FieldLabel><input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="none" className={inputCls} /></label>
                  </div>
                  <button onClick={schedule} disabled={!startDate || busy} className={`${btnGold} mt-5`}>{busy ? "Scheduling…" : weeks > 1 ? `Create ${weeks} events` : "Create event"}</button>
                </div>
              ) : primaryEvent && !editEvent ? (
                (() => {
                  const rs = Array.from({ length: primaryEvent.roundCount }, (_, i) => primaryEvent.roundStarts?.[i] ?? primaryEvent.date);
                  return (
                    <div className={`${card} p-6`}>
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{NOUN} details</h2>
                        <div className="flex items-center gap-4">
                          <Link href={`/leagues/${slug}/e/${primaryEvent.id}`} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--gold)] transition-opacity hover:opacity-80">View event page →</Link>
                          <button onClick={startEditEvent} className="rounded-full border border-[var(--gold)]/40 bg-[var(--gold-dim)] px-4 py-1.5 text-xs font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20">Edit</button>
                        </div>
                      </div>
                      <div className="mt-4 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--cream)]">{primaryEvent.name}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--cream-60)]">
                        <span>{fmtDate(rs[0])}</span>
                        <span>{primaryEvent.roundCount} {primaryEvent.roundCount === 1 ? "round" : "rounds"} · {primaryEvent.holes} holes</span>
                        {primaryEvent.buyIn ? <span>${primaryEvent.buyIn} buy-in</span> : <span>Free</span>}
                        {primaryEvent.capacity ? <span>cap {primaryEvent.capacity}</span> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--cream-38)]">
                        <span>Registration closes {fmtDate(primaryEvent.registrationCloseAt || rs[0])}</span>
                        {primaryEvent.startFormat === "Tee times" && <span>Tee times · groups of {primaryEvent.teeGroupSize ?? 4} · {primaryEvent.teeIntervalMin ?? 10} min apart</span>}
                      </div>
                      {primaryEvent.roundCount > 1 && (
                        <div className="mt-4 grid gap-2">
                          {rs.map((ms, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--hair)] bg-[var(--card)] px-4 py-2.5">
                              <span className="w-12 shrink-0 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Rd {i + 1}</span>
                              <span className="text-sm text-[var(--cream)]">{fmtDate(ms)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {eventSaved && <p className="mt-4 text-sm font-bold text-[#5fcf80]">Saved ✓</p>}
                    </div>
                  );
                })()
              ) : primaryEvent ? (
                <div className={`${card} p-6`}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">Edit {NOUN.toLowerCase()}</h2>
                    <button onClick={() => setEditEvent(false)} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--cream-38)] transition-colors hover:text-[var(--cream)]">Cancel</button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2"><FieldLabel>Name</FieldLabel><input value={ed.name} onChange={(e) => setEd((s) => ({ ...s, name: e.target.value }))} placeholder={league.name} className={inputCls} /></label>
                    <label className="block"><FieldLabel>Start date</FieldLabel><input type="date" value={ed.date} onChange={(e) => setEd((s) => ({ ...s, date: e.target.value }))} className={`${inputCls} [color-scheme:dark]`} /></label>
                    <label className="block"><FieldLabel>{ed.rounds > 1 ? "Round 1 tee time" : "Tee time"}</FieldLabel><input type="time" value={ed.time} onChange={(e) => setEd((s) => ({ ...s, time: e.target.value }))} className={`${inputCls} [color-scheme:dark]`} /></label>
                    <div><FieldLabel>Rounds</FieldLabel><Segmented options={["1", "2", "3", "4"]} value={String(ed.rounds)} onChange={(v) => setEd((s) => ({ ...s, rounds: Number(v) }))} /></div>
                    <div><FieldLabel>Holes per round</FieldLabel><Segmented options={["9", "18"]} value={String(ed.holes)} onChange={(v) => setEd((s) => ({ ...s, holes: Number(v) }))} /></div>
                    <label className="block"><FieldLabel>Buy-in ($)</FieldLabel><input inputMode="numeric" value={ed.buyIn} onChange={(e) => setEd((s) => ({ ...s, buyIn: e.target.value }))} placeholder="0" className={inputCls} /></label>
                    <label className="block"><FieldLabel>Field cap</FieldLabel><input inputMode="numeric" value={ed.cap} onChange={(e) => setEd((s) => ({ ...s, cap: e.target.value }))} placeholder="none" className={inputCls} /></label>
                    <label className="block sm:col-span-2"><FieldLabel>Registration closes</FieldLabel><input type="datetime-local" value={ed.reg} onChange={(e) => setEd((s) => ({ ...s, reg: e.target.value }))} className={`${inputCls} [color-scheme:dark]`} /></label>
                  </div>
                  {primaryEvent.startFormat === "Tee times" && primaryEvent.teeGenerated && (
                    <p className="mt-2 text-[11px] text-[var(--sage-dim)]">Changing the date shifts the existing tee sheet with it — groups and stagger are kept.</p>
                  )}
                  <button type="button" onClick={() => setSection("teetimes")} className="mt-6 flex w-full items-center gap-3 rounded-xl border border-[var(--hair)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--hair-strong)]">
                    <IconClock className="h-4 w-4 shrink-0 text-[var(--gold)]" />
                    <span className="min-w-0 flex-1 text-sm text-[var(--cream-60)]"><b className="font-semibold text-[var(--cream)]">{startsNoun(primaryEvent.startFormat)}</b> — set group size{primaryEvent.startFormat === "Tee times" ? " & interval" : ""} and hand-tweak the sheet on the {startsNoun(primaryEvent.startFormat)} page.</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                  {ed.rounds > 1 && (
                    <div className="mt-6">
                      <FieldLabel>Round schedule</FieldLabel>
                      <div className="mt-1 grid gap-2.5">
                        <div className="flex items-center gap-3 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold-dim)] px-4 py-3">
                          <span className="w-12 shrink-0 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Rd 1</span>
                          <span className="text-sm text-[var(--cream)]">{ed.date ? new Date(`${ed.date}T${ed.time || "17:30"}`).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Set the start date above"}</span>
                        </div>
                        {Array.from({ length: ed.rounds - 1 }, (_, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--hair)] bg-[var(--card)] px-4 py-3">
                            <span className="w-12 shrink-0 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Rd {i + 2}</span>
                            <input type="date" value={ed.extra?.[i]?.date ?? ed.date} min={ed.date || undefined} onChange={(e) => setRoundTime(i, { date: e.target.value })} className={`${rowInput} min-w-0 flex-1`} />
                            <input type="time" value={ed.extra?.[i]?.time ?? ed.time} onChange={(e) => setRoundTime(i, { time: e.target.value })} className={`${rowInput} w-[128px] shrink-0`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-5 flex items-center gap-3">
                    <button onClick={saveEvent} disabled={!ed.date || busy} className={btnGold}>{busy ? "Saving…" : "Save event"}</button>
                    <button onClick={() => setEditEvent(false)} className={btnGhost}>Cancel</button>
                  </div>

                  {/* Danger zone — delete this event */}
                  <div className="mt-8 border-t border-[#e0473f]/25 pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#f08c8c]">Danger zone</div>
                        <p className="mt-1 text-[13px] text-[var(--cream-60)]">Permanently delete this {NOUN.toLowerCase()} — scores, entries and tee sheet. This can&apos;t be undone.</p>
                      </div>
                      {confirmDel ? (
                        <div className="flex items-center gap-2">
                          <button onClick={deleteThisEvent} disabled={busy} className="rounded-full bg-[#e0473f] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#c93b34] disabled:opacity-50">{busy ? "Deleting…" : "Yes, delete"}</button>
                          <button onClick={() => setConfirmDel(false)} disabled={busy} className={btnGhost}>Keep</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(true)} className="shrink-0 rounded-full border border-[#e0473f]/40 px-4 py-2 text-xs font-bold text-[#f08c8c] transition-colors hover:bg-[#e0473f]/10">Delete {NOUN.toLowerCase()}</button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <Link href="/leagues/new" className={`${btnGold} inline-block`}>Create the event →</Link>
              )}
              {(isLeagueKind ? upcoming.length > 0 : upcoming.length > 1) && (
              <div>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{isLeagueKind ? "Upcoming" : "More events"} · {upcoming.length}</h3>
                <div className="grid gap-2.5">{upcoming.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
              </div>
              )}
              {past.length > 0 && (
                <div>
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Past · {past.length}</h3>
                  <div className="grid gap-2.5">{past.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
                </div>
              )}
            </div>
          )}

          {section === "teetimes" && teeEvent && (
            <div className="grid gap-6">
              <div className={`${card} p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{startsNoun(teeFormat)}<span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--sage-dim)]">{teeFormat} start</span></h2>
                  <Link href={`/leagues/${slug}/e/${teeEvent.id}?tab=scores`} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--gold)] transition-opacity hover:opacity-80">Public sheet →</Link>
                </div>
                {upcoming.length > 1 && (
                  <label className="mt-4 block">
                    <FieldLabel>Which event</FieldLabel>
                    <select value={teeEid ?? ""} onChange={(e) => setTeeEventId(e.target.value)} className={inputCls}>
                      {upcoming.map((ev) => <option key={ev.id} value={ev.id}>{ev.name} · {fmtDate(ev.date)}</option>)}
                    </select>
                  </label>
                )}
                <p className="mt-3 text-xs text-[var(--sage-dim)]">{teeFormat === "Tee times" ? `Groups build automatically when registration closes (${fmtDate(teeEvent.registrationCloseAt || teeEvent.roundStarts?.[0] || teeEvent.date)}), split by division and staggered.` : teeFormat === "Shotgun" ? `Groups build at registration close, one per hole across ${teeEvent.courseName || "the course"}'s ${holeCount} holes — extras wrap into A/B waves.` : "Players tee off any time in the window — groups are optional pairings you can share."} Configure and hand-tweak here anytime.</p>
                <div className={`mt-4 grid gap-4 ${teeFormat === "Tee times" ? "sm:grid-cols-2" : ""}`}>
                  <div><FieldLabel>Players per group</FieldLabel><Segmented options={["2", "3", "4"]} value={String(teeSize)} onChange={(v) => setTeeSize(Number(v))} /></div>
                  {teeFormat === "Tee times" && <div><FieldLabel>Minutes between groups</FieldLabel><Segmented options={["8", "10", "12", "15"]} value={String(teeInt)} onChange={(v) => setTeeInt(Number(v))} /></div>}
                </div>
                {teeFormat === "Flex" && (
                  <div className="mt-4">
                    <FieldLabel>Play window</FieldLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[var(--sage-dim)]">Opens {fmtDate(teeEvent.roundStarts?.[0] || teeEvent.date)} · closes</span>
                      <input type="datetime-local" value={flexEnd} onChange={(e) => setFlexEnd(e.target.value)} className={`${inputCls} max-w-[240px] [color-scheme:dark]`} />
                      <button onClick={saveFlexWindow} disabled={busy} className="h-11 shrink-0 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-dim)] px-4 text-sm font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20 disabled:opacity-40">Save window</button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--sage-dim)]">Players tee off any time between open and close, then report their round.</p>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={genTee} disabled={busy || teeEntries.length === 0} className={btnGold}>{busy ? "Building…" : teeCards.length ? "Regenerate groups" : "Generate groups"}</button>
                  {teeEntries.length === 0 && <span className="text-xs text-[var(--sage-dim)]">No players in yet.</span>}
                </div>
              </div>
              {teeCards.length === 0 ? (
                <p className="text-sm text-[var(--sage-dim)]">No groups yet. Set it up above and generate{teeFormat === "Flex" ? "." : " — or they build automatically when registration closes."}</p>
              ) : (() => {
                const byRound = new Map<number, EventCard[]>();
                for (const c of teeCards) { const r = c.round ?? 1; if (!byRound.has(r)) byRound.set(r, []); byRound.get(r)!.push(c); }
                const rounds = [...byRound.keys()].sort((a, b) => a - b);
                const multiRound = rounds.length > 1;
                // Shotgun A/B waves per round+hole.
                const byHole = new Map<string, EventCard[]>();
                if (teeFormat === "Shotgun") for (const c of teeCards) { const k = `${c.round ?? 1}:${c.startHole}`; if (!byHole.has(k)) byHole.set(k, []); byHole.get(k)!.push(c); }
                const waveOf = (c: EventCard) => { const arr = byHole.get(`${c.round ?? 1}:${c.startHole}`); return arr && arr.length > 1 ? String.fromCharCode(65 + arr.indexOf(c)) : ""; };
                return (
                  <div className="grid gap-8">
                    {rounds.map((rnd) => {
                      const rcards = byRound.get(rnd)!;
                      const groups = new Map<string, EventCard[]>();
                      for (const c of rcards) { const d = c.division || ""; if (!groups.has(d)) groups.set(d, []); groups.get(d)!.push(c); }
                      const multiDiv = groups.size > 1;
                      const roundStart = teeEvent.roundStarts?.[rnd - 1] ?? teeEvent.date;
                      return (
                        <div key={rnd}>
                          {multiRound && <div className="mb-3 flex flex-wrap items-center gap-3 border-b border-[var(--hair)] pb-2"><span className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--cream)]">Round {rnd}</span><span className="text-[11px] uppercase tracking-[0.08em] text-[var(--sage-dim)]">{fmtDate(roundStart)}</span></div>}
                          <div className="grid gap-6">
                            {[...groups.entries()].map(([div, gcards]) => (
                              <div key={div || "open"}>
                                {multiDiv && <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--gold)]">{div || "Open"}</div>}
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {gcards.map((c) => (
                                    <div key={c.id} className={`${card} p-4`}>
                                      <div className="mb-3 flex items-center justify-between gap-2">
                                        <span className="font-[family-name:var(--font-heading)] text-sm font-extrabold text-[var(--cream)]">Group {c.number}</span>
                                        {teeFormat === "Tee times" ? (
                                          <input type="time" value={c.teeTime ? toTimeInput(c.teeTime) : ""} onChange={(e) => editTee(c.id, e.target.value)} className="rounded-lg bg-[var(--gold-dim)] px-2 py-1 text-[11px] font-bold text-[var(--gold)] outline-none [color-scheme:dark]" />
                                        ) : teeFormat === "Shotgun" ? (
                                          <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--gold-dim)] pl-2 pr-1 py-1 text-[10px] font-bold text-[var(--gold)]">HOLE <input type="number" min={1} max={holeCount} value={c.startHole} onChange={(e) => editHole(c.id, Number(e.target.value))} className="w-10 rounded bg-transparent text-center text-[11px] font-bold text-[var(--gold)] outline-none" />{waveOf(c) && <span className="ml-0.5 rounded bg-[var(--gold)]/25 px-1">{waveOf(c)}</span>}</span>
                                        ) : null}
                                      </div>
                                      <div className="space-y-2">
                                        {c.playerIds.map((pid) => (
                                          <div key={pid} className="flex items-center gap-2 text-sm text-[var(--text-body)]">
                                            <Avatar url={teeEntryOf.get(pid)?.photo} name={teeEntryOf.get(pid)?.name ?? "?"} size={22} ring={false} />
                                            <span className="min-w-0 flex-1 truncate text-[var(--cream)]">{teeEntryOf.get(pid)?.name ?? "Player"}</span>
                                            {rcards.length > 1 && (
                                              <select value="" onChange={(e) => { if (e.target.value) moveTee(pid, e.target.value); }} title="Move to another group" className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-1 text-[10px] text-[var(--sage)] outline-none">
                                                <option value="">move…</option>
                                                {rcards.filter((o) => o.id !== c.id).map((o) => <option key={o.id} value={o.id}>Group {o.number}{o.teeTime ? ` · ${fmtHM(o.teeTime)}` : ""}</option>)}
                                              </select>
                                            )}
                                          </div>
                                        ))}
                                        {c.playerIds.length === 0 && <p className="text-xs text-[var(--cream-38)]">Empty group</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {section === "standings" && (
            <div className={`${card} overflow-hidden`}>
              {standings.length === 0 && <p className="p-6 text-sm text-[var(--sage-dim)]">Standings build as events complete.</p>}
              {standings.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3.5 border-b border-white/[0.05] px-5 py-3 text-sm last:border-b-0">
                  <Pos n={i + 1} />
                  <Avatar url={photoOf.get(s.id)} name={s.name} size={30} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{s.name}{s.division && <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">{s.division}</span>}</span>
                  <span className="hidden text-xs text-[var(--sage-dim)] sm:inline">{s.played} played{s.bestToPar != null ? ` · best ${fmtToPar(s.bestToPar)}` : ""}</span>
                  <span className="w-12 text-right text-base font-extrabold text-[var(--gold)]">{s.points}</span>
                </div>
              ))}
            </div>
          )}

          {section === "settings" && (
            <div className="grid gap-6">
            <div className={`${card} p-6`}>
              <h3 className="mb-1 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--cream)]">Scoring</h3>
              <p className="mb-5 text-xs text-[var(--sage-dim)]">How events turn into your season standings.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><FieldLabel>Scoring model</FieldLabel><Segmented options={["Stroke play", "Points", "Match play"]} disabled={["Points", "Match play"]} value={modelDraft === "matchplay" ? "Match play" : modelDraft === "strokeplay" ? "Stroke play" : "Points"} onChange={(v) => setModelDraft(v === "Match play" ? "matchplay" : v === "Stroke play" ? "strokeplay" : "placement")} /><p className="mt-1.5 text-[11px] text-[var(--sage-dim)]">{modelDraft === "matchplay" ? "Head-to-head: win / tie / loss → points, on a weekly schedule." : modelDraft === "strokeplay" ? "Cumulative strokes across events — lowest total wins (best-N optional)." : "Finish position → points down the field. Set the points-per-place below."}</p></div>
                <div><FieldLabel>Standings shown</FieldLabel><Segmented options={["Gross", "Net", "Both"]} value={viewDraft === "net" ? "Net" : viewDraft === "both" ? "Both" : "Gross"} onChange={(v) => setViewDraft(v.toLowerCase() as "gross" | "net" | "both")} /><p className="mt-1.5 text-[11px] text-[var(--sage-dim)]">{viewDraft === "both" ? "Two races — a gross champ and a net (handicap) champ." : viewDraft === "net" ? "Handicap-adjusted (net) decides the season." : "Raw score decides the season."}</p></div>
              </div>
              {modelDraft === "placement" && (
                <div className="mt-5 border-t border-[var(--hair)] pt-5">
                  <FieldLabel>Points per place</FieldLabel>
                  <Segmented options={["Linear", "Decay", "Custom"]} value={curveDraft === "decay" ? "Decay" : curveDraft === "table" ? "Custom" : "Linear"} onChange={(v) => { const c = v === "Decay" ? "decay" : v === "Custom" ? "table" : "linear"; setCurveDraft(c); if (c === "table" && curveTableDraft.length === 0) setCurveTableDraft([10, 8, 6, 5, 4, 3, 2, 1]); }} />
                  <p className="mt-1.5 text-[11px] text-[var(--sage-dim)]">{curveDraft === "decay" ? "1st = the field size, tapering to 2 down the field, 1 below that." : curveDraft === "table" ? "You set exact points for each finishing place; anyone past the list gets 1." : "1st gets N, 2nd N−1, … where N = players who showed. Ties split evenly."}</p>
                  {curveDraft === "table" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {curveTableDraft.map((v, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hair-strong)] bg-white/[0.03] py-1 pl-2 pr-1">
                          <span className="text-[11px] font-bold text-[var(--sage-dim)]">{i + 1}{["st", "nd", "rd"][i] ?? "th"}</span>
                          <input inputMode="numeric" value={v} onChange={(e) => setCurveTableDraft((xs) => xs.map((x, j) => (j === i ? (Number(e.target.value.replace(/[^0-9]/g, "")) || 0) : x)))} className="w-12 rounded-md bg-[var(--card)] px-1.5 py-1 text-center text-sm font-bold text-[var(--cream)] outline-none" />
                          <button onClick={() => setCurveTableDraft((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove place" className="grid h-5 w-5 place-items-center rounded text-[var(--sage-dim)] transition-colors hover:text-[#f08c8c]">×</button>
                        </span>
                      ))}
                      <button onClick={() => setCurveTableDraft((xs) => [...xs, Math.max(1, (xs[xs.length - 1] ?? 2) - 1)])} className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold-dim)] px-3 py-1.5 text-xs font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20">+ Place</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={`${card} p-6`}>
              <h3 className="mb-5 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--cream)]">Brand</h3>
              <div className="grid gap-5">
                <div className="flex items-center gap-4">
                  <label className={`grid h-20 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${league.logoUrl ? "border-[var(--gold)]/40" : "border-white/15 hover:border-[var(--gold)]/50"}`}>
                    {league.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={league.logoUrl} alt="League logo" className="h-full w-full object-cover" />
                    ) : (
                      <IconPlus className="h-5 w-5 text-[var(--gold)]" />
                    )}
                    <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f || !user) return;
                      try {
                        const r = storageRef(storage, `leagueLogos/${user.uid}/${league.id}.jpg`);
                        await uploadBytes(r, f, { contentType: f.type || "image/jpeg" });
                        const url = await getDownloadURL(r);
                        await setLeagueLogo(league.id, url);
                        setLeague({ ...league, logoUrl: url });
                      } catch { setBrandNote("Logo upload was blocked — storage rules don't cover leagueLogos yet."); }
                    }} />
                  </label>
                  <div className="text-xs leading-relaxed text-[var(--cream-60)]">Event logo — shows on discovery cards in place of the course photo.<br />JPEG or PNG, ~256×256.</div>
                </div>
                {brandNote && <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--cream-38)]">{brandNote}</p>}
              </div>
            </div>
            <div className={`${card} p-6`}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <FieldLabel>Play format</FieldLabel>
                  <Segmented options={[...LEAGUE_FORMATS]} value={isTeamFormat(formatDraft) ? "Teams" : "Singles"} onChange={setFormatDraft} />
                  {isTeamFormat(formatDraft) && (
                    <div className="mt-3">
                      <FieldLabel>Team size</FieldLabel>
                      <Segmented options={["Doubles", "3", "4"]} value={teamSizeDraft === 3 ? "3" : teamSizeDraft === 4 ? "4" : "Doubles"} onChange={(v) => setTeamSizeDraft(v === "3" ? 3 : v === "4" ? 4 : 2)} />
                      <p className="mt-1.5 text-[11px] text-[var(--sage-dim)]">Doubles = 2 per team. Team standings appear once you build teams.</p>
                    </div>
                  )}
                </div>
                <div><FieldLabel>Start format</FieldLabel><Segmented options={[...START_FORMATS]} value={startDraft} onChange={setStartDraft} /><p className="mt-1.5 text-[11px] text-[var(--sage-dim)]">{startDraft === "Tee times" ? "Groups start in staggered time slots, all off hole 1." : startDraft === "Flex" ? "Players tee off any time in a window and report their score." : "Everyone tees off at once, each group on a different hole."}</p></div>
                <div className="block sm:col-span-2">
                  <FieldLabel>Divisions <span className="normal-case tracking-normal text-[var(--sage-dim)]">— players self-sort at check-in; add as many as you like</span></FieldLabel>
                  <div className="mb-2.5 flex flex-wrap gap-2">
                    {divisionsList.map((d, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] bg-white/[0.04] py-1.5 pl-3.5 pr-2 text-sm font-semibold text-[var(--cream)]">
                        {d}
                        <button onClick={() => setDivisionsList((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove ${d}`} className="grid h-5 w-5 place-items-center rounded-full text-base leading-none text-[var(--sage-dim)] transition-colors hover:bg-white/10 hover:text-[var(--cream)]">×</button>
                      </span>
                    ))}
                    {divisionsList.length === 0 && <span className="py-1.5 text-xs text-[var(--sage-dim)]">No divisions — everyone plays one pool.</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input list="division-suggest" value={newDivision} onChange={(e) => setNewDivision(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDivision(); } }} placeholder="Add a division…" className={`${inputCls} max-w-[240px]`} />
                    <datalist id="division-suggest">{SUGGESTED_DIVISIONS.map((d) => <option key={d} value={d} />)}</datalist>
                    <button onClick={() => addDivision()} disabled={!newDivision.trim()} className="h-11 shrink-0 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-dim)] px-4 text-sm font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20 disabled:opacity-40">+ Add division</button>
                  </div>
                  {SUGGESTED_DIVISIONS.filter((d) => !divisionsList.some((x) => x.toLowerCase() === d.toLowerCase())).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {SUGGESTED_DIVISIONS.filter((d) => !divisionsList.some((x) => x.toLowerCase() === d.toLowerCase())).map((d) => (
                        <button key={d} onClick={() => addDivision(d)} className="rounded-full border border-white/[0.1] px-3 py-1 text-xs font-semibold text-[var(--sage)] transition-colors hover:border-white/25 hover:text-[var(--cream)]">+ {d}</button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="block"><FieldLabel>Best rounds counted</FieldLabel><input inputMode="numeric" value={bestNDraft} onChange={(e) => setBestNDraft(e.target.value)} placeholder="all" className={inputCls} /></label>
                <label className="block"><FieldLabel>Ace pot balance ($)</FieldLabel><input inputMode="numeric" value={acePotDraft} onChange={(e) => setAcePotDraft(e.target.value)} placeholder="0" className={inputCls} /></label>
                <label className="block"><FieldLabel>Handicap %</FieldLabel><input inputMode="numeric" value={hcpPctDraft} onChange={(e) => setHcpPctDraft(e.target.value)} placeholder="90" className={inputCls} /></label>
                <label className="block"><FieldLabel>Handicap cap (strokes)</FieldLabel><input inputMode="numeric" value={hcpCapDraft} onChange={(e) => setHcpCapDraft(e.target.value)} placeholder="none" className={inputCls} /></label>
                <label className="flex items-center gap-3 sm:col-span-2">
                  <input type="checkbox" checked={bagTagsDraft} onChange={(e) => setBagTagsDraft(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                  <span className="text-sm font-semibold text-[var(--cream)]">Bag tags</span>
                  <span className="text-xs text-[var(--sage-dim)]">tags reassign by finish when an event completes</span>
                </label>
                <label className="flex items-center gap-3 sm:col-span-2">
                  <input type="checkbox" checked={checkInsDraft} onChange={(e) => setCheckInsDraft(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                  <span className="text-sm font-semibold text-[var(--cream)]">Manage check-ins</span>
                  <span className="text-xs text-[var(--sage-dim)]">directors mark who&apos;s arrived on the Players tab, from ~3h before start</span>
                </label>
                <label className="flex items-center gap-3 sm:col-span-2">
                  <input type="checkbox" checked={caddyDraft} onChange={(e) => setCaddyDraft(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                  <span className="text-sm font-semibold text-[var(--cream)]">Allow Caddy during the event</span>
                  <span className="text-xs text-[var(--sage-dim)]">players can use the in-app Caddy while playing — turn off for a no-assistance tournament</span>
                </label>
                <label className="block sm:col-span-2"><FieldLabel>Description</FieldLabel><textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={2} className={inputCls} /></label>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[var(--sage-dim)]">Handicaps are public math: <span className="text-[var(--sage)]">% × avg(player − field) over last 5 rounds</span>, capped — apply them per event, override any player inline.</p>
              <div className="mt-5 flex items-center justify-end gap-3">
                {saved && <span className="text-sm font-bold text-[#5fcf80]">Saved ✓</span>}
                <button onClick={saveSettings} disabled={busy} className={btnGold}>{busy ? "Saving…" : "Save settings"}</button>
              </div>
            </div>
            </div>
          )}

          {section === "quicklink" && (
            <div className="grid gap-4">
              <div className={`${card} p-6`}>
                <FieldLabel>Public {NOUN.toLowerCase()} page</FieldLabel>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <code className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-[var(--cream)]">radiusdiscgolf.com/leagues/{league.slug}</code>
                  <button onClick={() => copy(`https://radiusdiscgolf.com/leagues/${league.slug}`)} className={btnGhost + " !py-2 !text-xs"}>{copied ? "Copied ✓" : "Copy"}</button>
                </div>
                <p className="mt-3 text-xs text-[var(--sage-dim)]">Put it in the group chat, the flyer, the Facebook page. Each event also has its own check-in link on its page.</p>
              </div>
              {upcoming[0] && (
                <div className={`${card} p-6`}>
                  <FieldLabel>Next event check-in</FieldLabel>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--cream)]"><IconPin className="h-4 w-4 text-[var(--gold)]" />{upcoming[0].name} · {fmtDate(upcoming[0].date)}</span>
                    <button onClick={() => copy(`https://radiusdiscgolf.com/leagues/${league.slug}/e/${upcoming[0].id}`)} className={btnGhost + " !py-2 !text-xs"}>{copied ? "Copied ✓" : "Copy link"}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
