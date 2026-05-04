import Link from "next/link";
import Image from "next/image";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[var(--bg-deep)]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-lettermark.svg"
            alt="Radius"
            width={120}
            height={28}
            className="h-7 w-auto"
            priority
          />
        </Link>
        <div className="flex items-center gap-8">
          <Link
            href="/courses"
            className="text-sm font-medium text-[var(--sage)] transition-colors hover:text-[var(--gold)]"
          >
            Courses
          </Link>
          <a
            href="https://apps.apple.com/us/app/radius-disc-golf/id6760574186"
            target="_blank"
            rel="noopener"
            className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-xs font-bold tracking-wide text-[var(--bg-deep)] transition-all hover:bg-[var(--gold-bright)] hover:-translate-y-0.5"
          >
            Download
          </a>
        </div>
      </div>
    </nav>
  );
}
