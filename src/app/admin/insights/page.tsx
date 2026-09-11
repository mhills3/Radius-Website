import InsightsDashboard from "@/components/admin/InsightsDashboard";

// Radius Brand Insights — internal pilot data room. Staff-gated by admin/layout.tsx.
// Data is a baked snapshot from src/lib/insightsPilot.ts (see that file for provenance).
export default function InsightsPage() {
  return <InsightsDashboard />;
}
