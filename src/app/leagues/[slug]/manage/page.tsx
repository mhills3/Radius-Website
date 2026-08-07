"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getLeagueBySlug, getLeagueEvents, getLeagueMembers, createEvents, computeStandings, updateLeagueSettings, setAcePot, setMemberRole, setLeagueLogo, isLeagueAdmin, subscribeLeagueTeams, createLeagueTeam, updateLeagueTeam, deleteLeagueTeam, subscribeLeagueMatches, generateSchedule, setMatchResult, computeMatchStandings, generateBracket, advanceBracket, LEAGUE_FORMATS, TEAM_SIZES, START_FORMATS, isTeamFormat, SUGGESTED_DIVISIONS, type League, type LeagueEvent, type LeagueMember, type StandingRow, type LeagueTeam, type LeagueMatch } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { storage } from "@/lib/firebase";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { inputCls, FieldLabel, Segmented, Avatar, Pos, btnGold, btnGhost, card, cardHover, IconCalendar, IconUsers, IconPlus, IconPin, IconClock } from "@/components/leagues/ui";

// ─── League tools: the director console (UDisc "League tools" equivalent).
// Persistent sidebar, dashboard-first, every admin control in one place.

type Section = "dashboard" | "members" | "teams" | "matchplay" | "events" | "standings" | "settings" | "quicklink";

const fmtDate = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

