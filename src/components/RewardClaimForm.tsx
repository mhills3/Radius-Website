"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getClaimable, submitFulfillment, TIER_LABEL, type Claimable } from "@/lib/rewards";

const FIELD = "w-full rounded-xl border border-[rgba(244,241,232,0.14)] bg-white/[0.03] px-4 py-3 text-base text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none transition-colors focus:border-[var(--gold)]";
const LABEL = "mb-1.5 block text-sm font-semibold text-[var(--cream)]";
const OPT = <span className="font-normal text-[var(--sage-dim)]">(optional)</span>;
const Spin = () => <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;

type FormState = { fullName: string; email: string; address1: string; address2: string; city: string; region: string; postcode: string; country: string; phone: string; bagRequest: string; bagLink: string; notes: string };
const EMPTY: FormState = { fullName: "", email: "", address1: "", address2: "", city: "", region: "", postcode: "", country: "", phone: "", bagRequest: "", bagLink: "", notes: "" };

export default function RewardClaimForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [claim, setClaim] = useState<Claimable | null | undefined>(undefined);
  const [f, setF] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setClaim(null); return; }
    getClaimable(user.uid).then(setClaim).catch(() => setClaim(null));
  }, [user, loading]);

  // pre-fill the email from the signed-in account — they can correct it if a different one's better.
  useEffect(() => { if (user?.email) setF((s) => (s.email ? s : { ...s, email: user.email! })); }, [user]);

  // ---- gate states ----
  if (loading || claim === undefined) return <div className="mt-16 flex justify-center text-[var(--sage)]"><Spin /></div>;
  if (!user) {
    return (
      <div className="mt-10 rounded-2xl border border-[var(--hair)] bg-[var(--bg-mid)] p-8 text-center">
        <p className="text-[15px] text-[var(--text-body)]">Sign in with your Radius account to claim — we match the reward to you, so there&apos;s nothing to type.</p>
        <Link href="/login" className="mt-5 inline-block rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">Sign in</Link>
      </div>
    );
  }
  if (!claim || claim.tiers.length === 0) {
    const pending = claim?.alreadyPending ?? [];
    return (
      <div className="mt-10 rounded-2xl border border-[var(--hair)] bg-[var(--bg-mid)] p-8 text-center">
        {pending.length > 0 ? (
          <>
            <div className="text-3xl">📦</div>
            <p className="mt-2 text-[16px] font-semibold text-[var(--cream)]">You&apos;re already on the list</p>
            <p className="mt-1 text-[14px] text-[var(--text-body)]">Your {pending.map((t) => TIER_LABEL[t].toLowerCase()).join(" and ")} claim is in and waiting on the next quarterly shipment.</p>
          </>
        ) : (
          <>
            <div className="text-3xl">🏗️</div>
            <p className="mt-2 text-[16px] font-semibold text-[var(--cream)]">Nothing to claim yet</p>
            <p className="mt-1 text-[14px] text-[var(--text-body)]">You&apos;ve built {claim?.courseCount ?? 0} course{(claim?.courseCount ?? 0) === 1 ? "" : "s"}. The gear bundle unlocks at <b className="text-[var(--cream)]">25</b> approved courses, a tournament bag at <b className="text-[var(--cream)]">50</b>. Keep building.</p>
          </>
        )}
        <Link href="/courses/new" className="mt-5 inline-block text-sm font-bold text-[var(--gold)] hover:underline">Build a course →</Link>
      </div>
    );
  }

  const wantsBag = claim.tiers.includes("bag");
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await submitFulfillment(claim, f);
      router.push("/rewards/claimed");
    } catch {
      setErr("Couldn't submit — please try again in a moment."); setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-10 space-y-4">
      {/* what they're claiming — driven by entitlement, not the URL */}
      <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/[0.08] px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--gold)]">Claiming</div>
        <div className="mt-0.5 text-[15px] font-semibold text-[var(--cream)]">{claim.tiers.map((t) => TIER_LABEL[t]).join(" + ")}</div>
      </div>

      <div>
        <label className={LABEL}>Full name</label>
        <input value={f.fullName} onChange={set("fullName")} autoComplete="name" placeholder="First and last name" required className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>Email</label>
        <input value={f.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required className={FIELD} />
        <p className="mt-1.5 text-xs text-[var(--sage-dim)]">So we can reach you about your shipment.</p>
      </div>
      <div>
        <label className={LABEL}>Address line 1</label>
        <input value={f.address1} onChange={set("address1")} autoComplete="address-line1" placeholder="Street address" required className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>Address line 2 {OPT}</label>
        <input value={f.address2} onChange={set("address2")} autoComplete="address-line2" placeholder="Apartment, suite, etc." className={FIELD} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>City</label>
          <input value={f.city} onChange={set("city")} autoComplete="address-level2" placeholder="City" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>State / region</label>
          <input value={f.region} onChange={set("region")} autoComplete="address-level1" placeholder="State, province or region" required className={FIELD} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Postcode</label>
          <input value={f.postcode} onChange={set("postcode")} autoComplete="postal-code" placeholder="ZIP or postal code" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Country</label>
          <input value={f.country} onChange={set("country")} autoComplete="country-name" placeholder="Country" required className={FIELD} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Phone number</label>
        <input value={f.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 555 123 4567" required className={FIELD} />
        <p className="mt-1.5 text-xs text-[var(--sage-dim)]">Couriers require a phone number, especially for international shipments.</p>
      </div>

      {wantsBag && (
        <>
          <div>
            <label className={LABEL}>Which bag do you want?</label>
            <textarea value={f.bagRequest} onChange={set("bagRequest")} rows={3} placeholder="Be specific — brand + model, up to $200." required className={FIELD} />
            <p className="mt-1.5 text-xs text-[var(--sage-dim)]">Paste the exact link below so we order the right one. We order what you link — if it&apos;s vague, that&apos;s on you.</p>
          </div>
          <div>
            <label className={LABEL}>Link to the bag</label>
            <input value={f.bagLink} onChange={set("bagLink")} type="url" inputMode="url" placeholder="https://…" required className={FIELD} />
          </div>
        </>
      )}

      <div>
        <label className={LABEL}>Anything else we should know? {OPT}</label>
        <textarea value={f.notes} onChange={set("notes")} rows={3} placeholder="Delivery notes, preferred colour, anything at all" className={FIELD} />
      </div>

      <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/[0.08] px-4 py-3.5">
        <p className="text-sm font-semibold text-[var(--cream)]">Ships quarterly.</p>
        <p className="mt-0.5 text-sm text-[var(--sage)]">Submit this and you&apos;re added to the next shipment.</p>
      </div>

      {err && <div className="rounded-xl border border-[#e0873f]/40 bg-[#e0873f]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#e0873f]">{err}</div>}

      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-6 py-4 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)] disabled:opacity-60 disabled:hover:translate-y-0">
        {busy ? <><Spin />Submitting…</> : "Submit claim"}
      </button>
    </form>
  );
}
