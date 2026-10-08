import { redirect } from "next/navigation";

// Vanity link for Gannon's video(s): rides the tracked /download redirect with
// its own source tag, so his installs show up separately in GA scan events,
// App Store Connect (campaign "gannon"), and Play install-referrer attribution.
export const dynamic = "force-dynamic";

export default function GannonRedirect() {
  redirect("/download?s=gannon");
}
