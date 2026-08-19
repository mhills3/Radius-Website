import RewardClaimForm from "@/components/RewardClaimForm";

export const metadata = {
  title: "Claim Your Architect Reward",
  description: "You mapped 50 approved courses. Pick your tournament bag and tell us where to send it.",
  alternates: { canonical: "https://radiusdiscgolf.com/rewards/claim/architect" },
  robots: { index: false, follow: false },
};

export default function ClaimArchitectPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <div className="mx-auto max-w-xl px-6 pt-28 pb-24 md:pt-32">
        <div className="text-center">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
            Architect &middot; 50 Courses
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-[3rem]">
            Pick your bag.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-[var(--text-body)]">
            Fifty approved courses earns a premium tournament bag &mdash; your pick, up to $200. Tell us which one and where to send it.
          </p>
        </div>

        <RewardClaimForm />

        <p className="mt-8 text-center text-sm text-[var(--sage-dim)]">
          Questions? Email{" "}
          <a href="mailto:info@radiusdiscgolf.com" className="font-bold text-[var(--gold)] hover:underline">
            info@radiusdiscgolf.com
          </a>
        </p>
      </div>
    </div>
  );
}
