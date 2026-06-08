// Monochrome lockup (icon + wordmark) recolored by context via CSS mask + bg-current.
// Pass a text-color class (e.g. text-[var(--cream)]) — the logo takes that color.
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Radius"
      className={`inline-block bg-current ${className}`}
      style={{
        maskImage: "url(/logo-lettermark.svg)",
        WebkitMaskImage: "url(/logo-lettermark.svg)",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskPosition: "left center",
        WebkitMaskPosition: "left center",
      }}
    />
  );
}
