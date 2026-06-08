import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Disc golf course on Radius";

function title(slug: string) {
  const p = slug.split("-");
  if (p.length > 1 && /\d/.test(p[p.length - 1])) p.pop();
  return p.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ") || "Course";
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #1f3326, #0f1813 75%)", color: "#F5EDE1", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 30, fontWeight: 800 }}>Radius</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#F6C165", textTransform: "uppercase", letterSpacing: 2 }}>Disc Golf Course</div>
          <div style={{ fontSize: 88, fontWeight: 800, marginTop: 10 }}>{title(slug)}</div>
          <div style={{ fontSize: 30, color: "rgba(245,237,225,0.82)", marginTop: 14 }}>Layout, leaderboard, scores & community</div>
        </div>
        <div style={{ fontSize: 24, color: "rgba(245,237,225,0.55)" }}>radiusdiscgolf.com</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
