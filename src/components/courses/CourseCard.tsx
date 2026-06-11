"use client";

import Link from "next/link";
import { type Course, slugify } from "@/lib/courses";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={i < Math.round(rating) ? "#F6C165" : "rgba(0,0,0,0.12)"}>
          <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.8l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" />
        </svg>
      ))}
    </span>
  );
}

const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

export default function CourseCard({ course, played }: { course: Course; played?: { plays: number; best: number | null } }) {
  const loc = [course.city, course.state].filter(Boolean).join(", ");
  const lengthK = course.distanceFt ? `${Math.round(course.distanceFt).toLocaleString()} ft` : null;
  return (
    <Link href={`/courses/${slugify(course.name, course.id)}`} className="group flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.28)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--bg-deep)]">
        {course.coverPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverPhotoUrl} alt={course.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="relative h-full w-full">
            <div className="h-full w-full bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.22),var(--bg-deep))]" />
            <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "var(--cream)", opacity: 0.08 }} />
            <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-heading)] text-3xl font-extrabold text-[var(--cream)]/30">{course.name.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
        {played ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#16221b]/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#5fcf80] backdrop-blur-sm">✓ Played{played.best != null ? ` · best ${fmt(played.best)}` : ""}</span>
        ) : course.isFeatured ? (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--gold)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#16221b]">★ Featured</span>
        ) : null}
        <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">{course.isFree ? "Free" : course.isPublic ? "Public" : "Private"}</span>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-[family-name:var(--font-heading)] text-lg font-bold text-white drop-shadow">{course.name}</h3>
            {loc && <div className="truncate text-xs text-white/85 drop-shadow">📍 {loc}</div>}
          </div>
          {course.rating ? <span className="ml-2 shrink-0 rounded-full bg-black/45 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">★ {course.rating.toFixed(1)}</span> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#46554c]">
          <span className="font-bold text-[#16221b]">{course.holeCount} holes</span>
          {course.par ? <span>· Par {course.par}</span> : null}
          {lengthK && <span>· {lengthK}</span>}
        </div>
        {(course.amenities?.length || course.terrain) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {course.terrain && <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#46554c]">{course.terrain}</span>}
            {course.amenities?.slice(0, 2).map((a) => (
              <span key={a} className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#46554c]">{a}</span>
            ))}
          </div>
        )}
        {course.communityScoreCount ? (
          <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3 text-xs text-[#8a968d]">
            <Stars rating={course.rating ?? 0} />
            {course.reviewCount ? (<><span>{course.reviewCount} review{course.reviewCount === 1 ? "" : "s"}</span><span className="text-black/20">·</span></>) : null}
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {course.communityScoreCount.toLocaleString()} played
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
