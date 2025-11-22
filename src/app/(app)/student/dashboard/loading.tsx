import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <DashboardSkeleton />
    </div>
  );
}

