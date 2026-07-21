"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { createLeague, createEvents, getMyLeagues, setLeagueLogo, searchCourses, EVENT_KINDS, LEAGUE_FORMATS, type League, type CourseHit } from "@/lib/leagues";
import { inputCls, FieldLabel, Segmented, btnGold, btnGhost, IconCalendar, IconTrophy, IconTarget, IconLeaf, IconUsers, IconEye, IconEyeOff, IconPin, IconPlus } from "@/components/leagues/ui";

// ─── Full-screen event wizard, mirroring UDisc's "List your event" step
// architecture exactly: type → details → when → where → (buy-in) → contact →
// logo → review. No league step — the league container is plumbing: events
// attach to a league you direct if you pick one in Details, otherwise a
// container is created silently from the event name.

type StepKey = "type" | "details" | "when" | "where" | "money" | "contact" | "logo" | "review";

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  league: IconCalendar, tournament: IconTrophy, clinic: IconTarget, cleanup: IconLeaf, social: IconUsers,
};

const optionCard = (selected: boolean) =>
  `group flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-all ${
    selected
      ? "border-[var(--gold)] bg-gradient-to-br from-[rgba(246,193,101,0.16)] to-[rgba(246,193,101,0.05)] shadow-[0_10px_34px_rgba(246,193,101,0.14)]"
      : "border-white/[0.09] bg-gradient-to-b from-white/[0.055] to-white/[0.02] hover:-translate-y-0.5 hover:border-[var(--gold)]/40 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
  }`;

function Radio({ on }: { on: boolean }) {
  return (
    <span className={`ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${on ? "border-[var(--gold)]" : "border-white/20 group-hover:border-white/40"}`}>
      {on && <span className="h-2.5 w-2.5 rounded-full bg-[var(--gold)]" />}
    </span>
  );
}

