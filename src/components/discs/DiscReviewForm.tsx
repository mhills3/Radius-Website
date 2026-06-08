"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { addDiscReview, type DiscReview } from "@/lib/discReviews";

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function StarRow({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n === value ? 0 : n)} className={onChange ? "transition-transform hover:scale-110" : "cursor-default"}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={n <= value ? "#F6C165" : "rgba(0,0,0,0.12)"}><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.8l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" /></svg>
        </button>
      ))}
    </span>
  );
}

function Avatar({ url, name }: { url?: string; name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function DiscReviewForm({ slug }: { slug: string }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<DiscReview[]>([]);

  const submit = async () => {
    if (!user) { router.push("/login"); return; }
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await addDiscReview(user.uid, slug, rating, text.trim());
      if (r) { setAdded((a) => [r, ...a]); setText(""); setRating(0); }
    } finally { setBusy(false); }
  };

  return (
    <div>
      {/* the visitor's own new posts this session */}
      {added.length > 0 && (
        <div className="mb-5 space-y-4">
          {added.map((r) => (
            <div key={r.id} className="flex gap-3">
              <Avatar url={profile?.profileImageUrl} name={r.authorName} />
              <div className="min-w-0 flex-1 rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#16221b]">{r.authorName}</span>
                  {r.rating > 0 && <StarRow value={r.rating} />}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#46554c]">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {user ? (
        <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-3 text-sm">
            <span className="font-semibold text-[#16221b]">Your rating</span>
            <StarRow value={rating} onChange={setRating} />
            <span className="text-xs text-[#8a968d]">(optional)</span>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Share how this disc flies, what you use it for, plastic notes…" className="w-full resize-none rounded-xl border border-black/10 bg-[#faf8f3] px-4 py-3 text-sm text-[#16221b] outline-none focus:border-[var(--gold)]" />
          <div className="mt-3 flex justify-end">
            <button onClick={submit} disabled={!text.trim() || busy} className="rounded-full bg-[#16221b] px-6 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Posting…" : "Post review"}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => router.push("/login")} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-left text-sm text-[#6b7a70] shadow-sm transition-colors hover:border-[var(--gold)]">
          Rate this disc & share your take… <span className="font-bold text-[#9a7a3a]">Sign in to review</span>
        </button>
      )}
    </div>
  );
}
