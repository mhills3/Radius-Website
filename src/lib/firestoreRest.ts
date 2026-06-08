// Shared server-side Firestore REST access (the gRPC client SDK can't reach Firestore from
// the Next server runtime). Used by SEO metadata, JSON-LD, and the sitemap.
const PROJECT = "radius-dg";
const KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE";
export const REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const auth = (sep: string) => `${sep}key=${KEY}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fsVal(f: any): unknown {
  if (!f) return undefined;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("timestampValue" in f) return Date.parse(f.timestampValue);
  if ("mapValue" in f) { const o: Record<string, unknown> = {}; for (const k in f.mapValue.fields || {}) o[k] = fsVal(f.mapValue.fields[k]); return o; }
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fsVal);
  return undefined;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fsDoc(d: any): Record<string, unknown> {
  const id = (d.name as string).split("/").pop()!;
  const out: Record<string, unknown> = { id };
  for (const k in d.fields || {}) out[k] = fsVal(d.fields[k]);
  return out;
}

/** Fetch a single document, or null. */
export async function fsGet(path: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${REST_BASE}/${path}?${auth("")}`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return fsDoc(await r.json());
  } catch {
    return null;
  }
}

/** List a collection (paged), optionally masking to a few fields. */
export async function fsList(path: string, opts: { pageSize?: number; mask?: string[]; max?: number } = {}): Promise<Record<string, unknown>[]> {
  const { pageSize = 300, mask = [], max = 5000 } = opts;
  const out: Record<string, unknown>[] = [];
  let token = "";
  try {
    do {
      const m = mask.map((f) => `&mask.fieldPaths=${f}`).join("");
      const url = `${REST_BASE}/${path}?pageSize=${pageSize}${auth("&")}${token ? `&pageToken=${token}` : ""}${m}`;
      const r = await fetch(url, { next: { revalidate: 3600 } });
      if (!r.ok) break;
      const j = await r.json();
      for (const d of j.documents || []) out.push(fsDoc(d));
      token = j.nextPageToken || "";
    } while (token && out.length < max);
  } catch {
    /* return what we have */
  }
  return out;
}
