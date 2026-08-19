type Tier = "craftsman" | "architect";

const FIELD =
  "w-full rounded-xl border border-[rgba(244,241,232,0.14)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none transition-colors focus:border-[var(--gold)]";
const LABEL = "mb-1.5 block text-sm font-semibold text-[var(--cream)]";

export default function RewardClaimForm({ tier }: { tier: Tier }) {
  const isArchitect = tier === "architect";
  const reward = isArchitect ? "Premium Tournament Bag" : "Radius Gear Bundle";

  return (
    <form
      action="https://formsubmit.co/info@radiusdiscgolf.com"
      method="POST"
      className="mt-10 space-y-4"
    >
      <input type="hidden" name="_subject" value={`Reward Claim — ${reward} (${isArchitect ? "50" : "25"} courses)`} />
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_next" value="https://radiusdiscgolf.com/rewards/claimed" />
      <input type="hidden" name="Tier" value={isArchitect ? "Architect — 50 courses" : "Craftsman — 25 courses"} />
      <input type="hidden" name="Reward" value={reward} />

      <div>
        <label className={LABEL}>Full name</label>
        <input name="Full name" placeholder="First and last name" required className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>Email</label>
        <input type="email" name="Email" placeholder="you@example.com" required className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>
          Radius username <span className="font-normal text-[var(--sage-dim)]">(optional)</span>
        </label>
        <input name="Radius username" placeholder="So we can match this to your builder account" className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>Street address</label>
        <input name="Street address" placeholder="123 Fairway Drive" required className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>
          Apartment, suite, etc. <span className="font-normal text-[var(--sage-dim)]">(optional)</span>
        </label>
        <input name="Address line 2" placeholder="Apt 4B" className={FIELD} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>City</label>
          <input name="City" placeholder="City" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>State / region</label>
          <input name="State or region" placeholder="State, province or region" required className={FIELD} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Postcode</label>
          <input name="Postcode" placeholder="ZIP or postal code" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Country</label>
          <input name="Country" placeholder="Country" required className={FIELD} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Phone number</label>
        <input type="tel" name="Phone" placeholder="+1 555 123 4567" required className={FIELD} />
        <p className="mt-1.5 text-xs text-[var(--sage-dim)]">
          Couriers require a phone number to deliver, especially on international shipments.
        </p>
      </div>

      {isArchitect ? (
        <>
          <div>
            <label className={LABEL}>Which bag would you like?</label>
            <input name="Bag choice" placeholder="Brand and model — e.g. Squatch Gen 4" required className={FIELD} />
            <p className="mt-1.5 text-xs text-[var(--sage-dim)]">Your pick, up to $200.</p>
          </div>
          <div>
            <label className={LABEL}>
              Link to the bag <span className="font-normal text-[var(--sage-dim)]">(optional)</span>
            </label>
            <input name="Bag link" placeholder="Paste a product link so we order the right one" className={FIELD} />
          </div>
        </>
      ) : (
        <div>
          <label className={LABEL}>Apparel size</label>
          <select name="Apparel size" required defaultValue="" className={FIELD}>
            <option value="" disabled>
              Select a size
            </option>
            <option>XS</option>
            <option>S</option>
            <option>M</option>
            <option>L</option>
            <option>XL</option>
            <option>2XL</option>
            <option>3XL</option>
          </select>
        </div>
      )}

      <div>
        <label className={LABEL}>
          Anything else we should know? <span className="font-normal text-[var(--sage-dim)]">(optional)</span>
        </label>
        <textarea name="Notes" rows={3} placeholder="Delivery notes, preferred colour, anything at all" className={FIELD} />
      </div>

      <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/[0.08] px-4 py-3.5">
        <p className="text-sm font-semibold text-[var(--cream)]">Ships quarterly.</p>
        <p className="mt-0.5 text-sm text-[var(--sage)]">
          Submit this and you&apos;re on the next shipment.
        </p>
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-[var(--gold)] px-6 py-4 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]"
      >
        {isArchitect ? "Claim my bag" : "Claim my gear"}
      </button>
    </form>
  );
}
