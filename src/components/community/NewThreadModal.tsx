"use client";

import { useEffect, useState } from "react";
import { FORUM_CATEGORIES, categoryColor, createThread, type Thread } from "@/lib/community";

export default function NewThreadModal({ uid, onCreated, onClose }: { uid: string; onCreated: (t: Thread) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cat, setCat] = useState("General");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const t = await createThread(uid, { title: title.trim(), body: body.trim(), category: cat });
      if (t) onCreated(t);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[8vh]">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-mid)] text-[var(--cream)] shadow-2xl animate-[fadeIn_0.25s_ease]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
          <span className="text-sm font-bold">Start a thread</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--sage)] hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="space-y-4 p-5">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Thread title" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] font-semibold text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
          <div className="flex flex-wrap gap-2">
            {FORUM_CATEGORIES.filter((c) => c !== "All").map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${cat === c ? "" : "bg-white/[0.05] text-[var(--sage)] hover:text-[var(--cream)]"}`} style={cat === c ? { background: `${categoryColor(c)}26`, color: categoryColor(c) } : undefined}>{c}</button>
            ))}
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Share details, ask a question, start a discussion…" className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
          <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Cancel</button>
          <button onClick={submit} disabled={!title.trim() || busy} className="rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Posting…" : "Post thread"}</button>
        </div>
      </div>
    </div>
  );
}
