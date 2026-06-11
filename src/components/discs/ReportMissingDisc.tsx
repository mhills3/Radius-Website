"use client";

import { useEffect, useState } from "react";

const TYPES = ["Putter", "Midrange", "Fairway Driver", "Distance Driver"];

type Status = "idle" | "sending" | "done" | "error";

export default function ReportMissingDisc({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", manufacturer: "", type: "", speed: "", glide: "", turn: "", fade: "", website: "" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const reset = () => { setForm({ name: "", manufacturer: "", type: "", speed: "", glide: "", turn: "", fade: "", website: "" }); setStatus("idle"); setError(""); };
  const close = () => { setOpen(false); setTimeout(reset, 200); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Disc name is required."); return; }
    setStatus("sending"); setError("");
    try {
      const res = await fetch("/api/report-disc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not submit.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not submit.");
    }
  }

  const trigger = compact ? (
    <button onClick={() => setOpen(true)} className="font-semibold text-[#46554c] hover:text-[#9a7a3a]">Report a missing disc →</button>
  ) : (
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a968d] transition-colors hover:text-[#9a7a3a]">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      Missing a disc? Add it
    </button>
  );

  const Field = ({ label, k, placeholder, half }: { label: string; k: keyof typeof form; placeholder?: string; half?: boolean }) => (
    <label className={half ? "block" : "col-span-2 block"}>
      <span className="mb-1 block text-xs font-semibold text-[#46554c]">{label}</span>
      <input value={form[k]} onChange={set(k)} placeholder={placeholder} inputMode={half ? "decimal" : undefined}
        className="w-full rounded-xl border border-black/10 bg-[#faf8f3] px-3 py-2 text-sm text-[#16221b] outline-none placeholder-[#b3bbb2] focus:border-[var(--gold)]" />
    </label>
  );

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[6vh]">
          <div className="absolute inset-0 bg-black/55 animate-[fadeIn_0.2s_ease]" onClick={close} />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-black/8 bg-white shadow-2xl animate-[fadeIn_0.25s_ease]">
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-6 pb-4 pt-5">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-extrabold tracking-tight text-[#16221b]">Add a missing disc</h2>
                <p className="mt-0.5 text-xs text-[#8a968d]">Spotted a disc we don’t have? Send it over and we’ll add it to the database.</p>
              </div>
              <button onClick={close} className="-mr-1 shrink-0 rounded-full p-1.5 text-[#8a968d] hover:bg-black/[0.05] hover:text-[#16221b]" aria-label="Close">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {status === "done" ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--gold)]/20 text-[#9a7a3a]">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p className="font-bold text-[#16221b]">Thanks — got it!</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-[#6b7a70]">We’ll review <span className="font-semibold">{form.name.trim()}</span> and add it to the database soon.</p>
                <div className="mt-5 flex justify-center gap-2">
                  <button onClick={reset} className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-bold text-[#16221b] hover:border-[var(--gold)]">Add another</button>
                  <button onClick={close} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] hover:bg-[var(--gold-bright)]">Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="px-6 py-5">
                {/* honeypot — hidden from users, catches bots */}
                <input value={form.website} onChange={set("website")} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Disc name *" k="name" placeholder="e.g. Zone OS" />
                  <Field label="Manufacturer" k="manufacturer" placeholder="e.g. Discraft" />
                  <label className="col-span-2 block">
                    <span className="mb-1 block text-xs font-semibold text-[#46554c]">Type</span>
                    <select value={form.type} onChange={set("type")} className="w-full rounded-xl border border-black/10 bg-[#faf8f3] px-3 py-2 text-sm text-[#16221b] outline-none focus:border-[var(--gold)]">
                      <option value="">Select a type…</option>
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <Field label="Speed" k="speed" placeholder="1–14" half />
                  <Field label="Glide" k="glide" placeholder="1–7" half />
                  <Field label="Turn" k="turn" placeholder="-5–1" half />
                  <Field label="Fade" k="fade" placeholder="0–5" half />
                </div>
                {error && <p className="mt-3 text-sm font-medium text-[#d9473f]">{error}</p>}
                <button type="submit" disabled={status === "sending"} className="mt-5 w-full rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-60">
                  {status === "sending" ? "Sending…" : "Submit disc"}
                </button>
                <p className="mt-2.5 text-center text-[11px] text-[#a3aca4]">Only the name is required — fill in what you know.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
