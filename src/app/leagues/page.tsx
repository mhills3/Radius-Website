"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { createLeague, getMyLeagues, getAllLeagues, LEAGUE_FORMATS, START_FORMATS, type League } from "@/lib/leagues";
import { inputCls, FieldLabel, SectionTitle, Segmented, btnGold, btnGhost, card } from "@/components/leagues/ui";

function Emblem({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl bg-[var(--gold-dim)] font-[family-name:var(--font-heading)] font-extrabold text-[var(--gold)] ring-1 ring-[var(--gold)]/20"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >{(name || "?").charAt(0).toUpperCase()}</span>
  );
}

function LeagueCard({ l, mine }: { l: League; mine?: boolean }) {
  return (
    <Link href={`/leagues/${l.slug}`} className={`${card} group flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/30`}>
      <Emblem name={l.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{l.name}</span>
          {mine && <span className="shrink-0 rounded-full bg-[var(--gold-dim)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--gold)]">Director</span>}
        </div>
        <div className="mt-0.5 truncate text-sm text-[var(--sage)]">{l.courseName || "Rotating courses"} · {l.settings.format}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-xl font-extrabold text-[var(--cream)]">{l.memberCount}</div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">member{l.memberCount === 1 ? "" : "s"}</div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--sage-dim)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--gold)]"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

export default function LeaguesPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<League[]>([]);
  const [all, setAll] = useState<League[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [format, setFormat] = useState<string>(LEAGUE_FORMATS[0]);
  const [startFormat, setStartFormat] = useState<string>(START_FORMATS[0]);
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    getAllLeagues().then(setAll).catch(() => {});
    if (user) getMyLeagues(user.uid).then(setMine).catch(() => {});
  }, [user]);

  const submit = async () => {
    if (!user || !name.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const l = await createLeague(user.uid, { name, courseName: courseName.trim() || undefined, settings: { format, startFormat, description: description.trim() } });
      if (l) { setMine((m) => [l, ...m]); setAll((a) => [l, ...a]); setCreating(false); setName(""); setCourseName(""); setDescription(""); }
      else setErr("Couldn't create the league — are you signed in?");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create the league.");
    } finally { setBusy(false); }
  };

  const others = all.filter((l) => !mine.some((m) => m.id === l.id));

  return (
    <main className="mx-auto max-w-4xl px-5 pb-28">
      {/* Hero */}
      <section className="relative pb-12 pt-16 sm:pt-20">
        {/* Radius motif: concentric range rings, anchored off-canvas right */}
        <svg viewBox="0 0 480 480" aria-hidden className="pointer-events-none absolute -right-24 top-1/2 hidden h-[480px] w-[480px] -translate-y-1/2 sm:block" fill="none">
          {[70, 120, 170, 220].map((r, i) => (
            <circle key={r} cx="240" cy="240" r={r} stroke="var(--gold)" strokeOpacity={0.14 - i * 0.03} strokeWidth="1.5" strokeDasharray={i === 0 ? undefined : "3 7"} />
          ))}
          <circle cx="240" cy="240" r="5" fill="var(--gold)" fillOpacity="0.6" />
          <circle cx="240" cy="122" r="7" fill="var(--gold)" fillOpacity="0.9" />
          <circle cx="358" cy="278" r="5" fill="#5fcf80" fillOpacity="0.7" />
          <circle cx="152" cy="330" r="4" fill="var(--cream)" fillOpacity="0.35" />
        </svg>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Radius Leagues</p>
        <h1 className="mt-3 max-w-xl font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--cream)] sm:text-5xl">
          League night,<br />leveled up.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--sage)]">
          Weekly leagues and tournaments with live standings, honest handicaps, and bag tags that actually move. Free for directors and players — always.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          {user ? (
            <button onClick={() => setCreating((c) => !c)} className={btnGold}>{creating ? "Close" : "Start a league"}</button>
          ) : (
            <Link href="/login" className={btnGold}>Sign in to start a league</Link>
          )}
          <div className="flex items-center gap-5 text-sm text-[var(--sage-dim)]">
            {all.length > 0 && (
              <>
                <span><span className="font-mono font-bold text-[var(--cream)]">{all.length}</span> league{all.length === 1 ? "" : "s"}</span>
                <span className="h-4 w-px bg-white/10" />
              </>
            )}
            <span>Transparent handicaps</span>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <span className="hidden sm:inline">Live leaderboards</span>
          </div>
        </div>
      </section>

      {/* Create */}
      {creating && (
        <section className={`${card} mb-12 p-6 sm:p-8`}>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--cream)]">New league</h2>
          <p className="mt-1 text-sm text-[var(--sage-dim)]">Name it, point it at a course, and schedule the season in the next step.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <FieldLabel>League name</FieldLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northshore Tuesday Nights" className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <FieldLabel>Home course <span className="normal-case tracking-normal text-[var(--sage-dim)]">— optional, events can rotate</span></FieldLabel>
              <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Search or type a course" className={inputCls} />
            </label>
            <div>
              <FieldLabel>Format</FieldLabel>
              <Segmented options={[...LEAGUE_FORMATS]} value={format} onChange={setFormat} />
            </div>
            <div>
              <FieldLabel>Start</FieldLabel>
              <Segmented options={[...START_FORMATS]} value={startFormat} onChange={setStartFormat} />
            </div>
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

      {mine.length > 0 && (
        <section className="mb-12">
          <SectionTitle>Your leagues</SectionTitle>
          <div className="grid gap-3">{mine.map((l) => <LeagueCard key={l.id} l={l} mine />)}</div>
        </section>
      )}

      <section>
        <SectionTitle>All leagues</SectionTitle>
        {others.length === 0 && all.length === 0 ? (
          <div className={`${card} grid place-items-center px-6 py-16 text-center`}>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold-dim)] text-2xl">🥏</span>
            <p className="mt-4 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">No leagues yet</p>
            <p className="mt-1 max-w-xs text-sm text-[var(--sage-dim)]">Be the first — your weekly crew deserves better than a spreadsheet.</p>
          </div>
        ) : others.length === 0 ? (
          <p className="text-sm text-[var(--sage-dim)]">You&apos;re running every league on Radius so far. Legend.</p>
        ) : (
          <div className="grid gap-3">{others.map((l) => <LeagueCard key={l.id} l={l} />)}</div>
        )}
      </section>
    </main>
  );
}
