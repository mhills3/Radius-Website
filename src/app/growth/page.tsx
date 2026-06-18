import type { Metadata } from "next";
import Link from "next/link";
import { getGrowthData } from "@/lib/growth";
import GrowthChart from "@/components/growth/GrowthChart";

// Hidden internal page — reachable only via the footer logo. Keep it out of search + nav.
export const metadata: Metadata = {
  title: "Radius Growth",
  robots: { index: false, follow: false },
};

export default async function GrowthPage() {
  const data = await getGrowthData();
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <div className="mx-auto max-w-5xl px-6 pt-24 pb-20">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Internal · Radius pulse</div>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Growth</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--text-body)]">Courses built and players joined over time. Computed live from the database and refreshed hourly.</p>

        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-7">
          <GrowthChart data={data} />
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs font-semibold text-[var(--sage-dim)] transition-colors hover:text-[var(--cream)]">← Back to Radius</Link>
        </div>
      </div>
    </div>
  );
}
