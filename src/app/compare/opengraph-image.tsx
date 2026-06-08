import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Bag Battle — compare two disc golf bags on Radius";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #2a2347, #0f1813 76%)", color: "#F5EDE1", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 30, fontWeight: 800 }}>Radius</div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#F6C165", textTransform: "uppercase", letterSpacing: 4 }}>Bag Battle</div>
          <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 22 }}>
            <div style={{ width: 150, height: 150, borderRadius: 9999, background: "#243528", border: "8px solid #F6C165", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, fontWeight: 800, color: "#F6C165" }}>A</div>
            <div style={{ fontSize: 52, fontWeight: 800, color: "rgba(245,237,225,0.7)" }}>VS</div>
            <div style={{ width: 150, height: 150, borderRadius: 9999, background: "#243528", border: "8px solid #4d94fa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, fontWeight: 800, color: "#4d94fa" }}>B</div>
          </div>
          <div style={{ fontSize: 60, fontWeight: 800, marginTop: 28, letterSpacing: -2 }}>Compare any two bags</div>
          <div style={{ fontSize: 30, color: "rgba(245,237,225,0.82)", marginTop: 12 }}>Flight coverage, shared discs & gaps — head-to-head</div>
        </div>

        <div style={{ fontSize: 24, color: "rgba(245,237,225,0.55)", textAlign: "center" }}>radiusdiscgolf.com</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
