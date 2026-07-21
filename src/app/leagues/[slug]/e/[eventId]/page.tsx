"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getLeagueBySlug, getEvent, getCards, checkIn, updateEntry, removeEntry, generateCards, setEventStatus, computeStandings, subscribeEntries, liveTotal, isLeagueAdmin, eventPoints, type League, type LeagueEvent, type EventEntry, type EventCard } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";

const fmtDate = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

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

  // Entries stream in live via onSnapshot (the same channel the apps' hole-score
  // mirror will write into); only cards need explicit reloads.
  const reload = async (evId: string) => setCards(await getCards(evId));

  useEffect(() => {
    getLeagueBySlug(slug).then(setLeague).catch(() => {});
    getEvent(eventId).then((ev) => { setEvent(ev ?? null); if (ev) reload(ev.id); }).catch(() => setEvent(null));
    const unsub = subscribeEntries(eventId, setEntries);
    return unsub;
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
      await computeStandings(league.id, league.settings.bestN);
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

  if (event === undefined) return <main className="mx-auto max-w-3xl px-5 pt-10 text-sm text-[var(--sage-dim)]">Loading…</main>;
  if (event === null) return <main className="mx-auto max-w-3xl px-5 pt-10"><p className="text-sm text-[var(--sage-dim)]">Event not found.</p></main>;

  const nameOf = (id: string) => entries.find((e) => e.id === id)?.name ?? "Player";
  const divisions = league?.settings.divisions ?? [];
  const shown = divFilter ? entries.filter((e) => e.division === divFilter) : entries;
  // Final score ranks first-class; a live in-progress total (mirrored hole scores) ranks too.
  const scoreOf = (e: EventEntry) => (typeof e.score === "number" ? e.score : liveTotal(e));
  const ranked = [...shown].filter((e) => scoreOf(e) != null && !e.dnf).sort((a, b) => (scoreOf(a)! + (a.penalty ?? 0)) - (scoreOf(b)! + (b.penalty ?? 0)));
  const unscored = shown.filter((e) => !ranked.includes(e));

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
      <Link href={`/leagues/${slug}`} className="text-xs font-semibold text-[var(--sage)] hover:text-[var(--cream)]">← {event.leagueName}</Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight text-[var(--cream)]">{event.name}</h1>
          <p className="mt-1 text-sm text-[var(--sage)]">{fmtDate(event.date)}{event.courseName ? ` · ${event.courseName}` : ""} · {event.format} · {event.startFormat}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${event.status === "complete" ? "bg-white/[0.06] text-[var(--sage-dim)]" : event.status === "cancelled" ? "bg-[#f08c8c]/15 text-[#f08c8c]" : event.status === "active" ? "bg-[#5fcf80]/15 text-[#5fcf80]" : "bg-[var(--gold-dim)] text-[var(--gold)]"}`}>{event.status}</span>
      </div>

      {event.status !== "complete" && event.status !== "cancelled" && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {user ? (
            me ? <span className="rounded-full bg-[#5fcf80]/15 px-4 py-2 text-sm font-bold text-[#5fcf80]">✓ You&apos;re checked in{me.division ? ` · ${me.division}` : ""}</span>
               : (
              <span className="flex items-center gap-2">
                {divisions.length > 1 && (
                  <select value={division} onChange={(e) => setDivision(e.target.value)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[var(--cream)] outline-none focus:border-[var(--gold)]">
                    <option value="">Division…</option>
                    {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
                <button onClick={doCheckIn} disabled={busy || (divisions.length > 1 && !division)} className="rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">{busy ? "…" : "Check in"}</button>
              </span>
            )
          ) : (
            <p className="text-sm text-[var(--sage-dim)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to check in.</p>
          )}
          <button onClick={copyLink} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-white/[0.06]">{copied ? "Copied ✓" : "Copy check-in link"}</button>
          {admin && (
            <>
              <button onClick={complete} disabled={busy} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-white/[0.06] disabled:opacity-50">Complete event</button>
              <button onClick={cancel} disabled={busy} className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#f08c8c] transition-colors hover:bg-[#f08c8c]/10 disabled:opacity-50">Cancel event</button>
            </>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Leaderboard · {entries.length} player{entries.length === 1 ? "" : "s"}</h2>
          {divisions.length > 1 && entries.some((e) => e.division) && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setDivFilter("")} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${!divFilter ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}>All</button>
              {divisions.map((d) => (
                <button key={d} onClick={() => setDivFilter(divFilter === d ? "" : d)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${divFilter === d ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}>{d}</button>
              ))}
            </div>
          )}
        </div>
        {entries.length === 0 && <p className="text-sm text-[var(--sage-dim)]">Nobody has checked in yet.</p>}
        {entries.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
            {[...ranked, ...unscored].map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-4 py-2.5 text-sm last:border-b-0">
                <span className="w-6 text-right font-mono text-xs text-[var(--sage-dim)]">{scoreOf(e) != null && !e.dnf ? i + 1 : "—"}</span>
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-[10px] font-bold text-[var(--cream)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.photo ? <img src={e.photo} alt="" className="h-full w-full object-cover" /> : (e.name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">
                  {e.username ? <Link href={`/u/${e.username}`} className="hover:underline">{e.name}</Link> : e.name}
                  {e.division && !divFilter && <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">{e.division}</span>}
                  {e.dnf && <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">DNF</span>}
                  {typeof e.score !== "number" && liveTotal(e) != null && <span className="ml-2 rounded-full bg-[#5fcf80]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5fcf80]">thru {e.thruHole ?? e.holeScores!.filter((n) => n > 0).length}</span>}
                </span>
                {!admin && (e.penalty ?? 0) > 0 && <span className="font-mono text-xs text-[#f08c8c]">+{e.penalty}</span>}
                {event.status === "complete" && typeof e.score === "number" && <span className="font-mono text-xs text-[var(--gold)]">{points.get(e.id) ?? ""} pts</span>}
                {admin && event.status !== "complete" && event.status !== "cancelled" ? (
                  <span className="flex items-center gap-1.5">
                    <button
                      onClick={() => patchEntry(e.id, { paid: !e.paid })}
                      title={e.paid ? "Mark unpaid" : "Mark paid"}
                      className={`rounded-full px-2 py-1 font-mono text-xs font-bold transition-colors ${e.paid ? "bg-[#5fcf80]/15 text-[#5fcf80]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}
                    >$</button>
                    <button
                      onClick={() => patchEntry(e.id, { penalty: (e.penalty ?? 0) > 0 ? undefined : 2 })}
                      title={(e.penalty ?? 0) > 0 ? `Penalty +${e.penalty} — click to clear` : "Add +2 penalty"}
                      className={`rounded-full px-2 py-1 font-mono text-xs font-bold transition-colors ${(e.penalty ?? 0) > 0 ? "bg-[#f08c8c]/15 text-[#f08c8c]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}
                    >{(e.penalty ?? 0) > 0 ? `+${e.penalty}` : "P"}</button>
                    <button
                      onClick={() => patchEntry(e.id, { dnf: !e.dnf })}
                      title={e.dnf ? "Clear DNF" : "Mark DNF"}
                      className={`rounded-full px-2 py-1 font-mono text-[10px] font-bold transition-colors ${e.dnf ? "bg-white/[0.1] text-[var(--cream)]" : "bg-white/[0.05] text-[var(--sage-dim)] hover:text-[var(--cream)]"}`}
                    >DNF</button>
                    <input
                      inputMode="numeric"
                      defaultValue={e.score ?? ""}
                      placeholder="—"
                      onChange={(ev2) => setScoreDraft((s) => ({ ...s, [e.id]: ev2.target.value }))}
                      onBlur={() => saveScore(e.id)}
                      onKeyDown={(ev2) => { if (ev2.key === "Enter") (ev2.target as HTMLInputElement).blur(); }}
                      className="w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-right font-mono text-sm text-[var(--cream)] outline-none focus:border-[var(--gold)]"
                    />
                    <button onClick={() => dropEntry(e.id)} title="Remove from event" className="rounded-full px-1.5 py-1 text-xs text-[var(--sage-dim)] transition-colors hover:text-[#f08c8c]">✕</button>
                  </span>
                ) : (
                  <span className="w-12 text-right font-mono font-bold text-[var(--cream)]">{scoreOf(e) ?? ""}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {admin && event.status !== "complete" && entries.length > 0 && (
          <p className="mt-2 text-xs text-[var(--sage-dim)]">Directors enter total strokes here for now — rounds published from the app will attach automatically once the apps stamp league events.</p>
        )}
      </section>

      {/* Cards */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Cards</h2>
          {admin && event.status !== "complete" && entries.length > 1 && (
            <div className="flex items-center gap-2 text-xs text-[var(--sage)]">
              <select value={cardSize} onChange={(e) => setCardSize(Number(e.target.value))} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[var(--cream)] outline-none">
                {[3, 4, 5].map((n) => <option key={n} value={n}>cards of {n}</option>)}
              </select>
              <button onClick={doGenerate} disabled={busy} className="rounded-full bg-white/[0.06] px-4 py-1.5 font-bold text-[var(--cream)] transition-colors hover:bg-white/[0.1] disabled:opacity-50">
                {cards.length ? "Reshuffle" : "Generate cards"}
              </button>
            </div>
          )}
        </div>
        {cards.length === 0 && <p className="text-sm text-[var(--sage-dim)]">No cards yet{admin ? " — generate them once players check in." : "."}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--cream)]">Card {c.number}</span>
                <span className="rounded-full bg-[var(--gold-dim)] px-2 py-0.5 text-[10px] font-bold text-[var(--gold)]">Hole {c.startHole}</span>
              </div>
              <div className="space-y-1 text-sm text-[var(--text-body)]">
                {c.playerIds.map((pid) => <div key={pid} className="truncate">{nameOf(pid)}</div>)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
