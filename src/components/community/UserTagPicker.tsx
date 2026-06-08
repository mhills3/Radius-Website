"use client";

import { useEffect, useMemo, useState } from "react";
import { getMentionableUsers, type MentionUser } from "@/lib/leaderboard";

export default function UserTagPicker({ onSelect, onClose, exclude = [] }: { onSelect: (u: MentionUser) => void; onClose: () => void; exclude?: string[] }) {
  const [users, setUsers] = useState<MentionUser[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { getMentionableUsers().then(setUsers).catch(() => setUsers([])); }, []);

  const results = useMemo(() => {
    if (!users) return [];
    const ex = new Set(exclude);
    const s = q.trim().toLowerCase();
    const list = users.filter((u) => !ex.has(u.id) && (!s || `${u.name} ${u.username}`.toLowerCase().includes(s)));
    return list.slice(0, 40);
  }, [users, q, exclude]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-mid)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-white/10 p-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players to tag…" className="w-full rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:bg-white/[0.1]" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {users === null ? (
            <div className="p-6 text-center text-sm text-[var(--sage-dim)]">Loading players…</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--sage-dim)]">No players match.</div>
          ) : (
            results.map((u) => (
              <button key={u.id} onClick={() => { onSelect(u); onClose(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]">
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-deep)] text-xs font-bold text-[var(--cream)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {u.photo ? <img src={u.photo} alt="" className="h-full w-full object-cover" /> : (u.name || u.username || "?").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--cream)]">{u.name || u.username}</span>
                  <span className="block truncate text-xs text-[var(--sage-dim)]">@{u.username}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-white/10 p-2 text-right">
          <button onClick={onClose} className="rounded-full px-4 py-1.5 text-sm font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Done</button>
        </div>
      </div>
    </div>
  );
}
