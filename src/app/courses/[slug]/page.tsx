"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getCourseById,
  getCourseScores,
  idFromSlug,
  type Course,
  type CourseScore,
} from "@/lib/courses";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function CoursePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [scores, setScores] = useState<CourseScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      // The slug ends with the first 8 chars of the course ID.
      // We need to find the full ID by querying Firestore.
      const shortId = idFromSlug(slug);
      if (!shortId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Try direct lookup first
      let c = await getCourseById(shortId);

      // If not found, search by prefix — the slug only has 8 chars of the ID
      if (!c) {
        const { getDocs, collection, query: q, where: w } = await import("firebase/firestore");
        // We'll try fetching all approved courses and matching by prefix
        const allSnap = await getDocs(collection(db, "courses"));
        const match = allSnap.docs.find((d) => d.id.startsWith(shortId));
        if (match) {
          c = await getCourseById(match.id);
        }
      }

      if (!c) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setCourse(c);
      const s = await getCourseScores(c.id);
      setScores(s);
      setLoading(false);
    }

    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-[var(--sage)]">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading course...
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Course not found
        </h1>
        <Link href="/courses" className="text-sm text-[var(--gold)] hover:underline">
          Back to all courses
        </Link>
      </div>
    );
  }

  const sortedHoles = [...(course.holes || [])].sort(
    (a, b) => a.holeNumber - b.holeNumber
  );

  function formatScore(n: number) {
    if (n === 0) return "E";
    return n > 0 ? `+${n}` : `${n}`;
  }

  function formatDate(ms: number) {
    if (!ms) return "";
    return new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Breadcrumb */}
      <Link
        href="/courses"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M9 12L4 7l5-5" />
        </svg>
        All Courses
      </Link>

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight md:text-5xl">
          {course.name}
        </h1>
        <p className="mt-2 text-lg text-[var(--sage)]">
          {course.city}
          {course.state ? `, ${course.state}` : ""}
        </p>

        {/* Stats */}
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-[var(--sage-dim)]">Holes</div>
            <div className="font-[family-name:var(--font-heading)] text-xl font-bold">
              {course.holeCount}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-[var(--sage-dim)]">Par</div>
            <div className="font-[family-name:var(--font-heading)] text-xl font-bold">
              {course.par}
            </div>
          </div>
          {course.distanceFt > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-[var(--sage-dim)]">Distance</div>
              <div className="font-[family-name:var(--font-heading)] text-xl font-bold">
                {course.distanceFt.toLocaleString()} ft
              </div>
            </div>
          )}
          {course.terrain && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-[var(--sage-dim)]">Terrain</div>
              <div className="font-[family-name:var(--font-heading)] text-xl font-bold capitalize">
                {course.terrain}
              </div>
            </div>
          )}
          {course.communityAverage != null && (
            <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-4 py-3">
              <div className="text-xs text-[var(--gold)]">Avg Score</div>
              <div className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--gold)]">
                {formatScore(Math.round(course.communityAverage))}
              </div>
            </div>
          )}
        </div>

        {course.description && (
          <p className="mt-6 max-w-2xl text-[var(--text-body)]">
            {course.description}
          </p>
        )}
      </div>

      {/* Hole-by-Hole */}
      {sortedHoles.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold">
            Hole-by-Hole
          </h2>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-[var(--sage-dim)]">
                  <th className="px-4 py-3">Hole</th>
                  <th className="px-4 py-3">Par</th>
                  <th className="px-4 py-3">Distance</th>
                </tr>
              </thead>
              <tbody>
                {sortedHoles.map((hole) => (
                  <tr
                    key={hole.holeNumber}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 font-bold text-[var(--gold)]">
                      {hole.holeNumber}
                    </td>
                    <td className="px-4 py-3">{hole.par}</td>
                    <td className="px-4 py-3">
                      {hole.distance > 0 ? `${hole.distance} ft` : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-white/[0.03] font-bold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3">
                    {sortedHoles.reduce((s, h) => s + h.par, 0)}
                  </td>
                  <td className="px-4 py-3">
                    {sortedHoles.reduce((s, h) => s + (h.distance || 0), 0).toLocaleString()}{" "}
                    ft
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Leaderboard */}
      {scores.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold">
            Leaderboard
          </h2>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-[var(--sage-dim)]">
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Holes</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, i) => (
                  <tr
                    key={`${score.playerId}-${score.date}`}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-[var(--sage-dim)]">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {score.playerName}
                      {score.username && (
                        <span className="ml-2 text-[var(--sage-dim)]">
                          @{score.username}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 font-bold ${
                        score.relativeToPar < 0
                          ? "text-green-400"
                          : score.relativeToPar === 0
                          ? "text-[var(--cream)]"
                          : "text-red-400"
                      }`}
                    >
                      {formatScore(score.relativeToPar)}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--text-body)] sm:table-cell">
                      {score.holesPlayed}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--text-body)] sm:table-cell">
                      {formatDate(score.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mt-16 rounded-2xl border border-[var(--gold)]/15 bg-[var(--gold)]/5 p-8 text-center">
        <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Play this course with <span className="text-[var(--gold)]">Radius</span>
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-body)]">
          Get personalized disc recommendations, track your rounds, and compete
          on the leaderboard.
        </p>
        <a
          href="https://apps.apple.com/us/app/radius-disc-golf/id6760574186"
          target="_blank"
          rel="noopener"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-7 py-3.5 text-sm font-bold text-[var(--bg-deep)] shadow-[0_8px_30px_rgba(246,193,101,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]"
        >
          Download Radius
        </a>
      </section>
    </div>
  );
}