function IconTile({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 transition-colors ${selected ? "bg-[var(--gold)]/20 text-[var(--gold)] ring-[var(--gold)]/30" : "bg-[var(--gold-dim)] text-[var(--gold)] ring-white/[0.06]"}`}>
      {children}
    </span>
  );
}

export default function EventWizard() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // ── Answers
  const [kind, setKind] = useState("");
  const [evName, setEvName] = useState("");
  const [desc, setDesc] = useState("");
  const [format, setFormat] = useState<string>(LEAGUE_FORMATS[0]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [leagueChoice, setLeagueChoice] = useState(""); // "" = auto-create container
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:30");
  const [repeat, setRepeat] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [customN, setCustomN] = useState("");
  const [holes, setHoles] = useState(18);
  const [customHoles, setCustomHoles] = useState("");
  const [useCustomHoles, setUseCustomHoles] = useState(false);
  const [useCustomN, setUseCustomN] = useState(false);
  const [course, setCourse] = useState<CourseHit | null>(null);
  const [customPlace, setCustomPlace] = useState("");
  const [byAddress, setByAddress] = useState(false);
  const [buyIn, setBuyIn] = useState("");
  const [capacity, setCapacity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  // ── Machinery
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [courseQ, setCourseQ] = useState("");
  const [hits, setHits] = useState<CourseHit[]>([]);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (user) getMyLeagues(user.uid).then(setMyLeagues).catch(() => {}); }, [user]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      if (!courseQ.trim() || course) { if (alive) setHits([]); return; }
      searchCourses(courseQ).then((h) => alive && setHits(h)).catch(() => {});
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [courseQ, course]);

  const isLeagueKind = kind === "league";
  const steps: StepKey[] = useMemo(() => ["type", "details", "when", "where", "money", "contact", "logo", "review"], []);
  const step = steps[stepIdx];
  const kindMeta = EVENT_KINDS.find((k) => k.key === kind);
  const chosenLeague = myLeagues.find((l) => l.id === leagueChoice);
  const countable = isLeagueKind || kind === "tournament";
  const holesN = useCustomHoles ? Math.max(1, Math.min(Number(customHoles) || 18, 36)) : holes;
  const nCount = !countable ? 1 : useCustomN ? Math.max(1, Math.min(Number(customN) || 1, isLeagueKind ? 26 : 6)) : (isLeagueKind ? repeat : rounds);
  const placeName = course?.name ?? customPlace.trim();

  const canNext: Record<StepKey, boolean> = {
    type: !!kind,
    details: !!evName.trim(),
    when: !!date,
    where: !!placeName,
    money: true, contact: true, logo: true, review: true,
  };
  const skippable: StepKey[] = ["money", "contact", "logo"];

  const insertMd = (mark: "**" | "_" | "- ") => {
    const el = descRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || (mark === "- " ? "List item" : "text");
    const next = mark === "- "
      ? value.slice(0, s) + sel.split("\n").map((l) => `- ${l}`).join("\n") + value.slice(e)
      : value.slice(0, s) + mark + sel + mark + value.slice(e);
    setDesc(next);
    requestAnimationFrame(() => el.focus());
  };

  const submit = async () => {
    if (!user || busy) return;
    setBusy(true); setErr("");
    try {
      // League container: chosen, or created silently from the event name.
      let league = chosenLeague ?? null;
      if (!league) {
        league = await createLeague(user.uid, {
          name: evName.trim(),
          courseName: placeName || undefined,
          courseId: course?.id,
          settings: { format, startFormat: "Flex", description: "" },
        });
        if (!league) throw new Error("Couldn't create the event — are you signed in?");
      }
      if (logoFile) {
        try {
          const r = storageRef(storage, `leagueLogos/${user.uid}/${league.id}.jpg`);
          await uploadBytes(r, logoFile, { contentType: logoFile.type || "image/jpeg" });
          await setLeagueLogo(league.id, await getDownloadURL(r));
        } catch {
          setErr("Event created — logo upload was blocked (storage rules don't cover leagueLogos yet). Everything else saved.");
        }
      }
      const base = new Date(`${date}T${time || "17:30"}`);
      const dates = isLeagueKind
        ? Array.from({ length: nCount }, (_, i) => base.getTime() + i * 7 * 24 * 3600_000)
        : [base.getTime()];
      const created = await createEvents(user.uid, league, {
        name: evName, dates,
        courseId: course?.id, courseName: placeName || undefined,
        format,
        roundCount: isLeagueKind ? 1 : nCount,
        holes: holesN,
        buyIn: Number(buyIn) > 0 ? Number(buyIn) : undefined,
        capacity: Number(capacity) > 0 ? Number(capacity) : undefined,
        kind, isPrivate, description: desc,
        contactEmail: email, contactPhone: phone,
      });
      router.push(`/leagues/${league.slug}/e/${created[0].id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong — nothing was lost, try again.");
      setBusy(false);
    }
  };

  const QUESTION: Record<StepKey, { title: string; sub?: string }> = {
    type: { title: "What kind of event is it?" },
    details: { title: "What are the details?" },
    when: { title: "When is it?" },
    where: { title: "Where is it?", sub: "Search the Radius course directory — every course the community has built." },
    money: { title: "Is there a buy-in?", sub: "Optional. Radius tracks who's paid, the pot, and payouts — no fees, no processor." },
    contact: { title: "Who's the contact?", sub: "Shown on the public event page so players can reach the director." },
    logo: { title: "Got a logo?", sub: "JPEG or PNG, roughly square. It becomes the event's mark across Radius." },
    review: { title: "Your event overview", sub: "Read it once like a player would — then send it." },
  };

  const STEP_META: { key: StepKey; label: string; value?: string }[] = [
    { key: "type", label: "Event type", value: kindMeta?.label },
    { key: "details", label: "Details", value: evName.trim() || undefined },
    { key: "when", label: "Schedule", value: date ? `${new Date(`${date}T${time}`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}${isLeagueKind && nCount > 1 ? ` · ×${nCount}` : !isLeagueKind && nCount > 1 ? ` · ${nCount} rds` : ""}` : undefined },
    { key: "where", label: "Location", value: placeName || undefined },
    { key: "money", label: "Buy-in", value: Number(buyIn) > 0 ? `$${buyIn}` : undefined },
    { key: "contact", label: "Contact", value: email.trim() || phone.trim() || undefined },
    { key: "logo", label: "Logo", value: logoFile ? "Added" : undefined },
    { key: "review", label: "Review" },
  ];

  if (!user) {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-5 text-center">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--gold)]">Radius Events</p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight text-[var(--cream)]">List your event.<br />Score your event.<br /><span className="text-[var(--gold)]">All with Radius.</span></h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[var(--sage)]">Live leaderboards, honest handicaps, money tracking, and bag tags — free for directors and players.</p>
          <Link href="/login" className={`${btnGold} mt-7 inline-block`}>Sign in to get started</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="relative">
      {/* Range rings — signature motif; page stays flat forest */}
      <svg viewBox="0 0 480 480" aria-hidden className="pointer-events-none absolute -left-40 top-[52%] hidden h-[440px] w-[440px] lg:block" fill="none">
        {[90, 150, 210].map((r, i) => (
          <circle key={r} cx="240" cy="240" r={r} stroke="var(--gold)" strokeOpacity={0.1 - i * 0.025} strokeWidth="1.5" strokeDasharray={i === 0 ? undefined : "3 7"} />
        ))}
        <circle cx="240" cy="150" r="5" fill="var(--gold)" fillOpacity="0.5" />
        <circle cx="330" cy="300" r="4" fill="#5fcf80" fillOpacity="0.5" />
      </svg>

      <main className="relative mx-auto grid min-h-[80vh] max-w-6xl gap-10 px-5 pb-36 pt-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        {/* Question + answer rail */}
        <div className="lg:pt-16">
          <Link href="/leagues" className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cream-38)] transition-colors hover:text-[var(--gold)]">← Events</Link>
          <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--gold)]">Step {stepIdx + 1} of {steps.length}</p>
          <h1 key={step} className="mt-3 max-w-md font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.06] tracking-tight text-[var(--cream)] animate-[fadeIn_0.3s_ease] sm:text-5xl">
            {QUESTION[step].title}
          </h1>
          {QUESTION[step].sub && <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--sage)]">{QUESTION[step].sub}</p>}

          <ol className="mt-10 hidden max-w-xs space-y-1 lg:block">
            {STEP_META.map((s, i) => {
              const done = i < stepIdx;
              const current = i === stepIdx;
              return (
                <li key={s.key}>
                  <button
                    onClick={() => done && setStepIdx(i)}
                    disabled={!done}
                    className={`group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${done ? "hover:bg-white/[0.04]" : ""}`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold transition-colors ${
                      current ? "bg-[var(--gold)] text-[#16221b]" : done ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "bg-white/[0.05] text-[var(--sage-dim)]"
                    }`}>{done ? "✓" : i + 1}</span>
                    <span className={`text-xs font-bold ${current ? "text-[var(--cream)]" : done ? "text-[var(--sage)] group-hover:text-[var(--cream)]" : "text-[var(--sage-dim)]/60"}`}>{s.label}</span>
                    {done && s.value && <span className="ml-auto max-w-[140px] truncate text-[11px] text-[var(--sage-dim)]">{s.value}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Answer */}
        <div key={`c-${step}`} className="animate-[fadeIn_0.3s_ease] lg:pt-16">
          {step === "type" && (
            <div className="grid gap-3">
              {EVENT_KINDS.map((k) => {
                const Icon = KIND_ICONS[k.key] ?? IconCalendar;
                return (
                  <button key={k.key} onClick={() => setKind(k.key)} className={optionCard(kind === k.key)}>
                    <IconTile selected={kind === k.key}><Icon /></IconTile>
                    <span className="min-w-0">
                      <span className="block font-[family-name:var(--font-heading)] font-bold text-[var(--cream)]">{k.label}</span>
                      <span className="mt-0.5 block text-xs text-[var(--sage)]">{k.blurb}</span>
                    </span>
                    <Radio on={kind === k.key} />
                  </button>
                );
              })}
            </div>
          )}

          {step === "details" && (
            <div className="grid gap-6">
              <label className="block">
                <FieldLabel>Event name *</FieldLabel>
                <input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder={kindMeta ? `${kindMeta.label} at the local` : "Event name"} className={inputCls} autoFocus />
              </label>
              <div>
                <FieldLabel>Description</FieldLabel>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition-colors focus-within:border-[var(--gold)]">
                  <div className="flex gap-1 border-b border-white/[0.06] px-2 py-1.5">
                    <button type="button" onClick={() => insertMd("**")} title="Bold" className="grid h-7 w-7 place-items-center rounded-md text-xs font-extrabold text-[var(--sage)] transition-colors hover:bg-white/[0.07] hover:text-[var(--cream)]">B</button>
                    <button type="button" onClick={() => insertMd("_")} title="Italic" className="grid h-7 w-7 place-items-center rounded-md text-xs italic text-[var(--sage)] transition-colors hover:bg-white/[0.07] hover:text-[var(--cream)]">I</button>
                    <button type="button" onClick={() => insertMd("- ")} title="Bullet list" className="grid h-7 w-7 place-items-center rounded-md text-sm text-[var(--sage)] transition-colors hover:bg-white/[0.07] hover:text-[var(--cream)]">≔</button>
                  </div>
                  <textarea ref={descRef} value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="CTPs, ace pot, where to meet, what to bring…" className="w-full resize-none bg-transparent px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none" />
                </div>
              </div>
              <div>
                <FieldLabel>Play format *</FieldLabel>
                <Segmented options={[...LEAGUE_FORMATS]} value={format} onChange={setFormat} />
              </div>
              {myLeagues.length > 0 && (
                <label className="block">
                  <FieldLabel>League <span className="normal-case tracking-normal text-[var(--sage-dim)]">— optional; otherwise one is set up for you</span></FieldLabel>
                  <select value={leagueChoice} onChange={(e) => setLeagueChoice(e.target.value)} className={inputCls}>
                    <option value="">Set up automatically</option>
                    {myLeagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>
              )}
              <div>
                <FieldLabel>Visibility *</FieldLabel>
                <div className="grid gap-3">
                  <button onClick={() => setIsPrivate(false)} className={optionCard(!isPrivate)}>
                    <IconTile selected={!isPrivate}><IconEye /></IconTile>
                    <span><span className="block font-bold text-[var(--cream)]">Public event</span><span className="mt-0.5 block text-xs text-[var(--sage)]">Listed in Radius event discovery and on the league page.</span></span>
                    <Radio on={!isPrivate} />
                  </button>
                  <button onClick={() => setIsPrivate(true)} className={optionCard(isPrivate)}>
                    <IconTile selected={isPrivate}><IconEyeOff /></IconTile>
                    <span><span className="block font-bold text-[var(--cream)]">Private event</span><span className="mt-0.5 block text-xs text-[var(--sage)]">Only people with the link can find it — never listed in discovery.</span></span>
                    <Radio on={isPrivate} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "when" && (
            <div className="grid gap-6">
              <div className="flex flex-wrap gap-4">
                <label className="block"><FieldLabel>Start date *</FieldLabel><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} min-w-[190px]`} autoFocus /></label>
                <label className="block"><FieldLabel>Tee time</FieldLabel><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputCls} min-w-[140px]`} /></label>
              </div>
              <div>
                <FieldLabel>Holes per round</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {[9, 18].map((n) => (
                    <button key={n} onClick={() => { setUseCustomHoles(false); setHoles(n); }} className={`h-11 min-w-[52px] rounded-xl border px-4 font-mono text-sm font-bold transition-all ${!useCustomHoles && holes === n ? "border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)]" : "border-white/[0.09] bg-white/[0.03] text-[var(--text-body)] hover:border-white/25"}`}>{n}</button>
                  ))}
                  <button onClick={() => setUseCustomHoles(true)} className={`h-11 rounded-xl border px-4 text-sm font-bold transition-all ${useCustomHoles ? "border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)]" : "border-white/[0.09] bg-white/[0.03] text-[var(--text-body)] hover:border-white/25"}`}>Custom</button>
                  {useCustomHoles && <input inputMode="numeric" value={customHoles} onChange={(e) => setCustomHoles(e.target.value)} placeholder="27" className={`${inputCls} w-24`} autoFocus />}
                </div>
              </div>
              {(isLeagueKind || kind === "tournament") && (
              <div>
                <FieldLabel>{isLeagueKind ? "How many weeks?" : "How many rounds?"}</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {(isLeagueKind ? [1, 4, 8, 12] : [1, 2, 3, 4, 5]).map((n) => (
                    <button
                      key={n}
                      onClick={() => { setUseCustomN(false); (isLeagueKind ? setRepeat : setRounds)(n); }}
                      className={`h-11 min-w-[52px] rounded-xl border px-4 font-mono text-sm font-bold transition-all ${!useCustomN && (isLeagueKind ? repeat : rounds) === n ? "border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)]" : "border-white/[0.09] bg-white/[0.03] text-[var(--text-body)] hover:border-white/25"}`}
                    >{n}</button>
                  ))}
                  <button onClick={() => setUseCustomN(true)} className={`h-11 rounded-xl border px-4 text-sm font-bold transition-all ${useCustomN ? "border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)]" : "border-white/[0.09] bg-white/[0.03] text-[var(--text-body)] hover:border-white/25"}`}>Custom</button>
                  {useCustomN && <input inputMode="numeric" value={customN} onChange={(e) => setCustomN(e.target.value)} placeholder={isLeagueKind ? "≤26" : "≤6"} className={`${inputCls} w-24`} autoFocus />}
                </div>
                <p className="mt-3 text-xs text-[var(--sage-dim)]">
                  {isLeagueKind
                    ? nCount > 1 ? `Creates ${nCount} weekly events starting ${date || "your start date"} — the whole season in one go.` : "One league night. You can schedule the rest of the season any time."
                    : nCount > 1 ? `${nCount} rounds, one leaderboard — scores total across all rounds.` : "Single-round event."}
                </p>
              </div>
              )}
            </div>
          )}

          {step === "where" && (
            <div className="grid gap-4">
              {!byAddress ? (
                <div className="relative">
                  <FieldLabel>Event location *</FieldLabel>
                  {course ? (
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-dim)] px-4 py-3">
                      <IconPin className="h-5 w-5 shrink-0 text-[var(--gold)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-[var(--cream)]">{course.name}</span>
                        {(course.city || course.state) && <span className="block text-xs text-[var(--sage)]">{[course.city, course.state].filter(Boolean).join(", ")}</span>}
                      </span>
                      <button onClick={() => { setCourse(null); setCourseQ(""); }} className="text-[var(--sage-dim)] transition-colors hover:text-[var(--cream)]" aria-label="Clear course">✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sage-dim)]"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                        <input value={courseQ} onChange={(e) => setCourseQ(e.target.value)} placeholder="Search the course directory" className={`${inputCls} pl-11`} autoFocus />
                      </div>
                      {hits.length > 0 && (
                        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#1c2a22] shadow-2xl">
                          {hits.map((h) => (
                            <button key={h.id} onClick={() => { setCourse(h); setHits([]); }} className="flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.05]">
                              <IconPin className="h-4 w-4 shrink-0 text-[var(--sage)]" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-[var(--cream)]">{h.name}</span>
                                {(h.city || h.state) && <span className="block text-xs text-[var(--sage-dim)]">{[h.city, h.state].filter(Boolean).join(", ")}</span>}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <label className="block">
                  <FieldLabel>Location *</FieldLabel>
                  <input value={customPlace} onChange={(e) => setCustomPlace(e.target.value)} placeholder="Field house, park pavilion, address…" className={inputCls} autoFocus />
                </label>
              )}
              <button onClick={() => { setByAddress((b) => !b); setCourse(null); setCourseQ(""); setCustomPlace(""); }} className="w-fit text-xs font-bold text-[var(--gold)] hover:underline">
                {byAddress ? "Search the course directory instead" : "Type a custom location instead"}
              </button>
            </div>
          )}

          {step === "money" && (
            <div className="grid gap-5">
              <div className="flex flex-wrap gap-5">
                <label className="block">
                  <FieldLabel>Buy-in per player ($)</FieldLabel>
                  <input inputMode="numeric" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} placeholder="0, free event" className={`${inputCls} w-[180px]`} autoFocus />
                </label>
                <label className="block">
                  <FieldLabel>Field cap <span className="normal-case tracking-normal text-[var(--cream-38)]">optional</span></FieldLabel>
                  <input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="72" className={`${inputCls} w-[140px]`} />
                </label>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-[var(--sage-dim)]">Set a buy-in and the event gets a money board: who&apos;s paid, pot collected, payouts, and what&apos;s left. Leave it blank for a free event.</p>
            </div>
          )}

          {step === "contact" && (
            <div className="grid max-w-md gap-5">
              <label className="block">
                <FieldLabel>Contact email</FieldLabel>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="director@yourleague.com" className={inputCls} autoFocus />
              </label>
              <label className="block">
                <FieldLabel>Contact phone</FieldLabel>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" className={inputCls} />
              </label>
            </div>
          )}

          {step === "logo" && (
            <div className="grid gap-4">
              <label className={`grid h-56 w-56 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${logoPreview ? "border-[var(--gold)]/50" : "border-white/15 hover:border-[var(--gold)]/50"}`}>
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]"><IconPlus /></span>
                    <span className="mt-3 block text-sm font-bold text-[var(--cream)]">Add logo</span>
                    <span className="mt-1 block text-xs text-[var(--sage-dim)]">JPEG or PNG · ~256×256</span>
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setLogoFile(f);
                    if (f) setLogoPreview(URL.createObjectURL(f));
                  }}
                />
              </label>
              {logoPreview && <button onClick={() => { setLogoFile(null); setLogoPreview(""); }} className="w-fit text-xs font-bold text-[var(--sage-dim)] hover:text-[#f08c8c]">Remove logo</button>}
            </div>
          )}

          {step === "review" && (
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              {[
                { label: "Event type", value: kindMeta?.label ?? "—", idx: 0 },
                { label: evName.trim() || "Event", value: desc.trim() ? (desc.length > 120 ? `${desc.slice(0, 120)}…` : desc) : "No description", idx: 1 },
                { label: "Play format", value: format, idx: 1 },
                { label: "Visibility", value: isPrivate ? "Private — link only" : "Public event", idx: 1 },
                ...(chosenLeague ? [{ label: "League", value: chosenLeague.name, idx: 1 }] : []),
                { label: "Event dates", value: date ? `${new Date(`${date}T${time}`).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${isLeagueKind && nCount > 1 ? ` · weekly × ${nCount}` : ""}${!isLeagueKind && nCount > 1 ? ` · ${nCount} rounds` : ""}` : "—", idx: 2 },
                { label: "Holes per round", value: String(holesN), idx: 2 },
                { label: "Event location", value: placeName || "—", idx: 3 },
                { label: "Buy-in", value: `${Number(buyIn) > 0 ? `$${buyIn} per player` : "Free event"}${Number(capacity) > 0 ? ` · cap ${capacity}` : ""}`, idx: 4 },
                { label: "Contact information", value: [email.trim(), phone.trim()].filter(Boolean).join(" · ") || "Not listed", idx: 5 },
                { label: "Logo", value: logoFile ? logoFile.name : "None", idx: 6 },
                { label: "Staff", value: profile?.name || "You", idx: -1 },
              ].map((row, i) => (
                <div key={i} className="flex items-start gap-4 border-b border-white/[0.05] px-5 py-4 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--gold)]">{row.label}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--cream)]">{row.value}</div>
                  </div>
                  {row.idx >= 0 && (
                    <button onClick={() => setStepIdx(row.idx)} aria-label={`Edit ${row.label}`} className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--sage-dim)] transition-colors hover:bg-white/[0.07] hover:text-[var(--gold)]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {err && <p className="mt-4 text-sm text-[#f08c8c]">{err}</p>}
        </div>
      </main>

      {/* Footer controls + progress */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-[var(--bg-deep)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <button onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0 || busy} className={`${btnGhost} disabled:invisible`}>Back</button>
          <div className="flex items-center gap-4">
            {skippable.includes(step) && (
              <button onClick={() => setStepIdx((i) => i + 1)} className="text-sm font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">Skip</button>
            )}
            {step === "review" ? (
              <button onClick={submit} disabled={busy} className={btnGold}>{busy ? "Creating…" : "Create event"}</button>
            ) : (
              <button onClick={() => setStepIdx((i) => i + 1)} disabled={!canNext[step] || busy} className={btnGold}>Next</button>
            )}
          </div>
        </div>
        <div className="h-1 w-full bg-white/[0.05]">
          <div className="h-full bg-[var(--gold)] transition-all duration-300" style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
