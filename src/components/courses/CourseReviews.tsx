"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getProfileLite } from "@/lib/account";
import { getCourseReviews, submitCourseReview, type CourseReviewItem } from "@/lib/courseReviews";

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function Stars({ n, className = "" }: { n: number; className?: string }) {
  const s = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span className={`tracking-tight ${className}`} aria-label={`${s} out of 5 stars`}>
      <span className="text-[var(--gold)]">{"★".repeat(s)}</span>
      <span className="text-white/15">{"★".repeat(5 - s)}</span>
    </span>
  );
}

function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-deep)] text-sm font-bold text-[var(--cream)]">{(name || "?").charAt(0).toUpperCase()}</span>;
}

export default function CourseReviews({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<CourseReviewItem[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    getCourseReviews(courseId).then((r) => { if (live) setReviews(r); }).catch(() => { if (live) setReviews([]); });
    return () => { live = false; };
  }, [courseId]);

  const myReview = useMemo(() => (user ? reviews?.find((r) => r.authorUid === user.uid && !r.id.startsWith("inline_")) : undefined), [reviews, user]);

  const rated = (reviews || []).filter((r) => r.rating > 0);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;

  const startWriting = () => {
    setRating(myReview?.rating || 0);
    setComment(myReview?.comment || "");
    setErr("");
    setOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    if (rating < 1) { setErr("Pick a star rating."); return; }
    if (!comment.trim()) { setErr("Add a few words about the course."); return; }
    setSaving(true); setErr("");
    try {
      const profile = await getProfileLite(user.uid);
      const fresh = await submitCourseReview(courseId, {
        uid: user.uid,
        authorName: profile?.name || profile?.username || user.displayName || "Player",
        authorPhotoUrl: profile?.profileImageUrl,
        rating,
        comment: comment.trim(),
        dateMillis: Date.now(),
      });
      setReviews(fresh);
      setOpen(false);
    } catch {
      setErr("Couldn't save your review. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const list = reviews || [];
  const visible = showAll ? list : list.slice(0, 6);

  return (
    <section id="reviews" className="scroll-mt-32">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Reviews</h2>
          {rated.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-sm font-bold text-[var(--gold)]">
              <span>★ {avg.toFixed(1)}</span>
              <span className="font-medium text-[var(--gold)]/80">· {rated.length}</span>
            </span>
          )}
        </div>
        {user && !open && (
          <button onClick={startWriting} className="rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-[#141b16] transition-colors hover:bg-[var(--gold-bright)]">
            {myReview ? "Edit your review" : "Write a review"}
          </button>
        )}
        {!user && (
          <a href="/login" className="text-sm font-semibold text-[var(--gold)] hover:underline">Sign in to review</a>
        )}
      </div>

      {open && (
        <div className="mb-5 rounded-2xl border border-[var(--c-line)] bg-[var(--c-card)] p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} className="text-2xl leading-none transition-transform hover:scale-110" aria-label={`${s} stars`}>
                <span className={s <= (hover || rating) ? "text-[var(--gold)]" : "text-white/15"}>★</span>
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="How does this course play? Standout holes, condition, signage, difficulty…"
            className="w-full resize-none rounded-xl border border-[var(--c-line)] bg-[var(--c-bg)] px-4 py-3 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-muted)] focus:border-[var(--gold)]"
          />
          {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)} disabled={saving} className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--c-body)] hover:text-[var(--c-ink)] disabled:opacity-50">Cancel</button>
            <button onClick={submit} disabled={saving} className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm font-bold text-[#141b16] transition-opacity hover:opacity-90 disabled:opacity-60">{saving ? "Posting…" : myReview ? "Save changes" : "Post review"}</button>
          </div>
        </div>
      )}

      {reviews === null ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--c-raise)]" />)}</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--c-line)] p-10 text-center">
          <div className="text-3xl">⭐</div>
          <p className="mt-3 font-bold text-[var(--c-ink)]">No reviews yet</p>
          <p className="mt-1 text-sm text-[var(--c-muted)]">{user ? "Be the first to review this course." : "Sign in to be the first to review this course."}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-card)] p-5 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={r.authorName} url={r.authorPhotoUrl} />
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[var(--c-ink)]">{r.authorName}{user && r.authorUid === user.uid && <span className="ml-1.5 text-[11px] font-semibold text-[var(--gold)]">· You</span>}</div>
                      {r.dateMillis > 0 && <div className="text-[11px] text-[var(--c-muted)]">{fmtDate(r.dateMillis)}</div>}
                    </div>
                  </div>
                  {r.rating > 0 && <Stars n={r.rating} className="shrink-0 text-sm" />}
                </div>
                {r.comment && <p className="text-sm leading-relaxed text-[var(--c-body)]">{r.comment}</p>}
                {r.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photoUrl} alt="" loading="lazy" className="mt-3 h-40 w-full rounded-xl object-cover" />
                )}
              </div>
            ))}
          </div>
          {list.length > 6 && (
            <div className="mt-4 text-center">
              <button onClick={() => setShowAll((v) => !v)} className="rounded-full border border-[var(--c-line)] px-5 py-2 text-sm font-semibold text-[var(--c-body)] transition-colors hover:border-[var(--c-line)] hover:text-[var(--c-ink)]">
                {showAll ? "Show fewer" : `Show all ${list.length} reviews`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
