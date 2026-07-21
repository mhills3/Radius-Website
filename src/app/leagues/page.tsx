"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { createLeague, getMyLeagues, getAllLeagues, LEAGUE_FORMATS, START_FORMATS, type League } from "@/lib/leagues";

function LeagueCard({ l }: { l: League }) {
  return (
    <Link href={`/leagues/${l.slug}`} className="block rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-white/[0.12]">
      <div className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{l.name}</div>
      <div className="mt-0.5 text-sm text-[var(--sage-dim)]">{l.courseName || "No home course"} · {l.settings.format} · {l.memberCount} member{l.memberCount === 1 ? "" : "s"}</div>
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

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]";

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-[var(--cream)]">Leagues</h1>
        {user && (
          <button onClick={() => setCreating((c) => !c)} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
            {creating ? "Cancel" : "Start a league"}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--sage)]">Weekly leagues run on Radius — free for directors and players.</p>

      {creating && (
        <div className="mt-6 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="League name" className={field} />
          <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Home course (optional)" className={field} />
          <div className="flex gap-3">
            <select value={format} onChange={(e) => setFormat(e.target.value)} className={field}>
              {LEAGUE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={startFormat} onChange={(e) => setStartFormat(e.target.value)} className={field}>
              {START_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description — buy-ins, expectations, where to meet…" className={field} />
          {err && <p className="text-sm text-[#f08c8c]">{err}</p>}
          <button onClick={submit} disabled={!name.trim() || busy} className="rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Creating…" : "Create league"}
          </button>
        </div>
      )}

      {mine.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">My leagues</h2>
          <div className="space-y-3">{mine.map((l) => <LeagueCard key={l.id} l={l} />)}</div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">All leagues</h2>
        {all.length === 0 && <p className="text-sm text-[var(--sage-dim)]">No leagues yet — start the first one.</p>}
        <div className="space-y-3">{all.filter((l) => !mine.some((m) => m.id === l.id)).map((l) => <LeagueCard key={l.id} l={l} />)}</div>
      </section>
    </main>
  );
}
