"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const COLUMNS: { heading: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    heading: "Explore",
    links: [
      { label: "Courses", href: "/courses" },
      { label: "Discs", href: "/discs" },
      { label: "Events", href: "/leagues" },
      { label: "Community", href: "/community" },
      { label: "Stories", href: "/stories" },
      { label: "Learn", href: "/learn" },
    ],
  },
  {
    heading: "Radius",
    links: [
      { label: "Features", href: "/features" },
      { label: "Subscription", href: "/subscription" },
      { label: "Our Story", href: "/story" },
      { label: "Creators", href: "/creators" },
      { label: "Rewards", href: "/rewards" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

const SOCIALS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Discord",
    href: "https://discord.gg/K396RywHx",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.25.5a18.3 18.3 0 0 1 4.3 1.4 16.6 16.6 0 0 0-14.9 0A18.3 18.3 0 0 1 8.85 3.5L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9 .1 13.6.35 18.1a19.9 19.9 0 0 0 6.07 3.06l.78-1.36a13 13 0 0 1-2-.96l.49-.36a14.2 14.2 0 0 0 12.6 0l.49.36c-.63.38-1.3.7-2 .96l.78 1.36A19.8 19.8 0 0 0 23.65 18 18.7 18.7 0 0 0 20.3 4.4ZM8.5 15.3c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@radiusdiscgolf",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.5ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <footer className="border-t border-white/5 bg-[var(--bg-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          {/* brand + app */}
          <div>
            {/* Footer logo is the subtle entrance to the internal Growth page. */}
            <Link href="/growth" aria-label="Radius growth">
              <Logo className="h-8 w-[114px] text-[var(--cream)]" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--text-body)]">
              The home of disc golf. Your whole game — courses, stats, and your
              people — in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://apps.apple.com/us/app/radius-disc-golf/id6760574186"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:border-white/40"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.13ZM14.6 4.59c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45Z" /></svg>
                App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:border-white/40"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3.6 2.4 13 12 3.6 21.6c-.3-.2-.5-.6-.5-1V3.4c0-.4.2-.8.5-1ZM14.2 13.2l2.6 2.6-9.7 5.5 7.1-8.1ZM17.9 9.4l2.7 1.5c.6.4.6 1.3 0 1.7l-2.8 1.6-2.8-2.8 2.9-2ZM7.1 2.4l9.7 5.5-2.6 2.6L7.1 2.4Z" /></svg>
                Google&nbsp;Play
              </a>
            </div>
          </div>

          {/* link columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">
                {col.heading}
              </div>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} className="text-sm text-[var(--sage)] transition-colors hover:text-[var(--gold)]">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-sm text-[var(--sage)] transition-colors hover:text-[var(--gold)]">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* bottom bar */}
        <div className="mt-14 flex flex-col gap-6 border-t border-white/5 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--sage-dim)]">
            © 2026 Radius Disc Golf. Play Smarter, Not Harder.
          </p>
          <div className="flex items-center gap-4">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
