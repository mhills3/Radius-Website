import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leagues",
  description: "Weekly disc golf leagues run on Radius — free for directors and players.",
  alternates: { canonical: "/leagues" },
};

// All league surfaces live in the dark app world (like /community), not the light
// marketing chrome — without this shell the dark-token components wash out.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">{children}</div>;
}
