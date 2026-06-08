import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Disc golfer profile on Radius";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #1a2820, #0f1813 78%)", color: "#F5EDE1", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 30, fontWeight: 800 }}>Radius</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#F6C165", textTransform: "uppercase", letterSpacing: 2 }}>Disc Golfer</div>
          <div style={{ fontSize: 90, fontWeight: 800, marginTop: 10 }}>{`@${username}`}</div>
          <div style={{ fontSize: 30, color: "rgba(245,237,225,0.82)", marginTop: 14 }}>Game IQ, rounds, ranks & achievements on Radius</div>
        </div>
        <div style={{ fontSize: 24, color: "rgba(245,237,225,0.55)" }}>radiusdiscgolf.com</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
