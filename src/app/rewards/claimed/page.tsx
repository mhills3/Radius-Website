import Link from "next/link";

export const metadata = {
  title: "Reward Claimed",
  description: "Your Radius reward claim is in.",
  alternates: { canonical: "https://radiusdiscgolf.com/rewards/claimed" },
  robots: { index: false, follow: false },
};

export default function RewardClaimedPage() {
  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <div className="mx-auto max-w-xl px-6 pt-28 pb-24 md:pt-32">
        <div className="text-center">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">
            Course Builder Rewards
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-[3rem]">
            You&apos;re on the list.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-[#46554c]">
            We&rsquo;ve got your details. Merch ships quarterly, and you&rsquo;re on the next shipment &mdash; we&rsquo;ll email you when it goes out.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/rewards"
            className="rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]"
          >
            Back to rewards
          </Link>
          <p className="text-sm text-[#6b7a70]">
            Something wrong?{" "}
            <a href="mailto:info@radiusdiscgolf.com" className="font-bold text-[#9a7a3a] hover:underline">
              info@radiusdiscgolf.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
