"use client";

import { useState } from "react";

const field =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#16221b] placeholder-[#8a968d] outline-none transition-colors focus:border-[var(--gold)]";

// Submits through FormSubmit's AJAX endpoint (kept on FormSubmit per project convention) so the
// page never navigates — the old `_next` redirect pointed at /contact.html, which 404s in the Next
// app and made senders think the message failed even though it went through.
export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("sending");
    try {
      const res = await fetch("https://formsubmit.co/ajax/info@radiusdiscgolf.com", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json && (json.success === "true" || json.success === true)) {
        form.reset();
        setStatus("sent");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-10 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--gold)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="#16221b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#16221b]">Message sent!</h2>
        <p className="mx-auto mt-2 max-w-sm text-[#46554c]">Thanks for reaching out — we&apos;ve got it and will reply to the email you provided.</p>
        <button onClick={() => setStatus("idle")} className="mt-5 text-sm font-bold text-[#9a7a3a] hover:underline">Send another message</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-4">
      <input type="hidden" name="_subject" value="New Contact Message — Radius" />
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="_template" value="table" />

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">Name</label>
        <input name="name" placeholder="Your name" required className={field} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">Email</label>
        <input type="email" name="email" placeholder="you@example.com" required className={field} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">Message</label>
        <textarea name="message" rows={5} placeholder="What's on your mind?" required className={field} />
      </div>

      {status === "error" && (
        <p className="rounded-xl bg-[#c0392b]/10 px-4 py-3 text-sm font-medium text-[#a5352a]">
          Something went wrong sending that. Please email us directly at{" "}
          <a href="mailto:info@radiusdiscgolf.com" className="font-bold underline">info@radiusdiscgolf.com</a>.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-full bg-[var(--gold)] px-6 py-4 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
