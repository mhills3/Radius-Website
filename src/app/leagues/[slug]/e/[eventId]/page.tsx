"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getLeagueBySlug, getEvent, getCards, checkIn, updateEntry, removeEntry, generateCards, setEventStatus, setRoundScore, updateEventConfig, reassignBagTags, computeStandings, computeHandicaps, applyHandicaps, subscribeEntries, liveTotal, isLeagueAdmin, eventPoints, EVENT_KINDS, randomizeTeams, setEntryTeam, setTeamScore, sendEventMessage, subscribeEventMessages, type EventMessage, type League, type LeagueEvent, type EventEntry, type EventCard } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { SectionTitle, Avatar, Pos, btnGold, btnGhost, card, IconPin, IconDisc, IconEyeOff, IconUsers } from "@/components/leagues/ui";

const fmtDate = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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

function StatusChip({ status }: { status: LeagueEvent["status"] }) {
  const cls = status === "complete" ? "bg-white/[0.06] text-[var(--sage-dim)]"
    : status === "cancelled" ? "bg-[#f08c8c]/15 text-[#f08c8c]"
    : status === "active" ? "bg-[#5fcf80]/15 text-[#5fcf80]"
    : "bg-[var(--gold-dim)] text-[var(--gold)]";
  return <span className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${cls}`}>{status}</span>;
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
  const [division, setDivision] = useState("");
  const [divFilter, setDivFilter] = useState("");
  const [hcpNote, setHcpNote] = useState("");
  const [teamSize, setTeamSize] = useState(2);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);

  const reload = async (evId: string) => setCards(await getCards(evId));

  useEffect(() => {
    getLeagueBySlug(slug).then(setLeague).catch(() => {});
    getEvent(eventId).then((ev) => { setEvent(ev ?? null); if (ev) reload(ev.id); }).catch(() => setEvent(null));
    const unsubEntries = subscribeEntries(eventId, setEntries);
    const unsubChat = subscribeEventMessages(eventId, setMessages);
    return () => { unsubEntries(); unsubChat(); };
  }, [slug, eventId]);
  useEffect(() => { if (user) resolveCanonicalId(user.uid).then(setCid).catch(() => {}); }, [user]);

  const admin = useMemo(() => !!league && isLeagueAdmin(league, cid), [league, cid]);
  const me = entries.find((e) => e.id === cid);
  const points = useMemo(() => eventPoints(entries), [entries]);

  const doCheckIn = async () => {
    if (!user || !event || busy) return;
    setBusy(true);
    try { await checkIn(user.uid, event, division || undefined); } finally { setBusy(false); }
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
      await setEventStatus(event.id, "complete");
      setEvent({ ...event, status: "complete" });
      if (league.settings.bagTags) {
        const changes = await reassignBagTags(league, event.id);
        if (changes.length) setHcpNote("Bag tags reassigned by finish — new tags shown next to each player.");
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

  const doHandicaps = async () => {
    if (!event || !league || busy) return;
    setBusy(true);
    try {
      const rows = await computeHandicaps(league);
      if (!rows.length) { setHcpNote("No completed events with 2+ scored players yet — handicaps need history."); return; }
      const applied = await applyHandicaps(event.id, entries, rows);
      setHcpNote(applied ? `Applied handicaps to ${applied} player${applied === 1 ? "" : "s"} — editable per player below.` : "Everyone's handicap is 0 — no adjustments written.");
    } finally { setBusy(false); }
  };

  if (event === undefined) return <main className="mx-auto max-w-4xl px-5 pt-16 text-sm text-[var(--sage-dim)]">Loading…</main>;
  if (event === null) return <main className="mx-auto max-w-4xl px-5 pt-16"><p className="text-sm text-[var(--sage-dim)]">Event not found.</p></main>;

  const nameOf = (id: string) => entries.find((e) => e.id === id)?.name ?? "Player";
  const entryOf = (id: string) => entries.find((e) => e.id === id);
  const divisions = league?.settings.divisions ?? [];
  const shown = divFilter ? entries.filter((e) => e.division === divFilter) : entries;
  const scoreOf = (e: EventEntry) => (typeof e.score === "number" ? e.score : liveTotal(e));
  const adjOf = (e: EventEntry) => scoreOf(e)! + (e.penalty ?? 0) + (e.startingScore ?? 0);
  const ranked = [...shown].filter((e) => scoreOf(e) != null && !e.dnf).sort((a, b) => adjOf(a) - adjOf(b));
  const unscored = shown.filter((e) => !ranked.includes(e));
  const anyHcp = entries.some((e) => (e.startingScore ?? 0) !== 0);
  const open = event.status !== "complete" && event.status !== "cancelled";
  const paidCount = entries.filter((e) => e.paid).length;
  const paidOut = entries.reduce((a, e) => a + (e.payout ?? 0), 0);
  const isTeamFormat = event.format === "Doubles" || event.format === "Teams";
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
    const teams = [...byTeam.entries()]
      .map(([id, members]) => ({ id, members, score: teamScore(members) }))
      .sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
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
        {teams.length === 0 && <div className={`${card} px-6 py-8 text-center text-sm text-[var(--sage-dim)]`}>No teams yet — randomize teams above, or assign players below.</div>}
        {teams.map((t, i) => (
          <div key={t.id} className={`${card} flex items-center gap-4 p-4 ${i === 0 && t.score != null ? "ring-1 ring-[var(--gold)]/25" : ""}`}>
            <Pos n={t.score != null ? i + 1 : undefined} />
            <span className="flex -space-x-2">
              {t.members.map((m) => <Avatar key={m.id} url={m.photo} name={m.name} size={32} />)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-[var(--cream)]">{t.members.map((m) => m.name).join(" + ")}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">Team {t.id}{t.members.some((m) => m.paid) ? "" : ""}</span>
            </span>
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
                  <Avatar url={e.photo} name={e.name} size={26} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{e.name}</span>
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
    <main className="mx-auto max-w-4xl px-5 pb-28">
      {/* Header */}
      <section className="pb-8 pt-14">
        <Link href={`/leagues/${slug}`} className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]">← {event.leagueName}</Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-[var(--cream)] sm:text-4xl">{event.name}</h1>
          <StatusChip status={event.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white/[0.05] px-3 py-1.5 font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]">{fmtDate(event.date)}</span>
          {event.courseName && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]"><IconPin className="h-3.5 w-3.5 shrink-0" /> {event.courseName}</span>}
          <span className="rounded-full bg-white/[0.05] px-3 py-1.5 font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]">{event.format} · {event.startFormat}</span>
          {event.roundCount > 1 && <span className="rounded-full bg-[var(--gold-dim)] px-3 py-1.5 font-bold text-[var(--gold)] ring-1 ring-[var(--gold)]/20">{event.roundCount} rounds</span>}
          {event.kind && EVENT_KINDS.find((k) => k.key === event.kind) && (
            <span className="rounded-full bg-white/[0.05] px-3 py-1.5 font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]">{EVENT_KINDS.find((k) => k.key === event.kind)!.label}</span>
          )}
          {event.isPrivate && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 font-semibold text-[var(--sage)] ring-1 ring-white/[0.06]"><IconEyeOff className="h-3.5 w-3.5" /> Private — link only</span>
          )}
        </div>
        {event.description && <div className="mt-4 max-w-2xl"><Desc text={event.description} /></div>}
        {(event.contactEmail || event.contactPhone) && (
          <p className="mt-3 text-xs text-[var(--sage)]">
            Contact:{" "}
            {event.contactEmail && <a href={`mailto:${event.contactEmail}`} className="font-bold text-[var(--gold)] hover:underline">{event.contactEmail}</a>}
            {event.contactEmail && event.contactPhone && " · "}
            {event.contactPhone && <a href={`tel:${event.contactPhone}`} className="font-bold text-[var(--gold)] hover:underline">{event.contactPhone}</a>}
          </p>
        )}

        {open && (
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {user ? (
              me ? (
                <span className="rounded-full bg-[#5fcf80]/15 px-5 py-3 text-sm font-bold text-[#5fcf80] ring-1 ring-[#5fcf80]/20">✓ Checked in{me.division ? ` · ${me.division}` : ""}</span>
              ) : (
                <span className="flex items-center gap-2">
                  {divisions.length > 1 && (
                    <select value={division} onChange={(e) => setDivision(e.target.value)} className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-[var(--cream)] outline-none focus:border-[var(--gold)]">
                      <option value="">Division…</option>
                      {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                  <button onClick={doCheckIn} disabled={busy || (divisions.length > 1 && !division)} className={btnGold}>{busy ? "…" : "Check in"}</button>
                </span>
              )
            ) : (
              <Link href="/login" className={btnGold}>Sign in to check in</Link>
            )}
            <button onClick={copyLink} className={btnGhost}>{copied ? "Copied ✓" : "Copy check-in link"}</button>
            {admin && (
              <>
                {isTeamFormat && (
                <span className="flex items-center gap-2">
                  {event.format === "Teams" && (
                    <select value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-semibold text-[var(--cream)] outline-none focus:border-[var(--gold)]">
                      {[2, 3, 4].map((n) => <option key={n} value={n}>teams of {n}</option>)}
                    </select>
                  )}
                  <button onClick={doTeams} disabled={busy || entries.length < 2} className={btnGhost}>Randomize teams</button>
                </span>
              )}
              {!isTeamFormat && <button onClick={doHandicaps} disabled={busy} title="handicap = % × avg(player − field) over last 5 league rounds, capped" className={btnGhost}>Apply handicaps</button>}
                {event.roundCount < 6 && <button onClick={addRound} disabled={busy} className={btnGhost}>Add round {event.roundCount + 1}</button>}
                <button onClick={complete} disabled={busy} className={btnGhost}>Complete event</button>
                <button onClick={cancel} disabled={busy} className="rounded-full px-4 py-3 text-sm font-semibold text-[#f08c8c] transition-colors hover:bg-[#f08c8c]/10 disabled:opacity-50">Cancel event</button>
              </>
            )}
          </div>
        )}
        {hcpNote && <p className="mt-3 text-xs text-[var(--gold)]">{hcpNote}</p>}
      </section>

      {/* Money */}
      {event.buyIn && (
        <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        </section>
      )}

      {/* Leaderboard */}
      <section className="mb-12">
        <SectionTitle
          right={divisions.length > 1 && entries.some((e) => e.division) ? (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setDivFilter("")} className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${!divFilter ? "bg-[var(--gold)] text-[#16221b]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}>All</button>
              {divisions.map((d) => (
                <button key={d} onClick={() => setDivFilter(divFilter === d ? "" : d)} className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${divFilter === d ? "bg-[var(--gold)] text-[#16221b]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}>{d}</button>
              ))}
            </div>
          ) : undefined}
        >Leaderboard · {entries.length}</SectionTitle>

        {entries.length === 0 ? (
          <div className={`${card} grid place-items-center px-6 py-14 text-center`}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconDisc className="h-6 w-6" /></span>
            <p className="mt-3 font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">Nobody&apos;s checked in yet</p>
            <p className="mt-1 text-sm text-[var(--sage-dim)]">Share the check-in link and watch this fill up.</p>
          </div>
        ) : isTeamFormat ? (
          renderTeamBoard()
        ) : (
          <div className={`${card} overflow-hidden`}>
            {[...ranked, ...unscored].map((e, i) => {
              const isRanked = ranked.includes(e);
              const pos = isRanked ? i + 1 : undefined;
              return (
                <div key={e.id} className={`flex items-center gap-3.5 border-b border-white/[0.05] px-4 py-3 text-sm transition-colors last:border-b-0 ${pos === 1 ? "bg-[var(--gold)]/[0.05]" : ""}`}>
                  <Pos n={pos} />
                  <Avatar url={e.photo} name={e.name} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-bold text-[var(--cream)]">{e.username ? <Link href={`/u/${e.username}`} className="hover:underline">{e.name}</Link> : e.name}</span>
                      {typeof e.tag === "number" && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--cream)]" title="Bag tag">#{e.tag}</span>}
                      {(e.payout ?? 0) > 0 && <span className="rounded-full bg-[#5fcf80]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#5fcf80]" title="Payout">${e.payout}</span>}
                      {(e.startingScore ?? 0) !== 0 && <span className="rounded-full bg-[var(--gold-dim)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--gold)]" title="Handicap adjustment">HCP {e.startingScore! > 0 ? `+${e.startingScore}` : e.startingScore}</span>}
                      {e.division && !divFilter && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">{e.division}</span>}
                      {e.dnf && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">DNF</span>}
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

                  {admin && open ? (
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
                    <span className="flex items-center gap-1.5">
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
                      <span className="w-16 text-right font-mono text-lg font-extrabold text-[var(--cream)]">
                        {scoreOf(e) != null && anyHcp && !e.dnf ? adjOf(e) : scoreOf(e) ?? ""}
                        {scoreOf(e) != null && anyHcp && (e.startingScore ?? 0) !== 0 && <span className="ml-1 align-middle text-[10px] font-normal text-[var(--sage-dim)]">({scoreOf(e)})</span>}
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {admin && open && entries.length > 0 && (
          <p className="mt-2.5 text-xs text-[var(--sage-dim)]">Directors enter totals here for now — rounds published from the app attach automatically once the apps stamp league events.</p>
        )}
      </section>

      {/* Event chat — two-way, per event (UDisc only has one-way admin blasts) */}
      <section className="mb-12">
        <SectionTitle>Event chat{messages.length > 0 ? ` · ${messages.length}` : ""}</SectionTitle>
        <div className={`${card} flex max-h-[420px] flex-col`}>
          <div className="min-h-[120px] flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="grid place-items-center py-8 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconUsers className="h-5 w-5" /></span>
                <p className="mt-3 text-sm text-[var(--sage-dim)]">No messages yet — updates and trash talk land here.</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5">
                <Avatar url={m.senderPhoto} name={m.senderName} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-bold text-[var(--cream)]">{m.senderName}</span>
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

      {/* Cards */}
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
          <p className="text-sm text-[var(--sage-dim)]">No cards yet{admin ? " — generate them once players check in." : "."}</p>
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
                      <Avatar url={entryOf(pid)?.photo} name={nameOf(pid)} size={22} ring={false} />
                      <span className="truncate">{nameOf(pid)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
