// Receives user-reported "missing disc" submissions from the disc database page and appends
// them to the "Radius User-reported Missing Discs" Google Sheet via a Google Apps Script web
// app (URL kept in MISSING_DISC_WEBHOOK_URL). Server-side so there's no CORS issue and the
// webhook URL stays out of the client bundle.
export const runtime = "nodejs";

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  // honeypot — bots fill hidden fields; humans never do
  if (clip(body.website, 1)) return Response.json({ ok: true });

  const name = clip(body.name, 80);
  if (!name) return Response.json({ ok: false, error: "Disc name is required." }, { status: 400 });

  const row = {
    name,
    type: clip(body.type, 40),
    speed: clip(body.speed, 10),
    glide: clip(body.glide, 10),
    turn: clip(body.turn, 10),
    fade: clip(body.fade, 10),
    manufacturer: clip(body.manufacturer, 60),
  };

  const url = process.env.MISSING_DISC_WEBHOOK_URL;
  if (!url) {
    console.error("MISSING_DISC_WEBHOOK_URL is not set — disc report dropped:", row);
    return Response.json({ ok: false, error: "Reporting isn’t set up yet." }, { status: 503 });
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`webhook ${r.status}`);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("disc report webhook failed:", e);
    return Response.json({ ok: false, error: "Couldn’t save right now — please try again." }, { status: 502 });
  }
}
