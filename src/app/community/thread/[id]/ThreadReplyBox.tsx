"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { addReply } from "@/lib/community";

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

export default function ThreadReplyBox({ threadId }: { threadId: string }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<{ id: string; name: string; handle?: string; text: string; createdAt: number }[]>([]);

  const gate = () => router.push("/login");
  const submit = async () => {
    if (!user) return gate();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await addReply(user.uid, threadId, text.trim());
      if (r) { setAdded((a) => [...a, { id: r.id, name: r.authorName, handle: r.authorHandle, text: r.text, createdAt: r.createdAt }]); setText(""); }
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-4">
      {added.length > 0 && (
        <div className="mb-4 space-y-4">
          {added.map((r) => (
            <div key={r.id} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)] ring-1 ring-white/10">
                {profile?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profileImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (r.name || "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl bg-white/[0.05] px-3.5 py-2.5">
                  <div className="text-sm font-bold text-[var(--cream)]">{r.name}{r.handle ? <span className="ml-1.5 text-xs font-normal text-[var(--sage-dim)]">@{r.handle}</span> : null}</div>
                  <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-body)]">{r.text}</div>
                </div>
                <div className="mt-1 pl-1 text-xs text-[var(--sage-dim)]">{fmtDate(r.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {user ? (
        <div className="flex items-end gap-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Add a reply…" className="max-h-32 min-h-[46px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
          <button onClick={submit} disabled={!text.trim() || busy} className="shrink-0 rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "…" : "Reply"}</button>
        </div>
      ) : (
        <button onClick={gate} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-[var(--sage-dim)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--text-body)]">Add a reply… <span className="font-semibold text-[var(--gold)]">Sign in to join</span></button>
      )}
    </div>
  );
}
