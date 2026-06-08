// Server-side disc catalog (reads the bundled discs.json from disk — no network).
import { readFileSync } from "fs";
import path from "path";
import { buildDiscs, type DiscData } from "./discs";
import { type DbDisc } from "./bag";

let CACHE: DiscData[] | null = null;

function load(): DiscData[] {
  if (CACHE) return CACHE;
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "public", "discs.json"), "utf8"));
    const rows = (raw.discs ?? raw) as DbDisc[];
    CACHE = buildDiscs(rows);
  } catch {
    CACHE = [];
  }
  return CACHE;
}

export function getAllDiscsServer(): DiscData[] {
  return load();
}
export function getDiscBySlugServer(slug: string): DiscData | null {
  return load().find((d) => d.slug === slug) ?? null;
}
