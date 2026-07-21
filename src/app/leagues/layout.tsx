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
    <div className="relative min-h-screen overflow-x-clip bg-[var(--bg-deep)] text-[var(--cream)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 600px at -5% -5%, rgba(246,193,101,0.09), transparent 62%)," +
            "radial-gradient(700px 500px at 105% 108%, rgba(95,207,128,0.05), transparent 60%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