export default function LeagueManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [league, setLeague] = useState<League | null | undefined>(undefined);
  const [brandNote, setBrandNote] = useState("");
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
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
  const upcoming = events.filter((e) => e.status !== "complete" && e.status !== "cancelled" && e.date > now - 12 * 3600_000);
  const past = events.filter((e) => !upcoming.includes(e)).reverse();
  const photoOf = useMemo(() => new Map(members.map((m) => [m.id, m.photo])), [members]);

  const isMatchPlay = league?.settings.scoring?.model === "matchplay";
  const isTeamLeague = isTeamFormat(league?.settings.format);
  // Container nature drives the console wording: a tournament shouldn't say "League" everywhere.
  const containerKind = league?.kind || upcoming[0]?.kind || past[0]?.kind || events[0]?.kind || "league";
  const isLeagueKind = containerKind === "league";
  const NOUN = isLeagueKind ? "League" : containerKind === "tournament" ? "Tournament" : "Event";
  const nextEvent = upcoming[0] ?? null;
  const isTeeTimes = (league?.settings.startFormat ?? "") === "Tee times";
  const nav: { key: Section; label: string }[] = [
    { key: "dashboard", label: `${NOUN} dashboard` },
    { key: "members", label: "Members" },
    ...(isTeamLeague ? [{ key: "teams" as const, label: "Teams" }] : []),
    ...(isMatchPlay ? [{ key: "matchplay" as const, label: "Match play" }] : []),
    { key: "events", label: "Events" },
    { key: "settings", label: "Settings" },
    { key: "quicklink", label: "Quick link" },
  ];

  const checklist = league ? [
    { label: `${NOUN} settings`, done: !!league.settings.description || (league.settings.divisions ?? []).length > 1, hint: "Description, format, and defaults", go: "settings" as Section },
    { label: "Divisions", done: (league.settings.divisions ?? []).length > 1, hint: "Add divisions so players self-sort at check-in", go: "settings" as Section },
    { label: isLeagueKind ? "First event" : "Schedule it", done: events.length > 0, hint: isLeagueKind ? "Schedule a night or a whole season" : "Set the date, rounds, and tee times", go: "events" as Section },
    { label: "Scoring configured", done: !!league.settings.scoring?.model || !!league.settings.bestN || standings.length > 0, hint: "Model, points-per-place, and best-N", go: "settings" as Section },
  ] : [];

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
      const settings = { ...league.settings, format: formatDraft, teamSize: isTeamFormat(formatDraft) ? teamSizeDraft : undefined, startFormat: startDraft, divisions: divisions.length > 1 ? divisions : undefined, bestN, handicapPercent, handicapCap, bagTags: bagTagsDraft, description: descDraft.trim(), scoring };
      await updateLeagueSettings(league.id, settings);
      const acePot = acePotDraft.trim() !== "" && Number(acePotDraft) >= 0 ? Number(acePotDraft) : undefined;
      if (acePot != null && acePot !== league.acePotBalance) await setAcePot(league.id, acePot);
      setLeague({ ...league, acePotBalance: acePot ?? league.acePotBalance, settings: { ...settings, divisions: divisions.length > 1 ? divisions : ["Open"] } });
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
      <div className="w-9 shrink-0 font-mono leading-[1.15]">
        <div className="text-[9.5px] uppercase tracking-[0.2em] text-[var(--cream-38)]">{new Date(ev.date).toLocaleDateString(undefined, { month: "short" })}</div>
        <div className="text-[20px] font-bold text-[var(--cream)]">{new Date(ev.date).getDate()}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-[var(--cream)]">{ev.name}</div>
        <div className="truncate text-xs text-[var(--cream-38)]">{fmtDate(ev.date)}{ev.entryCount > 0 ? <> · <span className="font-mono">{ev.entryCount}</span> in</> : ""}</div>
      </div>
      {ev.status === "scheduled" && Date.now() >= ev.date && Date.now() <= ev.date + 6 * 3600_000 && ev.entryCount > 0 ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--blue-dim)] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--blue)]"><span className="live-dot h-1 w-1 rounded-full bg-[var(--blue)]" />Live</span>
      ) : (
        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] ${ev.status === "cancelled" ? "border-[#f08c8c]/25 text-[#f08c8c]" : "border-[var(--hair)] text-[var(--cream-60)]"}`}>{ev.status}</span>
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
        <Link href={`/leagues/${league.slug}`} className="text-xs font-bold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">Exit director tools →</Link>
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
              {/* Setup checklist — earns its exit: once every item is done it disappears */}
              {checklist.some((c) => !c.done) && (
              <div className={`${card} p-6`}>
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{NOUN} setup · {checklist.filter((c) => c.done).length}/{checklist.length} complete</h2>
                <div className="mt-4 grid gap-2">
                  {checklist.map((c, ci) => {
                    const isNext = !c.done && checklist.findIndex((x) => !x.done) === ci;
                    return (
                    <button key={c.label} onClick={() => setSection(c.go)} className={`group flex items-center gap-3 rounded-xl border border-[var(--hair)] bg-[var(--forest)] px-4 py-3 text-left transition-colors hover:border-[var(--hair-strong)] ${isNext ? "border-l-[3px] border-l-[rgba(232,181,96,0.45)]" : ""}`}>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${c.done ? "bg-[var(--gold)] text-[#141B16]" : isNext ? "border border-[var(--gold)]/60 text-transparent" : "border border-[var(--hair-strong)] text-transparent"}`}>✓</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-bold ${c.done ? "text-[var(--cream-38)] line-through decoration-[var(--hair-strong)]" : "text-[var(--cream)]"}`}>{c.label}</span>
                        <span className="block text-xs text-[var(--cream-38)]">{c.hint}</span>
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--cream-38)] group-hover:text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Quick navigation */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Link href="/leagues/new" className={`${card} ${cardHover} group p-5`}>
                  <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--gold-dim)] text-[var(--gold)]"><IconPlus /></span>
                  <div className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">Create event</div>
                  <div className="mt-0.5 text-xs text-[var(--cream-60)]">List a night, a season, or a tournament.</div>
                </Link>
                <button onClick={() => setSection("events")} className={`${card} ${cardHover} group p-6 text-left`}>
                  <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--gold-dim)] text-[var(--gold)]"><IconCalendar /></span>
                  <div className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">All events</div>
                  <div className="mt-0.5 text-xs text-[var(--cream-60)]">{upcoming.length} upcoming · {past.length} past</div>
                </button>
                <button onClick={() => setSection("members")} className={`${card} ${cardHover} group p-6 text-left`}>
                  <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--gold-dim)] text-[var(--gold)]"><IconUsers /></span>
                  <div className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">Members</div>
                  <div className="mt-0.5 text-xs text-[var(--cream-60)]">{members.length} member{members.length === 1 ? "" : "s"} · manage roles</div>
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
            <div className={`${card} overflow-hidden`}>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3.5 border-b border-white/[0.05] px-5 py-3.5 last:border-b-0">
                  {m.username ? <Link href={`/u/${m.username}`}><Avatar url={m.photo} name={m.name} size={36} /></Link> : <Avatar url={m.photo} name={m.name} size={36} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {m.username ? <Link href={`/u/${m.username}`} className="truncate text-sm font-bold text-[var(--cream)] hover:underline">{m.name}</Link> : <span className="truncate text-sm font-bold text-[var(--cream)]">{m.name}</span>}
                      {typeof m.tag === "number" && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--cream)]">#{m.tag}</span>}
                    </span>
                    {m.username && <span className="block text-xs text-[var(--sage-dim)]">@{m.username}</span>}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${m.role !== "member" ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "bg-white/[0.05] text-[var(--sage-dim)]"}`}>{m.role}</span>
                  {m.role !== "owner" && (
                    <button
                      onClick={async () => {
                        const role = m.role === "director" ? "member" : "director";
                        await setMemberRole(league.id, m.id, role);
                        setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, role } : x)));
                      }}
                      className={btnGhost + " !px-3 !py-1.5 !text-xs"}
                    >{m.role === "director" ? "Demote" : "Make director"}</button>
                  )}
                </div>
              ))}
              {members.length === 0 && <p className="p-6 text-sm text-[var(--sage-dim)]">No members yet. Share an event check-in link.</p>}
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
                        <span className="w-6 font-mono text-xs text-[var(--sage-dim)]">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{row.name}</span>
                        <span className="font-mono text-xs text-[var(--sage-dim)]">{row.wins}-{row.ties}-{row.losses}</span>
                        <span className="w-10 text-right font-mono font-bold text-[var(--gold)]">{row.points}</span>
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
              <div>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Upcoming · {upcoming.length}</h3>
                <div className="grid gap-2.5">{upcoming.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
              </div>
              {past.length > 0 && (
                <div>
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Past · {past.length}</h3>
                  <div className="grid gap-2.5">{past.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
                </div>
              )}
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
                  <span className="w-12 text-right font-mono text-base font-extrabold text-[var(--gold)]">{s.points}</span>
                </div>
              ))}
            </div>
          )}

          {section === "settings" && (
            <div className="grid gap-6">
            {isTeeTimes && nextEvent && (
              <Link href={`/leagues/${slug}/e/${nextEvent.id}?tab=scores`} className="flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-dim)] p-5 transition-colors hover:bg-[var(--gold)]/15">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[var(--gold)]/20 text-[var(--gold)]"><IconClock className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--cream)]">Generate tee times</span>
                  <span className="block text-xs text-[var(--cream-60)]">Auto-build the tee sheet for {nextEvent.name} — split by division, staggered starts. Edit times &amp; groups after.</span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 shrink-0 text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
              </Link>
            )}
            <div className={`${card} p-6`}>
              <h3 className="mb-1 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--cream)]">Scoring</h3>
              <p className="mb-5 text-xs text-[var(--sage-dim)]">How events turn into your season standings.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><FieldLabel>Scoring model</FieldLabel><Segmented options={["Points", "Stroke play", "Match play"]} value={modelDraft === "matchplay" ? "Match play" : modelDraft === "strokeplay" ? "Stroke play" : "Points"} onChange={(v) => setModelDraft(v === "Match play" ? "matchplay" : v === "Stroke play" ? "strokeplay" : "placement")} /><p className="mt-1.5 text-[11px] text-[var(--sage-dim)]">{modelDraft === "matchplay" ? "Head-to-head: win / tie / loss → points, on a weekly schedule." : modelDraft === "strokeplay" ? "Cumulative strokes across events — lowest total wins (best-N optional)." : "Finish position → points down the field. Set the points-per-place below."}</p></div>
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
                          <span className="font-mono text-[11px] font-bold text-[var(--sage-dim)]">{i + 1}{["st", "nd", "rd"][i] ?? "th"}</span>
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
                {brandNote && <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--cream-38)]">{brandNote}</p>}
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
                <div><FieldLabel>Start format</FieldLabel><Segmented options={[...START_FORMATS]} value={startDraft} onChange={setStartDraft} /></div>
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
                <label className="block sm:col-span-2"><FieldLabel>Description</FieldLabel><textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={2} className={inputCls} /></label>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[var(--sage-dim)]">Handicaps are public math: <span className="font-mono text-[var(--sage)]">% × avg(player − field) over last 5 rounds</span>, capped — apply them per event, override any player inline.</p>
              <div className="mt-5 flex items-center gap-3">
                <button onClick={saveSettings} disabled={busy} className={btnGold}>{busy ? "Saving…" : "Save settings"}</button>
                {saved && <span className="text-sm font-bold text-[#5fcf80]">Saved ✓</span>}
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
