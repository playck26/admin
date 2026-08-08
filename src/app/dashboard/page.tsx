import { DashboardSummaryView } from "@/components/dashboard-summary";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <DashboardSummaryView />
      </div>
    </main>
  );
}
