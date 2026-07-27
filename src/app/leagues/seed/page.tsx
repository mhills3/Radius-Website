"use client";

// DEV TOOL — demo data seeder. Creates a clearly-labeled demo league with events
// a curated handful (2 past, 1 live, 3 upcoming) so the events flow can
// be reviewed in full effect. Runs as the signed-in user (Firestore writes are
// auth-gated). Delete removes everything it created. Branch-only tooling.

import { useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDocs, collection, query, where, orderBy, startAt, limit, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { resolveCanonicalId } from "@/lib/account";
import { freshId } from "@/lib/leagues";
import { btnGold, btnGhost, card } from "@/components/leagues/ui";

const DEMO_TAG = "radius-demo-seed";
const FAKE = [
  "J. Whitmore", "A. Castellano", "D. Rourke", "K. Okafor", "T. Sandoval", "B. Lindqvist",
  "S. Marchetti", "R. Ellison", "P. Nakamura", "C. Beaudry", "M. Ferreira", "L. Tran",
  "G. Holloway", "N. Duval", "E. Kowalski", "V. Reyes", "H. Bergström", "O. Twardowski",
  "F. Delacroix", "W. Ashford", "I. Petrov", "Z. Marlowe",
];
const DIVS = ["Open", "FPO", "Rec"];

export default function SeedPage() {
  const { user } = useAuth();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const say = (m: string) => setLog((l) => [...l, m]);

  const seed = async () => {
    if (!user || busy) return;
    setBusy(true); setLog([]);
    try {
      const cid = await resolveCanonicalId(user.uid);
      const now = Date.now();
      const H = 3600_000, D = 24 * H;
      // Clean slate: wipe EVERY existing league + event first (demo orphans AND
      // manual test leagues), so a load always lands on exactly the curated set
      // with zero duplicates. Branch-only tool — safe because Events is unpublished.
      say("Clearing all existing leagues & events…");
      const prevEvs = await getDocs(collection(db, "leagueEvents"));
      for (const ev of prevEvs.docs) {
        for (const sub of ["entries", "cards", "messages"]) {
          const d = await getDocs(collection(db, "leagueEvents", ev.id, sub));
          await Promise.all(d.docs.map((x) => deleteDoc(x.ref)));
        }
        await deleteDoc(ev.ref);
      }
      const prevLs = await getDocs(collection(db, "leagues"));
      for (const l of prevLs.docs) {
        for (const sub of ["members", "standings"]) {
          const d = await getDocs(collection(db, "leagues", l.id, sub));
          await Promise.all(d.docs.map((x) => deleteDoc(x.ref)));
        }
        await deleteDoc(l.ref);
      }
      say(`Cleared ${prevEvs.docs.length} event(s), ${prevLs.docs.length} league(s).`);
      const leagueId = "DEMO-NORTH-SHORE-CIRCUIT";
      const leagueSlug = "demo-north-shore-circuit";
      setSlug(leagueSlug);

      say("Finding photogenic courses…");
      // orderBy on coverPhotoUrl returns only docs that HAVE the field — real
      // covers make the discovery photo strips reviewable with demo data.
      let real: { id: string; name: string; pars: number[] }[] = [];
      try {
        const snap = await getDocs(query(collection(db, "courses"), orderBy("coverPhotoUrl"), startAt("http"), limit(40)));
        const hasPars = (c: Record<string, unknown>) => {
          const holes = (c.holes ?? (c.layouts as { holes?: unknown[] }[] | undefined)?.[0]?.holes) as { par?: number }[] | undefined;
          return Array.isArray(holes) && holes.length >= 9 && holes.some((h) => typeof h?.par === "number");
        };
        const parsOf = (c: Record<string, unknown>) => {
          const holes = (c.holes ?? (c.layouts as { holes?: unknown[] }[] | undefined)?.[0]?.holes) as { par?: number; holeNumber?: number }[] | undefined;
          return (holes ?? []).slice().sort((a, b) => (a.holeNumber ?? 0) - (b.holeNumber ?? 0)).map((h) => (typeof h.par === "number" ? h.par : 3));
        };
        real = snap.docs
          .filter((d) => {
            const c = d.data();
            return /^https?:\/\//.test(String(c.coverPhotoUrl)) && c.name && (c.state || c.city) && hasPars(c);
          })
          .map((d) => ({ id: d.id, name: String(d.data().name), pars: parsOf(d.data()) }));
      } catch { say("(no photo courses found — strips will show the contour fallback)"); }
      const rc = (i: number) => real.length ? real[i % real.length] : null;
      // Distribute a round total across real pars: birdies/bogeys spread deterministically.
      const cardFor = (pars: number[], holes: number, total: number) => {
        const ps = (pars.length >= holes ? pars.slice(0, holes) : Array.from({ length: holes }, (_, i) => pars[i % Math.max(1, pars.length)] ?? 3));
        const card = [...ps];
        let delta = total - ps.reduce((a, b) => a + b, 0);
        let i = 0;
        while (delta !== 0 && i < 400) {
          const k = (i * 7) % holes;
          if (delta < 0 && card[k] > Math.max(2, ps[k] - 1)) { card[k] -= 1; delta += 1; }
          else if (delta > 0 && card[k] < ps[k] + 2) { card[k] += 1; delta -= 1; }
          i += 1;
        }
        return card;
      };

      say("Creating demo league…");
      await setDoc(doc(db, "leagues", leagueId), {
        id: leagueId, name: "North Shore Circuit", slug: leagueSlug,
        courseId: undefined, courseName: "Stage Fort Park", adminIds: [cid], createdById: cid, createdByName: "Mikey",
        settings: { format: "Singles", startFormat: "Shotgun", description: "Weekly rounds and the odd tournament around Cape Ann. All skill levels — come throw.", divisions: DIVS, bestN: 6, handicapPercent: 90, bagTags: true },
        memberCount: 1, acePotBalance: 85, createdAt: now, lastUpdated: now, seedTag: DEMO_TAG,
      });
      await setDoc(doc(db, "leagues", leagueId, "members", cid), { name: "Mikey", role: "owner", joinedAt: now });

      const mkEvent = async (ev: Record<string, unknown>) => {
        const id = freshId();
        const data: Record<string, unknown> = {
          id, leagueId, leagueName: "North Shore Circuit", format: "Singles", startFormat: "Shotgun",
          holes: 18, roundCount: 1, status: "scheduled", createdAt: now, seedTag: DEMO_TAG, ...ev,
        };
        for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
        await setDoc(doc(db, "leagueEvents", id), data);
        return id;
      };
      const mkEntry = (evId: string, entryId: string, e: Record<string, unknown>) =>
        setDoc(doc(db, "leagueEvents", evId, "entries", entryId), { checkedInAt: now - 2 * H, seedTag: DEMO_TAG, ...e });

      // ── A curated handful: two PAST events (completed, with results) and a
      //    live one, then a clean set of FUTURE events — all on photogenic
      //    courses with filled-in data. No repeats.

      say("Past · completed tournament…");
      const done = await mkEvent({
        name: "Birchwood Fall Classic", kind: "tournament", roundCount: 2, date: now - 12 * D,
        courseId: rc(1)?.id, courseName: rc(1)?.name ?? "Birchwood DGC", buyIn: 45, capacity: 72, entryCount: 14,
        status: "complete", payoutPlaces: 3, extras: ["ace_pool", "ctp", "bag_tags"], contactEmail: "circuit@radiusdiscgolf.com",
        description: "Our biggest tournament of the fall — two rounds on the full layout, CTP on 7 and 14, cash to the top 3.",
      });
      const finals = [[54, 51], [53, 53], [55, 52], [54, 54], [56, 53], [55, 55], [57, 54], [56, 56], [58, 55], [57, 57], [59, 56], [58, 58], [60, 57], [59, 59]];
      for (let i = 0; i < 14; i++) {
        const isYou = i === 2;
        const [r1, r2] = finals[i];
        await mkEntry(done, isYou ? cid : freshId(), {
          name: isYou ? "Mikey" : FAKE[i + 3], division: DIVS[i % 3], paid: true, roundScores: [r1, r2], score: r1 + r2,
          ...(i < 3 && rc(1)?.pars?.length ? { holeScores: cardFor(rc(1)!.pars, 18, r2), thruHole: 18 } : {}),
          ...(i === 0 ? { payout: 150, tag: 1 } : i === 1 ? { payout: 100, tag: 2 } : isYou ? { payout: 70, tag: 3 } : { tag: i + 1 }),
        });
      }

      say("Past · completed league night…");
      const wk11 = await mkEvent({
        name: "Cape Ann Weekly · Wk 11", kind: "league", date: now - 5 * D,
        courseId: rc(0)?.id, courseName: rc(0)?.name ?? "Stage Fort Park", buyIn: 10, capacity: 24, entryCount: 12,
        status: "complete", extras: ["ace_pool", "bag_tags"], description: "Last week's card — shotgun start, best round counts toward the season.",
      });
      const wk11Scores = [50, 51, 52, 53, 53, 54, 55, 55, 56, 57, 58, 60];
      for (let i = 0; i < 12; i++) {
        const isYou = i === 3;
        await mkEntry(wk11, isYou ? cid : freshId(), {
          name: isYou ? "Mikey" : FAKE[(i + 6) % FAKE.length], division: DIVS[i % 3], paid: true, score: wk11Scores[i],
          roundScores: [wk11Scores[i]], tag: i + 1,
          ...(i < 2 && rc(0)?.pars?.length ? { holeScores: cardFor(rc(0)!.pars, 18, wk11Scores[i]), thruHole: 18 } : {}),
        });
      }

      say("Live now · this week's league night…");
      const live = await mkEvent({
        name: "Cape Ann Weekly · Wk 12", kind: "league", date: now - 90 * 60000,
        courseId: rc(0)?.id, courseName: rc(0)?.name ?? "Stage Fort Park", buyIn: 10, capacity: 24, entryCount: 8,
        extras: ["ace_pool", "ctp", "bag_tags"], description: "In progress right now — live scores update as cards come in.",
      });
      const liveCards: Array<{ holes: number[]; thru: number } | null> = [
        { holes: [3,3,2,3,3,2,3,3,3,2,3,3,3,2], thru: 14 },
        { holes: [3,2,3,3,3,3,2,3,3,3,2,3,3,3,3], thru: 15 },
        null, // you
        { holes: [3,3,3,2,3,3,3,3,2,3,3,4,3,3], thru: 14 },
        { holes: [3,3,4,3,3,3,3,2,3,3,3,3,4], thru: 13 },
        { holes: [3,3,3,3,4,3,3,3,3,3,3,3], thru: 12 },
        { holes: [2,3,3,2,3,3,3,3,3,3,3], thru: 11 },
        { holes: [3,3,3,3,3,3,3,3,3,3,3,3,3], thru: 13 },
      ];
      const youLive = { holes: [2,3,3,2,3,4,3,3,2,3,3,3,3,3], thru: 14 };
      for (let i = 0; i < 8; i++) {
        const isYou = i === 2;
        const sc = isYou ? youLive : liveCards[i];
        await mkEntry(live, isYou ? cid : freshId(), {
          name: isYou ? "Mikey" : FAKE[i], division: DIVS[i % 3], paid: i < 6,
          ...(sc ? { holeScores: sc.holes, thruHole: sc.thru } : {}),
        });
      }

      say("Upcoming · this Thursday's league…");
      const thu = await mkEvent({
        name: "Thursday Night Flights", kind: "league", date: now + 3 * D,
        courseId: rc(2)?.id, courseName: rc(2)?.name ?? "Maudslay State Park", buyIn: 10, capacity: 40, entryCount: 9,
        extras: ["beginner", "women", "glow"], description: "Relaxed Thursday league — flighted by skill, glow discs once it gets dark. New players welcome.",
      });
      for (let i = 0; i < 9; i++) await mkEntry(thu, freshId(), { name: FAKE[(i + 2) % FAKE.length], division: DIVS[i % 3] });

      say("Upcoming · A-tier tournament…");
      const open = await mkEvent({
        name: "Granite Coast Open", kind: "tournament", roundCount: 2, date: now + 10 * D,
        courseId: rc(3)?.id, courseName: rc(3)?.name ?? "Pye Brook Park", buyIn: 55, capacity: 84, entryCount: 23,
        payoutPlaces: 3, extras: ["ace_pool", "ctp"], contactEmail: "circuit@radiusdiscgolf.com",
        description: "PDGA-style A-tier. Two rounds, tee assignments the night before, cash to the top 3 per division.",
      });
      for (let i = 0; i < 23; i++) await mkEntry(open, freshId(), { name: FAKE[(i + 7) % FAKE.length], division: DIVS[i % 3] });

      say("Upcoming · putting clinic…");
      const clinic = await mkEvent({
        name: "Saturday Putting Clinic", kind: "clinic", date: now + 6 * D,
        courseId: rc(4)?.id, courseName: rc(4)?.name ?? "Borderland State Park", buyIn: 15, capacity: 12, entryCount: 8,
        focus: "Putting", skillLevel: "All levels", durationMin: 90, bring: "Putters and a full bag", extras: ["beginner", "women"],
        description: "Small-group putting fundamentals — footwork, routine, and pressure reps. Coaches on hand, spots are limited.",
      });
      for (let i = 0; i < 8; i++) await mkEntry(clinic, freshId(), { name: FAKE[(i + 4) % FAKE.length] });

      say("Done — 1 league, 6 events (2 past, 1 live, 3 upcoming). Browse /leagues.");
    } catch (e) {
      say(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally { setBusy(false); }
  };

  const clean = async () => {
    if (!user || busy) return;
    setBusy(true); setLog([]);
    try {
      say("Finding demo docs…");
      const evs = await getDocs(query(collection(db, "leagueEvents"), where("seedTag", "==", DEMO_TAG)));
      for (const ev of evs.docs) {
        const entries = await getDocs(collection(db, "leagueEvents", ev.id, "entries"));
        await Promise.all(entries.docs.map((d) => deleteDoc(d.ref)));
        await deleteDoc(ev.ref);
      }
      const ls = await getDocs(query(collection(db, "leagues"), where("seedTag", "==", DEMO_TAG)));
      for (const l of ls.docs) {
        const members = await getDocs(collection(db, "leagues", l.id, "members"));
        await Promise.all(members.docs.map((d) => deleteDoc(d.ref)));
        const st = await getDocs(collection(db, "leagues", l.id, "standings"));
        await Promise.all(st.docs.map((d) => deleteDoc(d.ref)));
        await deleteDoc(l.ref);
      }
      say(`Removed ${evs.docs.length} events and ${ls.docs.length} league(s).`);
    } catch (e) {
      say(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally { setBusy(false); }
  };

  // Branch-only showcase reset: wipe EVERY league + event so the discovery feed
  // starts clean before seeding. Deletes entries/cards/messages/members/standings
  // subcollections too. Safe because Events is unpublished (only demo/test data).
  const wipeAll = async () => {
    if (!user || busy) return;
    if (!confirm("Delete ALL leagues and events (including your test ones)? This can't be undone.")) return;
    setBusy(true); setLog([]);
    try {
      say("Deleting all events…");
      const evs = await getDocs(collection(db, "leagueEvents"));
      for (const ev of evs.docs) {
        for (const sub of ["entries", "cards", "messages"]) {
          const d = await getDocs(collection(db, "leagueEvents", ev.id, sub));
          await Promise.all(d.docs.map((x) => deleteDoc(x.ref)));
        }
        await deleteDoc(ev.ref);
      }
      say("Deleting all leagues…");
      const ls = await getDocs(collection(db, "leagues"));
      for (const l of ls.docs) {
        for (const sub of ["members", "standings"]) {
          const d = await getDocs(collection(db, "leagues", l.id, sub));
          await Promise.all(d.docs.map((x) => deleteDoc(x.ref)));
        }
        await deleteDoc(l.ref);
      }
      say(`Wiped ${evs.docs.length} event(s) and ${ls.docs.length} league(s). Clean slate — Load demo data for the showcase set.`);
    } catch (e) {
      say(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-xl px-5 pb-24 pt-16">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--gold)]">Dev tool</p>
      <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-extrabold text-[var(--cream)]">Demo data</h1>
      <p className="mt-2 text-sm text-[var(--cream-60)]">Seeds one clean league with a curated handful of events — two completed (a tournament with payouts and a league night, both with results), one live right now, and three upcoming (league, A-tier, clinic). All on real courses with photos. Idempotent: re-loading replaces the demo data, never duplicates it.</p>
      {!user ? (
        <p className="mt-6 text-sm text-[var(--cream-38)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to seed.</p>
      ) : (
        <div className="mt-6 flex gap-3">
          <button onClick={seed} disabled={busy} className={btnGold}>{busy ? "Working…" : "Load demo data"}</button>
          <button onClick={clean} disabled={busy} className={btnGhost}>Delete demo data</button>
          <button onClick={wipeAll} disabled={busy} className="rounded-full px-4 py-3 text-sm font-semibold text-[#f08c8c] transition-colors hover:bg-[#f08c8c]/10 disabled:opacity-50">Wipe ALL events</button>
        </div>
      )}
      {log.length > 0 && (
        <div className={`${card} mt-6 p-4 font-mono text-xs leading-relaxed text-[var(--cream-60)]`}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
          {slug && <div className="mt-2"><Link href={`/leagues/${slug}`} className="font-bold text-[var(--gold)] hover:underline">Open demo league</Link></div>}
        </div>
      )}
    </main>
  );
}
