import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Radius — the home of disc golf";

// This image has no dynamic params, so Next prerenders it to a static PNG at build time —
// reading the co-located assets from the repo via a cwd-relative path is reliable there.
const dir = join(process.cwd(), "src/app");
const heroBuf = readFileSync(join(dir, "og-hero.jpg"));
const logoBuf = readFileSync(join(dir, "og-logo.svg"));
const sora600 = readFileSync(join(dir, "sora-600.woff"));
const sora700 = readFileSync(join(dir, "sora-700.woff"));
const sora800 = readFileSync(join(dir, "sora-800.woff"));

export default function Image() {
  const hero = `data:image/jpeg;base64,${heroBuf.toString("base64")}`;
  const logo = `data:image/svg+xml;base64,${logoBuf.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", fontFamily: "Sora" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", objectPosition: "center 35%" }} alt="" />
        {/* legibility scrim — soft forest fade anchored on the left, fully clear by ~halfway so the thrower stays bright */}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, rgba(13,20,16,0.97) 0%, rgba(13,20,16,0.82) 22%, rgba(13,20,16,0.45) 40%, rgba(13,20,16,0) 56%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(0deg, rgba(13,20,16,0.88) 0%, rgba(13,20,16,0) 42%)" }} />

        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#F5EDE1" }}>
          {/* top bar: wordmark + domain */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} height={50} width={178} alt="Radius" />
            <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: "rgba(245,237,225,0.6)" }}>radiusdiscgolf.com</div>
          </div>

          {/* headline block */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#F6C165", textTransform: "uppercase", letterSpacing: 7 }}>The home of disc golf</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
              <div style={{ display: "flex", fontSize: 86, fontWeight: 800, letterSpacing: -3, lineHeight: 1.0 }}>Play Smarter,</div>
              <div style={{ display: "flex", fontSize: 86, fontWeight: 800, letterSpacing: -3, lineHeight: 1.0 }}>Not Harder.</div>
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "rgba(245,237,225,0.85)", marginTop: 24 }}>Courses · Stats · Your bag · The community — everywhere you play.</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Sora", data: sora600, weight: 600, style: "normal" },
        { name: "Sora", data: sora700, weight: 700, style: "normal" },
        { name: "Sora", data: sora800, weight: 800, style: "normal" },
      ],
    }
  );
}
