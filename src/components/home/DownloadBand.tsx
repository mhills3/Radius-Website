import Image from "next/image";

const APP_STORE = "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";

export default function DownloadBand() {
  return (
    <section id="download" className="relative overflow-hidden bg-[var(--bg-deep)]">
      <svg className="pointer-events-none absolute right-0 top-1/2 h-[560px] w-[560px] -translate-y-1/2 translate-x-1/4 opacity-40" viewBox="0 0 560 560" fill="none" aria-hidden="true">
        {[110, 190, 270].map((r) => (
          <circle key={r} cx="280" cy="280" r={r} stroke="rgba(246,193,101,0.12)" strokeWidth="1" />
        ))}
      </svg>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              Take Radius with you
            </div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-[var(--cream)] md:text-[2.6rem]">
              Your whole game, on the course.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-[var(--text-body)]">
              Track rounds, follow the caddy, and check your stats from the tee
              pad. Download free on iOS and Android.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={APP_STORE} target="_blank" rel="noopener" className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--cream)] transition-colors hover:border-white/40">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.13ZM14.6 4.59c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45Z" /></svg>
                <span>
                  <span className="block text-[10px] font-normal leading-none text-[var(--sage)]">Download on the</span>
                  App Store
                </span>
              </a>
              <a href={GOOGLE_PLAY} target="_blank" rel="noopener" className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--cream)] transition-colors hover:border-white/40">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.6 2.4 13 12 3.6 21.6c-.3-.2-.5-.6-.5-1V3.4c0-.4.2-.8.5-1ZM14.2 13.2l2.6 2.6-9.7 5.5 7.1-8.1ZM17.9 9.4l2.7 1.5c.6.4.6 1.3 0 1.7l-2.8 1.6-2.8-2.8 2.9-2ZM7.1 2.4l9.7 5.5-2.6 2.6L7.1 2.4Z" /></svg>
                <span>
                  <span className="block text-[10px] font-normal leading-none text-[var(--sage)]">Get it on</span>
                  Google Play
                </span>
              </a>
            </div>
          </div>

          {/* QR card */}
          <div className="flex items-center gap-5 justify-self-start rounded-3xl border border-white/10 bg-white p-5 lg:justify-self-end">
            <div className="rounded-2xl bg-white p-1">
              <Image src="/qr/get-app.svg" alt="Scan to download Radius" width={132} height={132} className="h-32 w-32" />
            </div>
            <div className="max-w-[9rem]">
              <div className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight text-[#16221b]">
                Scan to download
              </div>
              <p className="mt-1 text-sm text-[#6b7a70]">
                Point your camera here to get the app.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
