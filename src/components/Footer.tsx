import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[var(--bg-deep)] px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3 font-semibold text-[var(--cream)]">
          <Image
            src="/logo.svg"
            alt="Radius"
            width={32}
            height={32}
            className="rounded-md"
          />
          <span>Radius Disc Golf</span>
        </div>
        <div className="flex flex-wrap gap-6">
          <Link
            href="/courses"
            className="text-sm text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]"
          >
            Courses
          </Link>
          <a
            href="https://radiusdiscgolf.com/story.html"
            className="text-sm text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]"
          >
            Our Story
          </a>
          <a
            href="https://radiusdiscgolf.com/privacy.html"
            className="text-sm text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]"
          >
            Privacy
          </a>
          <a
            href="https://radiusdiscgolf.com/terms.html"
            className="text-sm text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]"
          >
            Terms
          </a>
          <a
            href="https://radiusdiscgolf.com/contact.html"
            className="text-sm text-[var(--sage-dim)] transition-colors hover:text-[var(--gold)]"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
