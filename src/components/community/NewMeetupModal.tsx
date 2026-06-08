"use client";

import { useEffect, useState } from "react";
import { SKILL_LEVELS, createMeetup, type Meetup } from "@/lib/community";

export default function NewMeetupModal({ uid, onCreated, onClose }: { uid: string; onCreated: (m: Meetup) => void; onClose: () => void }) {
  const [courseName, setCourseName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [skill, setSkill] = useState("ALL_LEVELS");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!courseName.trim() || busy) return;
    setBusy(true);
    try {
      const dateMillis = date ? new Date(date + "T12:00:00").getTime() : Date.now();
      const m = await createMeetup(uid, { courseName: courseName.trim(), description: description.trim(), skillLevel: skill, maxPlayers, dateMillis, timeLabel: time.trim() });
      if (m) onCreated(m);
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[7vh]">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-mid)] text-[var(--cream)] shadow-2xl animate-[fadeIn_0.25s_ease]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
          <span className="text-sm font-bold">Host a meetup</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--sage)] hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Course</label>
            <input autoFocus value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="e.g. Gordon Conwell" className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} [color-scheme:dark]`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Time</label>
              <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 9:00 AM" className={field} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Skill level</label>
              <select value={skill} onChange={(e) => setSkill(e.target.value)} className={`${field} appearance-none`}>
                {SKILL_LEVELS.map((s) => <option key={s.key} value={s.key} className="bg-[var(--bg-mid)]">{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Max players</label>
              <input type="number" min={2} max={20} value={maxPlayers} onChange={(e) => setMaxPlayers(Math.max(2, Math.min(20, Number(e.target.value) || 4)))} className={field} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Details (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Casual doubles, bring your own discs…" className={`${field} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
          <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Cancel</button>
          <button onClick={submit} disabled={!courseName.trim() || busy} className="rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Creating…" : "Create meetup"}</button>
        </div>
      </div>
    </div>
  );
}
