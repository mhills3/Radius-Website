"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getLeagueBySlug, getLeagueEvents, getLeagueMembers, createEvents, computeStandings, updateLeagueSettings, setAcePot, setMemberRole, isLeagueAdmin, type League, type LeagueEvent, type LeagueMember, type StandingRow } from "@/lib/leagues";
import { resolveCanonicalId } from "@/lib/account";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

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

  if (league === undefined) return <main className="mx-auto max-w-3xl px-5 pt-10 text-sm text-[var(--sage-dim)]">Loading…</main>;
  if (league === null) return <main className="mx-auto max-w-3xl px-5 pt-10"><p className="text-sm text-[var(--sage-dim)]">League not found. <Link href="/leagues" className="text-[var(--gold)] hover:underline">All leagues</Link></p></main>;

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]";

  const EventRow = ({ ev }: { ev: LeagueEvent }) => (
    <Link href={`/leagues/${league.slug}/e/${ev.id}`} className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-white/[0.12]">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--gold-dim)] text-center">
        <span className="text-xs font-bold leading-tight text-[var(--gold)]">{fmtDate(ev.date).split(", ")[1] ?? fmtDate(ev.date)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-[var(--cream)]">{ev.name}</div>
        <div className="truncate text-xs text-[var(--sage-dim)]">{fmtDate(ev.date)} · {fmtTime(ev.date)}{ev.courseName ? ` · ${ev.courseName}` : ""} · {ev.entryCount} checked in</div>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${ev.status === "complete" ? "bg-white/[0.06] text-[var(--sage-dim)]" : ev.status === "cancelled" ? "bg-[#f08c8c]/15 text-[#f08c8c]" : ev.status === "active" ? "bg-[#5fcf80]/15 text-[#5fcf80]" : "bg-[var(--gold-dim)] text-[var(--gold)]"}`}>{ev.status}</span>
    </Link>
  );

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-[var(--cream)]">{league.name}</h1>
          <p className="mt-1 text-sm text-[var(--sage)]">{league.courseName ? `${league.courseName} · ` : ""}{league.settings.format} · {league.settings.startFormat} · run by {league.createdByName}</p>
          {(league.acePotBalance ?? 0) > 0 && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--gold-dim)] px-3 py-1 text-xs font-bold text-[var(--gold)]">🎯 Ace pot · ${league.acePotBalance}</p>}
          {league.settings.description && <p className="mt-3 max-w-xl whitespace-pre-wrap text-sm text-[var(--text-body)]">{league.settings.description}</p>}
        </div>
        {admin && (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => { setSettingsOpen((o) => !o); setSchedOpen(false); }} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-white/[0.06]">
              {settingsOpen ? "Close" : "Settings"}
            </button>
            <button onClick={() => { setSchedOpen((o) => !o); setSettingsOpen(false); }} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
              {schedOpen ? "Cancel" : "Schedule events"}
            </button>
          </div>
        )}
      </div>

      {admin && settingsOpen && (
        <div className="mt-6 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
          <label className="block text-xs font-bold uppercase tracking-wide text-[var(--sage)]">Divisions <span className="font-normal normal-case text-[var(--sage-dim)]">— comma-separated; players pick one at check-in</span>
            <input value={divisionsDraft} onChange={(e) => setDivisionsDraft(e.target.value)} placeholder="Open, FPO, Rec" className={field + " mt-1.5"} />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-[var(--sage)]">Best rounds counted <span className="font-normal normal-case text-[var(--sage-dim)]">— season standings use each player&apos;s best N events (blank = all)</span>
            <input inputMode="numeric" value={bestNDraft} onChange={(e) => setBestNDraft(e.target.value)} placeholder="all" className={field + " mt-1.5 max-w-[120px]"} />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-[var(--sage)]">Handicap % <span className="font-normal normal-case text-[var(--sage-dim)]">— of field-relative average (default 90)</span>
              <input inputMode="numeric" value={hcpPctDraft} onChange={(e) => setHcpPctDraft(e.target.value)} placeholder="90" className={field + " mt-1.5 max-w-[120px]"} />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-[var(--sage)]">Handicap cap <span className="font-normal normal-case text-[var(--sage-dim)]">— max strokes (blank = uncapped)</span>
              <input inputMode="numeric" value={hcpCapDraft} onChange={(e) => setHcpCapDraft(e.target.value)} placeholder="none" className={field + " mt-1.5 max-w-[120px]"} />
            </label>
          </div>
          <p className="text-xs text-[var(--sage-dim)]">The handicap formula is public: handicap = % × average of (player score − field average) over the player&apos;s last 5 league rounds, capped. Directors can override any player&apos;s adjustment on the event page.</p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--sage)]">
              <input type="checkbox" checked={bagTagsDraft} onChange={(e) => setBagTagsDraft(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
              Bag tags <span className="font-normal normal-case text-[var(--sage-dim)]">— tags reassign by finish when an event completes</span>
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-[var(--sage)]">Ace pot balance ($)
              <input inputMode="numeric" value={acePotDraft} onChange={(e) => setAcePotDraft(e.target.value)} placeholder="0" className={field + " mt-1.5 max-w-[120px]"} />
            </label>
          </div>
          <label className="block text-xs font-bold uppercase tracking-wide text-[var(--sage)]">Description
            <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={2} className={field + " mt-1.5"} />
          </label>
          <button
            onClick={async () => {
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
            }}
            disabled={busy}
            className="rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50"
          >{busy ? "Saving…" : "Save settings"}</button>
        </div>
      )}

      {admin && schedOpen && (
        <div className="mt-6 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
          <input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder={`Event name (default: ${league.name})`} className={field} />
          <div className="flex flex-wrap gap-3">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field + " max-w-[180px]"} />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field + " max-w-[140px]"} />
            <label className="flex items-center gap-2 text-sm text-[var(--sage)]">
              repeat weekly ×
              <input type="number" min={1} max={26} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 1)} className={field + " w-20"} />
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--sage)]">
              rounds
              <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className={field + " w-20"}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--sage)]">
              buy-in $
              <input inputMode="numeric" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} placeholder="0" className={field + " w-20"} />
            </label>
          </div>
          {rounds > 1 && <p className="text-xs text-[var(--sage-dim)]">Multi-round event: the leaderboard totals all {rounds} rounds (tournament-style cumulative scoring).</p>}
          {weeks > 1 && <p className="text-xs text-[var(--sage-dim)]">This will create {weeks} events, one per week.</p>}
          {err && <p className="text-sm text-[#f08c8c]">{err}</p>}
          <button onClick={schedule} disabled={!startDate || busy} className="rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Scheduling…" : weeks > 1 ? `Create ${weeks} events` : "Create event"}
          </button>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Upcoming</h2>
        {upcoming.length === 0 && <p className="text-sm text-[var(--sage-dim)]">Nothing scheduled yet.</p>}
        <div className="space-y-3">{upcoming.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
      </section>

      {standings.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Season standings</h2>
          <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
            {standings.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-4 py-2.5 text-sm last:border-b-0">
                <span className="w-6 text-right font-mono text-xs text-[var(--sage-dim)]">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-[var(--cream)]">{s.name}{s.division && <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--sage-dim)]">{s.division}</span>}</span>
                <span className="text-xs text-[var(--sage-dim)]">{s.played} played{s.bestToPar != null ? ` · best ${fmtToPar(s.bestToPar)}` : ""}</span>
                <span className="w-12 text-right font-mono font-bold text-[var(--gold)]">{s.points}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Past events</h2>
          <div className="space-y-3">{past.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Members · {members.length}</h2>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] py-1 pl-1 pr-3 text-sm text-[var(--text-body)]">
              <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-[10px] font-bold text-[var(--cream)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.photo ? <img src={m.photo} alt="" className="h-full w-full object-cover" /> : (m.name || "?").charAt(0).toUpperCase()}
              </span>
              {m.username ? <Link href={`/u/${m.username}`} className="hover:underline">{m.name}</Link> : m.name}
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
                  className="text-[10px] font-bold text-[var(--sage-dim)] hover:text-[var(--gold)]"
                >{m.role === "director" ? "demote" : "promote"}</button>
              )}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
