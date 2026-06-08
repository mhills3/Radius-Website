import { NextResponse } from "next/server";
import { getHighlights } from "@/lib/youtube";

// Cached 15 min: the client bar fetches this on every page open and gets the newest videos,
// while YouTube is only hit a few times an hour.
export const revalidate = 900;

export async function GET() {
  const videos = await getHighlights(12);
  return NextResponse.json({ videos });
}
