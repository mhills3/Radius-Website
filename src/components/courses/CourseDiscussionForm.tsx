"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { addCoursePost, type CoursePost } from "@/lib/courseCommunity";

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function Avatar({ url, name }: { url?: string; name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function CourseDiscussionForm({ courseId, courseName }: { courseId: string; courseName: string }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<CoursePost[]>([]);

  const submit = async () => {
    if (!user) { router.push("/login"); return; }
    if (!text.trim() || busy) return;
    setBusy(true);
    try { const p = await addCoursePost(user.uid, courseId, text.trim()); if (p) { setAdded((a) => [p, ...a]); setText(""); } }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-4">
      {added.length > 0 && (
        <div className="mb-5 space-y-4">
          {added.map((p) => (
            <div key={p.id} className="flex gap-3">
              <Avatar url={profile?.profileImageUrl} name={p.authorName} />
              <div className="min-w-0 flex-1 rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
                <div className="text-sm font-bold text-[#16221b]">{p.authorName}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#46554c]">{p.text}</p>
                <div className="mt-1.5 text-xs text-[#8a968d]">{fmtDate(p.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {user ? (
        <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={`Ask a question or share a tip about ${courseName}…`} className="w-full resize-none rounded-xl border border-black/10 bg-[#faf8f3] px-4 py-3 text-sm text-[#16221b] outline-none focus:border-[var(--gold)]" />
          <div className="mt-3 flex justify-end">
            <button onClick={submit} disabled={!text.trim() || busy} className="rounded-full bg-[#16221b] px-6 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Posting…" : "Post"}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => router.push("/login")} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-left text-sm text-[#6b7a70] shadow-sm transition-colors hover:border-[var(--gold)]">
          Join the {courseName} discussion… <span className="font-bold text-[#9a7a3a]">Sign in to post</span>
        </button>
      )}
    </div>
  );
}
