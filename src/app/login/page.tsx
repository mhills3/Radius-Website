"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type Mode = "signin" | "signup" | "forgot";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email or password doesn't match. Try again or reset your password.";
    case "auth/email-already-in-use":
      return "An account with that email already exists. Try signing in.";
    case "auth/weak-password":
      return "Please choose a password with at least 6 characters.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Already signed in → go to dashboard.
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        router.replace("/dashboard");
      } else if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
        router.replace("/dashboard");
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice("Password reset email sent — check your inbox.");
      }
    } catch (err) {
      setError(friendlyError((err as { code?: string })?.code ?? ""));
    } finally {
      setBusy(false);
    }
  };

  const copy = {
    signin: { title: "Welcome back", sub: "Sign in to pick up your game where you left off.", cta: "Sign in" },
    signup: { title: "Create your account", sub: "Join the home of disc golf — free.", cta: "Create account" },
    forgot: { title: "Reset your password", sub: "We'll email you a link to set a new password.", cta: "Send reset link" },
  }[mode];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---- Brand panel ---- */}
      <div className="relative hidden overflow-hidden bg-[var(--bg-mid)] p-14 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            maskImage: "url(/topo.png)",
            WebkitMaskImage: "url(/topo.png)",
            maskSize: "cover",
            WebkitMaskSize: "cover",
            maskPosition: "center",
            WebkitMaskPosition: "center",
            backgroundColor: "var(--cream)",
            opacity: 0.1,
          }}
          aria-hidden="true"
        />
        <div className="relative z-10">
          <Link href="/" className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--cream)]">Radius</Link>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-tight tracking-[-0.03em] text-[var(--cream)]">
            Your whole game,
            <br />
            everywhere you play.
          </h2>
          <ul className="mt-8 space-y-4 text-sm text-[var(--text-body)]">
            {["One account across iOS, Android, and the web", "Every round, stat, and disc — synced automatically", "Connect with the disc golf community"].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gold-dim)] text-[var(--gold)]">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-xs uppercase tracking-[0.14em] text-[var(--sage-dim)]">Play Smarter, Not Harder.</div>
      </div>

      {/* ---- Form panel ---- */}
      <div className="flex items-center justify-center bg-[#faf8f3] px-6 py-16 text-[#16221b]">
        {/* Mobile: sign-in is desktop-only — show a friendly notice + app links instead of the form */}
        <div className="w-full max-w-sm text-center md:hidden">
          <Link href="/" className="mb-8 block font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[#16221b]">Radius</Link>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.02em]">Sign in on desktop</h1>
          <p className="mt-3 text-sm text-[#46554c]">Account sign-in is available on the desktop site for now. On the go, get the full Radius experience in the app.</p>
          <div className="mt-7 flex flex-col gap-3">
            <a href="https://apps.apple.com/us/app/radius-disc-golf/id6760574186" target="_blank" rel="noopener" className="rounded-full border border-black/15 px-5 py-3 text-sm font-bold text-[#16221b] transition-colors hover:border-black/40">Download on the App Store</a>
            <a href="https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid" target="_blank" rel="noopener" className="rounded-full border border-black/15 px-5 py-3 text-sm font-bold text-[#16221b] transition-colors hover:border-black/40">Get it on Google Play</a>
            <Link href="/" className="mt-1 text-sm font-bold text-[#9a7a3a] hover:underline">← Back to home</Link>
          </div>
        </div>
        <div className="hidden w-full max-w-sm md:block">
          <Link href="/" className="mb-8 block font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[#16221b] lg:hidden">Radius</Link>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.02em]">{copy.title}</h1>
          <p className="mt-2 text-sm text-[#46554c]">{copy.sub}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <Field label="Name" type="text" placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <Field label="Email" type="email" placeholder="you@example.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {mode !== "forgot" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-semibold text-[#16221b]">Password</label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }} className="text-xs font-semibold text-[#9a7a3a] hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  placeholder={mode === "signup" ? "Create a password" : "••••••••"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#16221b] placeholder-[#8a968d] outline-none transition-colors focus:border-[var(--gold)]"
                />
              </div>
            )}

            {error && <p className="rounded-lg bg-[#fdeaea] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}
            {notice && <p className="rounded-lg bg-[#eaf6ee] px-3 py-2 text-sm text-[#15803d]">{notice}</p>}

            <button type="submit" disabled={busy} className="w-full rounded-full bg-[var(--gold)] px-6 py-3.5 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Please wait…" : copy.cta}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#46554c]">
            {mode === "signin" && (
              <>New to Radius?{" "}
                <button onClick={() => { setMode("signup"); setError(""); setNotice(""); }} className="font-bold text-[#9a7a3a] hover:underline">Sign up</button>
              </>
            )}
            {mode === "signup" && (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("signin"); setError(""); setNotice(""); }} className="font-bold text-[#9a7a3a] hover:underline">Sign in</button>
              </>
            )}
            {mode === "forgot" && (
              <button onClick={() => { setMode("signin"); setError(""); setNotice(""); }} className="font-bold text-[#9a7a3a] hover:underline">← Back to sign in</button>
            )}
          </div>

          <p className="mt-10 text-center text-xs text-[#8a968d]">
            By continuing you agree to our{" "}
            <a href="/terms" className="underline hover:text-[#46554c]">Terms</a> and{" "}
            <a href="/privacy" className="underline hover:text-[#46554c]">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">{label}</label>
      <input
        {...props}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#16221b] placeholder-[#8a968d] outline-none transition-colors focus:border-[var(--gold)]"
      />
    </div>
  );
}
