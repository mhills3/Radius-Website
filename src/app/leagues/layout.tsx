import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events",
  description: "Disc golf leagues, tournaments, and events run on Radius — free for directors and players.",
  alternates: { canonical: "/leagues" },
};

// All event surfaces live in the dark app world (like /community), not the light
// marketing chrome — without this shell the dark-token components wash out.
// The corner washes are the premium backdrop: a gold glow anchored top-left and a
// faint forest counter-glow bottom-right, fixed behind everything.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="events-scope relative min-h-screen overflow-x-clip bg-[var(--forest)] text-[var(--cream)]">
      {children}
    </div>
  );
}
