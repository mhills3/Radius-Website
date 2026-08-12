import { type DecodedRound } from "@/lib/rounds";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoibWlrZXkzIiwiYSI6ImNtb3Fra25hZzB6dnIycHB6ZHMxcjIwNHYifQ.tyyS7i-aoR54_l11rW0Khg";

const real = (t: DecodedRound["holes"][number]["throws"][number]) => t.discName !== "Score" && t.discName !== "Throw";

/** Whether a round has any GPS-tracked shots (detailed mode) — gates the flight map. */
export function roundHasGps(round: DecodedRound): boolean {
  return round.holes.some((h) => h.played && h.throws.some((t) => real(t) && t.lat != null && t.lng != null));
}

/** A Mapbox Static Images URL: a satellite tile with each hole's flight path drawn in gold,
 *  auto-fit to the shots. Returns null when there's no GPS data (or the URL would be too long). */
export function flightMapImageUrl(round: DecodedRound, w: number, h: number): string | null {
  const lines: number[][][] = [];
  for (const hole of round.holes) {
    if (!hole.played) continue;
    const shots = hole.throws.filter(real);
    const coords: number[][] = [];
    for (const t of shots) if (t.lat != null && t.lng != null) coords.push([t.lng, t.lat]);
    const last = shots[shots.length - 1];
    if (last?.madeIt && last.targetLat != null && last.targetLng != null) coords.push([last.targetLng, last.targetLat]);
    if (coords.length >= 2) lines.push(coords);
  }
  if (!lines.length) return null;
  const gj = { type: "FeatureCollection", features: lines.map((c) => ({ type: "Feature", properties: { stroke: "#E8B560", "stroke-width": 3, "stroke-opacity": 0.95 }, geometry: { type: "LineString", coordinates: c } })) };
  const enc = encodeURIComponent(JSON.stringify(gj));
  const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/geojson(${enc})/auto/${w}x${h}@2x?access_token=${TOKEN}&padding=26`;
  return url.length < 8000 ? url : null; // Mapbox static URLs cap ~8k chars
}
