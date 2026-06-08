import Image from "next/image";

/** Premium device frame with a notch — used across marketing pages. */
export function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative shrink-0 rounded-[2.6rem] border border-white/12 bg-[#0d140f] p-2.5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)] ${className}`}>
      <div className="relative aspect-[1170/2532] overflow-hidden rounded-[2.05rem] bg-black">{children}</div>
      <div className="pointer-events-none absolute left-1/2 top-[14px] z-10 h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-[#0d140f]" />
    </div>
  );
}

export function ScreenPhone({ src, alt, className = "", priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <PhoneFrame className={className}>
      <Image src={src} alt={alt} fill sizes="340px" quality={90} className="object-cover" priority={priority} />
    </PhoneFrame>
  );
}
