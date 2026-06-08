import HeroImmersive from "@/components/heroes/HeroImmersive";
import HeroSplit from "@/components/heroes/HeroSplit";
import HeroDirectory from "@/components/heroes/HeroDirectory";

export const metadata = {
  title: "Hero lab",
  robots: { index: false },
};

function Label({ tag, name, note }: { tag: string; name: string; note: string }) {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-16 pb-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-white/10 pb-3">
        <span className="rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-bold text-[var(--bg-deep)]">
          {tag}
        </span>
        <span className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">
          {name}
        </span>
        <span className="text-sm text-[var(--sage-dim)]">{note}</span>
      </div>
    </div>
  );
}

export default function HeroLab() {
  return (
    <div>
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Hero options — pick the bones, then we refine
        </h1>
        <p className="mt-2 text-sm text-[var(--text-body)]">
          Three real directions, same brand DNA. Tell me which archetype feels
          right (A / B / C) and what to pull from the others.
        </p>
      </div>

      <Label tag="Option A" name="Immersive" note="Real motion behind a centered search — UDisc-style depth." />
      <HeroImmersive />

      <Label tag="Option B" name="Editorial split" note="Message + search left, a live data panel right — reads like a tool." />
      <HeroSplit />

      <Label tag="Option C" name="Directory-forward" note="Slim hero that blends into a live course grid — pure utility." />
      <HeroDirectory />
    </div>
  );
}
