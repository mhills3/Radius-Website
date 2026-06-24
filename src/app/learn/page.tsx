import LearnVideos from "@/components/learn/LearnVideos";

export const metadata = {
  title: "Learn",
  description: "Short walkthroughs that show you how each part of Radius works.",
  alternates: { canonical: "/learn" },
};

export default function LearnPage() {
  return (
    <div className="bg-[#faf8f3] text-[#16221b]">
      {/* hero */}
      <section className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.14),transparent_62%)]" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-28 text-center md:pt-32">
          <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Learn Radius</div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.04] tracking-[-0.03em] md:text-[3.25rem]">
            Getting started with Radius.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-body)]">
            Short walkthroughs that show you how each part of Radius works — so you can spend less
            time figuring it out and more time playing.
          </p>
        </div>
      </section>

      {/* tutorials grid */}
      <section className="bg-[#faf8f3]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <LearnVideos />
        </div>
      </section>
    </div>
  );
}
