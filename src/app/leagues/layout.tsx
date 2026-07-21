import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events",
  description: "Disc golf leagues, tournaments, and events run on Radius — free for directors and players.",
  alternates: { canonical: "/leagues" },
};

// All event surfaces live in the dark app world under the .events-scope token
// system: flat forest base, Sora + JetBrains Mono only, two-accent law.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="events-scope relative min-h-screen overflow-x-clip bg-[var(--forest)] text-[var(--cream)]">
      {children}
    </div>
  );
}
