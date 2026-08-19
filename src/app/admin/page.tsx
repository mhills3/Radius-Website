import { getGrowthData } from "@/lib/growth";
import AdminHub from "@/components/admin/AdminHub";

// Server component: fetches the live growth aggregate (same source as /growth) and hands it to the
// client hub, which lays it out as the center hero with the staff tool cards flanking it. The staff
// gate + redirect live in admin/layout.tsx, so non-staff never see the rendered children.
export default async function AdminPage() {
  const growth = await getGrowthData();
  return <AdminHub growth={growth} />;
}
