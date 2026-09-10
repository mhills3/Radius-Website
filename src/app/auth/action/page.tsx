"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Branded landing page for every Firebase Auth email link. The Password reset / Email verification /
 * Email change templates in the Firebase console point their Action URL at
 * https://radiusdiscgolf.com/auth/action, and Firebase appends ?mode=…&oobCode=… — so the link a
 * player sees in their inbox is ours, not radius-dg.firebaseapp.com/__/auth/action.
 *
 * Modes handled: resetPassword (verify code → new-password form → confirm), verifyEmail and
 * recoverEmail (apply the code, show the result). Anything else, or a bad/expired code, gets a
 * friendly dead-end with a way to start over.
 */

const HEAD = "font-[family-name:var(--font-heading)]";
const APP_STORE = "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";

function friendly(code: string): string {
  switch (code) {
    case "auth/expired-action-code": return "This link has expired. Request a new one and try again.";
    case "auth/invalid-action-code": return "This link has already been used or isn't valid. Request a new one and try again.";
    case "auth/user-disabled": return "This account has been disabled. Write to info@radiusdiscgolf.com and we'll sort it out.";
    case "auth/user-not-found": return "We couldn't find an account for this link. Request a new one and try again.";
    case "auth/weak-password": return "Please choose a password with at least 6 characters.";
    default: return "Something went wrong. Request a new link and try again.";
  }
}

type Phase = "checking" | "form" | "working" | "done" | "error";

function ActionInner() {
  const params = useSearchParams();
  const mode = params.get("mode") || "";
  const oobCode = params.get("oobCode") || "";

  const MISSING = "This link is missing its code. Open it straight from the email, or request a new one.";
  const [phase, setPhase] = useState<Phase>(() => (oobCode ? "checking" : "error"));
  const [email, setEmail] = useState("");
  const [error, setError] = useState(() => (oobCode ? "" : MISSING));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!oobCode) return; // already in the error phase from initial state
    let alive = true;
    (async () => {
      try {
        if (mode === "resetPassword") {
          const e = await verifyPasswordResetCode(auth, oobCode);
          if (!alive) return;
          setEmail(e); setPhase("form");
        } else if (mode === "verifyEmail" || mode === "recoverEmail") {
          await applyActionCode(auth, oobCode);
          if (!alive) return;
          setPhase("done");
        } else {
          setError("We don't recognise this link. Request a new one and try again."); setPhase("error");
        }
      } catch (err) {
        if (!alive) return;
        setError(friendly((err as { code?: string })?.code ?? "")); setPhase("error");
      }
    })();
    return () => { alive = false; };
  }, [mode, oobCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Please choose a password with at least 6 characters."); return; }
    if (password !== confirm) { setError("Those passwords don't match."); return; }
    setError(""); setPhase("working");
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setPhase("done");
    } catch (err) {
      setError(friendly((err as { code?: string })?.code ?? "")); setPhase("form");
    }
  };

  const copy = (() => {
    if (phase === "error") return { eyebrow: "Hmm", title: "That link didn't work." };
    if (mode === "verifyEmail") return { eyebrow: "Email verified", title: phase === "done" ? "You're all set." : "Verifying…" };
    if (mode === "recoverEmail") return { eyebrow: "Email restored", title: phase === "done" ? "Your email is back to normal." : "Restoring…" };
    if (phase === "done") return { eyebrow: "Password updated", title: "You're back in." };
    return { eyebrow: "Password reset", title: "Choose a new password." };
  })();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-white/[0.07] bg-[var(--bg-mid)] p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-10">
        <div className={`${HEAD} text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--gold)]`}>{copy.eyebrow}</div>
        <h1 className={`${HEAD} mt-3 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--cream)]`}>{copy.title}</h1>

        {phase === "checking" && (
          <div className="mt-8 flex items-center gap-3 text-[14px] text-[var(--sage)]">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Checking your link…
          </div>
        )}

        {(phase === "form" || phase === "working") && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <p className="text-[14.5px] leading-relaxed text-[var(--text-body)]">For <span className="font-semibold text-[var(--cream)]">{email}</span>. Use it in the app and on the website.</p>
            <Field label="New password" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <Field label="Confirm password" type="password" autoComplete="new-password" placeholder="Same again" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && <p className="rounded-xl bg-[#ef7f7f]/10 px-3.5 py-2.5 text-[13.5px] font-semibold text-[#ef7f7f]">{error}</p>}
            <button type="submit" disabled={phase === "working"} className={`${HEAD} w-full rounded-full bg-[var(--gold)] px-6 py-3.5 text-[15px] font-extrabold text-[#141B16] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-60`}>
              {phase === "working" ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}

        {phase === "done" && (
          <div className="mt-6 space-y-5">
            <p className="text-[14.5px] leading-relaxed text-[var(--text-body)]">
              {mode === "resetPassword" ? "Your new password works everywhere — the app and the website. If the app asks you to sign in again, use the new one." : mode === "recoverEmail" ? "The change to your sign-in email has been undone. If you didn't make that change, reset your password now to be safe." : "Thanks for confirming your email."}
            </p>
            <Link href="/login" className={`${HEAD} block w-full rounded-full bg-[var(--gold)] px-6 py-3.5 text-center text-[15px] font-extrabold text-[#141B16] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]`}>Sign in on the website</Link>
            <div className="flex gap-2.5">
              <a href={APP_STORE} className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-center text-[13px] font-bold text-[var(--cream)] transition-colors hover:border-[var(--gold)]/60">Open in iOS app</a>
              <a href={PLAY_STORE} className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-center text-[13px] font-bold text-[var(--cream)] transition-colors hover:border-[var(--gold)]/60">Open in Android app</a>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-6 space-y-5">
            <p className="text-[14.5px] leading-relaxed text-[var(--text-body)]">{error}</p>
            <Link href="/login" className={`${HEAD} block w-full rounded-full bg-[var(--gold)] px-6 py-3.5 text-center text-[15px] font-extrabold text-[#141B16] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]`}>Request a new link</Link>
            <p className="text-center text-[12.5px] text-[var(--sage-dim)]">Stuck? Email <a href="mailto:info@radiusdiscgolf.com" className="underline hover:text-[var(--cream)]">info@radiusdiscgolf.com</a></p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-[var(--cream)]">{label}</label>
      <input {...props} required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none transition-colors focus:border-[var(--gold)]/60" />
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <Suspense fallback={null}>
        <ActionInner />
      </Suspense>
    </div>
  );
}
