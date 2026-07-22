"use client";

// DEV TOOL — demo data seeder. Creates a clearly-labeled demo league with events
// in every state (live, complete, filling, doubles, empty) so the events flow can
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
      const leagueId = freshId();
      const leagueSlug = `demo-north-shore-circuit-${leagueId.slice(0, 6).toLowerCase()}`;
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
        id: leagueId, name: "North Shore Demo Circuit", slug: leagueSlug,
        courseName: "Stage Fort Park", adminIds: [cid], createdById: cid, createdByName: "Demo",
        settings: { format: "Singles", startFormat: "Shotgun", description: "Sample data for design review. Delete from the seed page when done.", divisions: DIVS, bestN: 6, handicapPercent: 90, bagTags: true },
        brandPrimary: "#7FC8A9", brandSecondary: "#C89BE8",
        memberCount: 1, acePotBalance: 85, createdAt: now, lastUpdated: now, seedTag: DEMO_TAG,
      });
      await setDoc(doc(db, "leagues", leagueId, "members", cid), { name: "Mikey", role: "owner", joinedAt: now });

      const mkEvent = async (ev: Record<string, unknown>) => {
        const id = freshId();
        const data: Record<string, unknown> = {
          id, leagueId, leagueName: "North Shore Demo Circuit", format: "Singles", startFormat: "Shotgun",
          holes: 18, roundCount: 1, status: "scheduled", createdAt: now, seedTag: DEMO_TAG, ...ev,
        };
        for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
        await setDoc(doc(db, "leagueEvents", id), data);
        return id;
      };
      const mkEntry = (evId: string, entryId: string, e: Record<string, unknown>) =>
        setDoc(doc(db, "leagueEvents", evId, "entries", entryId), { checkedInAt: now - 2 * H, seedTag: DEMO_TAG, ...e });

      say("Live event (you are T3)…");
      const live = await mkEvent({ extras: ["ace_pool", "ctp", "bag_tags"], name: "Cape Ann Weekly · Wk 12", kind: "league", date: now - 1.5 * H, courseId: rc(0)?.id, courseName: rc(0)?.name ?? "Stage Fort Park", buyIn: 10, capacity: 24, entryCount: 19 });
      const liveScores = [
        { holes: [3,3,2,3,3,2,3,3,3,2,3,3,3,2], thru: 14 },
        { holes: [3,2,3,3,3,3,2,3,3,3,2,3,3,3,3], thru: 15 },
        null, // you
        { holes: [3,3,3,2,3,3,3,3,2,3,3,4,3,3], thru: 14 },
        { holes: [3,3,4,3,3,3,3,2,3,3,3,3,4], thru: 13 },
      ];
      const youLive = { holes: [2,3,3,2,3,4,3,3,2,3,3,3,3,3], thru: 14 };
      for (let i = 0; i < 19; i++) {
        const isYou = i === 2;
        const sc = isYou ? youLive : liveScores[i];
        await mkEntry(live, isYou ? cid : freshId(), {
          name: isYou ? "Mikey" : FAKE[i], division: DIVS[i % 3], paid: i < 15,
          ...(sc ? { holeScores: sc.holes, thruHole: sc.thru } : {}),
        });
      }

      say("Complete tournament (full board + payouts)…");
      const done = await mkEvent({ extras: ["ace_pool", "bag_tags"], name: "Birchwood Fall Classic", kind: "tournament", date: now - 3 * D, courseId: rc(1)?.id, courseName: rc(1)?.name ?? "Birchwood DGC", roundCount: 2, buyIn: 45, capacity: 72, entryCount: 14, status: "complete", description: "Two rounds on the full layout. Tee assignments drop the night before.\n- CTP on 7 and 14\n- Ace pot carries" , contactEmail: "demo@radiusdiscgolf.com" });
      const finals = [[54, 51], [53, 53], [55, 52], [54, 54], [56, 53], [55, 55], [57, 54], [56, 56], [58, 55], [57, 57], [59, 56], [58, 58], [60, 57], [59, 59]];
      for (let i = 0; i < 14; i++) {
        const isYou = i === 2;
        const [r1, r2] = finals[i];
        await mkEntry(done, isYou ? cid : freshId(), {
          name: isYou ? "Mikey" : FAKE[i + 5], division: DIVS[i % 3], paid: true,
          roundScores: [r1, r2], score: r1 + r2,
          ...(i < 3 && rc(1)?.pars?.length ? { holeScores: cardFor(rc(1)!.pars, 18, r2), thruHole: 18 } : {}),
          ...(i === 0 ? { payout: 150, tag: 1 } : i === 1 ? { payout: 100, tag: 2 } : isYou ? { payout: 70, tag: 3 } : { tag: i + 1 }),
        });
      }

      say("Scheduled weekly (6 checked in, no cap)…");
      const thu = await mkEvent({ extras: ["beginner", "women", "glow"], name: "Thursday Night Flights", kind: "league", date: now + 2 * D, courseId: rc(2)?.id, courseName: rc(2)?.name ?? "Maudslay State Park", buyIn: 10, entryCount: 6 });
      for (let i = 0; i < 6; i++) await mkEntry(thu, freshId(), { name: FAKE[(i + 3) % FAKE.length], division: DIVS[i % 3] });

      say("Open tournament (just opened)…");
      const open = await mkEvent({ name: "Granite Coast Open", kind: "tournament", date: now + 6 * D, courseId: rc(3)?.id, courseName: rc(3)?.name ?? "Pye Brook Park", roundCount: 2, buyIn: 55, capacity: 84, entryCount: 9 });
      for (let i = 0; i < 9; i++) await mkEntry(open, freshId(), { name: FAKE[(i + 9) % FAKE.length] });

      say("Doubles with teams…");
      const dbl = await mkEvent({ extras: ["charity"], name: "Sunday Doubles", kind: "social", format: "Doubles", date: now + 5 * D, courseId: rc(4)?.id, courseName: rc(4)?.name ?? "Borderland State Park", buyIn: 12, capacity: 24, entryCount: 10 });
      for (let i = 0; i < 10; i++) await mkEntry(dbl, freshId(), { name: FAKE[(i + 12) % FAKE.length], teamId: Math.floor(i / 2) + 1 });

      say("Empty league night (zero-state)…");
      await mkEvent({ name: "Merrimack Valley Series", kind: "league", date: now + 9 * D, courseName: "Devens DGC", buyIn: 60, capacity: 48, entryCount: 0 });

      say(`Done. Browse /leagues or the demo league directly.`);
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

  return (
    <main className="mx-auto max-w-xl px-5 pb-24 pt-16">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--gold)]">Dev tool</p>
      <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-extrabold text-[var(--cream)]">Demo data</h1>
      <p className="mt-2 text-sm text-[var(--cream-60)]">Seeds a demo league with events in every state: live with scores, a completed tournament, filling weeklies, doubles teams, and a zero-state night. Everything is tagged and fully removable.</p>
      {!user ? (
        <p className="mt-6 text-sm text-[var(--cream-38)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to seed.</p>
      ) : (
        <div className="mt-6 flex gap-3">
          <button onClick={seed} disabled={busy} className={btnGold}>{busy ? "Working…" : "Load demo data"}</button>
          <button onClick={clean} disabled={busy} className={btnGhost}>Delete demo data</button>
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
