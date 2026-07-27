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
    <div
      className="events-scope relative min-h-screen overflow-x-clip text-[var(--cream)]"
      style={{ background: "radial-gradient(820px 620px at 100% 0%, rgba(232,181,96,0.16), transparent 60%), radial-gradient(680px 520px at 0% 100%, rgba(232,181,96,0.10), transparent 60%), #141B16" }}
    >
      {children}
    </div>
  );
}
