export default function LegalLayout({
  title,
  updated,
  html,
}: {
  title: string;
  updated: string;
  html: string;
}) {
  return (
    <div className="bg-[#faf8f3] text-[#16221b]">
      <section className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            maskImage: "url(/topo.png)",
            WebkitMaskImage: "url(/topo.png)",
            maskSize: "cover",
            WebkitMaskSize: "cover",
            backgroundColor: "var(--cream)",
            opacity: 0.1,
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-12 pt-28 md:pt-32">
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-[var(--text-body)]">{updated}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div
          className="prose prose-neutral max-w-none prose-headings:font-[family-name:var(--font-heading)] prose-headings:tracking-[-0.02em] prose-h2:mb-3 prose-h2:mt-10 prose-h2:text-2xl prose-p:leading-relaxed prose-p:text-[#2c3a32] prose-li:text-[#2c3a32] prose-a:font-semibold prose-a:text-[#9a7a3a] prose-strong:text-[#16221b]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
