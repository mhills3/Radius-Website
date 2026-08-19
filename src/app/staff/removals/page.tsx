import { redirect } from "next/navigation";

// Moved under the Admin hub. Kept as a permanent redirect so old bookmarks/links don't 404.
export default function StaffRemovalsRedirect() {
  redirect("/admin/removals");
}
