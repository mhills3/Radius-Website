"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getLeagueBySlug, getLeagueEvents, getLeagueMembers, createEvents, computeStandings, updateLeagueSettings, setAcePot, setMemberRole, isLeagueAdmin, type League, type LeagueEvent, type LeagueMember, type StandingRow } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";
import { inputCls, FieldLabel, SectionTitle, Segmented, Avatar, Pos, btnGold, btnGhost, card } from "@/components/leagues/ui";

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

  // League settings (director only)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [divisionsDraft, setDivisionsDraft] = useState("");
  const [bestNDraft, setBestNDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [hcpPctDraft, setHcpPctDraft] = useState("");
  const [hcpCapDraft, setHcpCapDraft] = useState("");
  const [bagTagsDraft, setBagTagsDraft] = useState(false);
  const [acePotDraft, setAcePotDraft] = useState("");

  // Event scheduler (director only)
  const [schedOpen, setSchedOpen] = useState(false);
  const [evName, setEvName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("17:30");
  const [weeks, setWeeks] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [buyIn, setBuyIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getLeagueBySlug(slug).then((l) => {
      setLeague(l ?? null);
      if (l) {
        getLeagueEvents(l.id).then(setEvents).catch(() => {});
        getLeagueMembers(l.id).then(setMembers).catch(() => {});
        computeStandings(l.id, l.settings.bestN).then(setStandings).catch(() => {});
        setDivisionsDraft((l.settings.divisions ?? []).join(", "));
        setBestNDraft(l.settings.bestN ? String(l.settings.bestN) : "");
        setDescDraft(l.settings.description);
        setHcpPctDraft(l.settings.handicapPercent ? String(l.settings.handicapPercent) : "");
        setHcpCapDraft(l.settings.handicapCap ? String(l.settings.handicapCap) : "");
        setBagTagsDraft(l.settings.bagTags === true);
        setAcePotDraft(l.acePotBalance != null ? String(l.acePotBalance) : "");
      }
    }).catch(() => setLeague(null));
  }, [slug]);
  useEffect(() => { if (user) resolveCanonicalId(user.uid).then(setCid).catch(() => {}); }, [user]);

  const admin = useMemo(() => !!league && isLeagueAdmin(league, cid), [league, cid]);
  const [now] = useState(() => Date.now());
  const upcoming = events.filter((e) => e.status !== "complete" && e.status !== "cancelled" && e.date > now - 12 * 3600_000);
  const past = events.filter((e) => !upcoming.includes(e)).reverse();
  const photoOf = useMemo(() => new Map(members.map((m) => [m.id, m.photo])), [members]);

  const schedule = async () => {
    if (!user || !league || !startDate || busy) return;
    setBusy(true); setErr("");
    try {
      const base = new Date(`${startDate}T${startTime || "17:30"}`);
      const dates = Array.from({ length: Math.max(1, Math.min(weeks, 26)) }, (_, i) => base.getTime() + i * 7 * 24 * 3600_000);
      const created = await createEvents(user.uid, league, { name: evName, dates, roundCount: rounds, buyIn: Number(buyIn) > 0 ? Number(buyIn) : undefined });
      setEvents((prev) => [...prev, ...created].sort((a, b) => a.date - b.date));
      setSchedOpen(false); setEvName("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't schedule events.");
    } finally { setBusy(false); }
  };

  const saveSettings = async () => {
    if (!league || busy) return;
    setBusy(true);
    try {
      const divisions = divisionsDraft.split(",").map((s) => s.trim()).filter(Boolean);
      const bestN = Number(bestNDraft) > 0 ? Math.floor(Number(bestNDraft)) : undefined;
      const handicapPercent = Number(hcpPctDraft) > 0 ? Math.min(150, Math.floor(Number(hcpPctDraft))) : undefined;
      const handicapCap = Number(hcpCapDraft) > 0 ? Math.floor(Number(hcpCapDraft)) : undefined;
      const settings = { ...league.settings, divisions: divisions.length ? divisions : undefined, bestN, handicapPercent, handicapCap, bagTags: bagTagsDraft, description: descDraft.trim() };
      await updateLeagueSettings(league.id, settings);
      const acePot = Number(acePotDraft) >= 0 && acePotDraft.trim() !== "" ? Number(acePotDraft) : undefined;
      if (acePot !== league.acePotBalance && acePot != null) await setAcePot(league.id, acePot);
      setLeague({ ...league, acePotBalance: acePot ?? league.acePotBalance, settings: { ...settings, divisions: divisions.length ? divisions : ["Open"] } });
      computeStandings(league.id, bestN).then(setStandings).catch(() => {});
      setSettingsOpen(false);
    } finally { setBusy(false); }
  };

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
              {league.courseName && <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]">⛳ {league.courseName}</span>}
              <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]">{league.settings.format}</span>
              <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] ring-1 ring-white/[0.06]">{league.settings.startFormat}</span>
              {(league.acePotBalance ?? 0) > 0 && <span className="rounded-full bg-[var(--gold-dim)] px-3 py-1.5 text-xs font-bold text-[var(--gold)] ring-1 ring-[var(--gold)]/20">🎯 Ace pot ${league.acePotBalance}</span>}
            </div>
            {league.settings.description && <p className="mt-4 max-w-xl whitespace-pre-wrap text-sm leading-relaxed text-[var(--sage)]">{league.settings.description}</p>}
            <p className="mt-3 text-xs text-[var(--sage-dim)]">Run by {league.createdByName} · {members.length} member{members.length === 1 ? "" : "s"}</p>
          </div>
          {admin && (
            <div className="flex shrink-0 gap-2.5">
              <button onClick={() => { setSettingsOpen((o) => !o); setSchedOpen(false); }} className={btnGhost}>{settingsOpen ? "Close" : "Settings"}</button>
              <button onClick={() => { setSchedOpen((o) => !o); setSettingsOpen(false); }} className={btnGold}>{schedOpen ? "Cancel" : "Schedule events"}</button>
            </div>
          )}
        </div>
      </section>

      {/* Settings */}
      {admin && settingsOpen && (
        <section className={`${card} mb-10 p-6 sm:p-8`}>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--cream)]">League settings</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <FieldLabel>Divisions <span className="normal-case tracking-normal text-[var(--sage-dim)]">— comma-separated; players pick one at check-in</span></FieldLabel>
              <input value={divisionsDraft} onChange={(e) => setDivisionsDraft(e.target.value)} placeholder="Open, FPO, Rec" className={inputCls} />
            </label>
            <label className="block">
              <FieldLabel>Best rounds counted</FieldLabel>
              <input inputMode="numeric" value={bestNDraft} onChange={(e) => setBestNDraft(e.target.value)} placeholder="all" className={inputCls} />
            </label>
            <label className="block">
              <FieldLabel>Ace pot balance ($)</FieldLabel>
              <input inputMode="numeric" value={acePotDraft} onChange={(e) => setAcePotDraft(e.target.value)} placeholder="0" className={inputCls} />
            </label>
            <label className="block">
              <FieldLabel>Handicap %</FieldLabel>
              <input inputMode="numeric" value={hcpPctDraft} onChange={(e) => setHcpPctDraft(e.target.value)} placeholder="90" className={inputCls} />
            </label>
            <label className="block">
              <FieldLabel>Handicap cap (strokes)</FieldLabel>
              <input inputMode="numeric" value={hcpCapDraft} onChange={(e) => setHcpCapDraft(e.target.value)} placeholder="none" className={inputCls} />
            </label>
            <label className="flex items-center gap-3 sm:col-span-2">
              <input type="checkbox" checked={bagTagsDraft} onChange={(e) => setBagTagsDraft(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
              <span className="text-sm font-semibold text-[var(--cream)]">Bag tags</span>
              <span className="text-xs text-[var(--sage-dim)]">tags reassign by finish when an event completes</span>
            </label>
            <label className="block sm:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={2} className={inputCls} />
            </label>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--sage-dim)]">Handicaps are public math: <span className="font-mono text-[var(--sage)]">% × avg(player − field) over last 5 rounds</span>, capped. You can override any player on the event page.</p>
          <button onClick={saveSettings} disabled={busy} className={`${btnGold} mt-6`}>{busy ? "Saving…" : "Save settings"}</button>
        </section>
      )}

      {/* Scheduler */}
      {admin && schedOpen && (
        <section className={`${card} mb-10 p-6 sm:p-8`}>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--cream)]">Schedule events</h2>
          <p className="mt-1 text-sm text-[var(--sage-dim)]">One event or a whole season — weekly repeats land on the same day and time.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <label className="block sm:col-span-3">
              <FieldLabel>Event name <span className="normal-case tracking-normal text-[var(--sage-dim)]">— defaults to “{league.name}”</span></FieldLabel>
              <input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder={league.name} className={inputCls} />
            </label>
            <label className="block"><FieldLabel>First date</FieldLabel><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></label>
            <label className="block"><FieldLabel>Tee time</FieldLabel><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} /></label>
            <label className="block"><FieldLabel>Repeat weekly ×</FieldLabel><input type="number" min={1} max={26} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 1)} className={inputCls} /></label>
            <div><FieldLabel>Rounds</FieldLabel><Segmented options={["1", "2", "3", "4"]} value={String(rounds)} onChange={(v) => setRounds(Number(v))} /></div>
            <label className="block"><FieldLabel>Buy-in ($)</FieldLabel><input inputMode="numeric" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} placeholder="0" className={inputCls} /></label>
          </div>
          {weeks > 1 && <p className="mt-4 text-xs text-[var(--gold)]">This creates {weeks} events, one per week.</p>}
          {rounds > 1 && <p className="mt-1 text-xs text-[var(--sage-dim)]">Multi-round: the leaderboard totals all {rounds} rounds — tournament-style.</p>}
          {err && <p className="mt-3 text-sm text-[#f08c8c]">{err}</p>}
          <button onClick={schedule} disabled={!startDate || busy} className={`${btnGold} mt-6`}>{busy ? "Scheduling…" : weeks > 1 ? `Create ${weeks} events` : "Create event"}</button>
        </section>
      )}

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
