import { StatsCards } from "@/components/dashboard/StatsCards";

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  awaitingStudent: number;
  resolved: number;
  escalated: number;
}

interface SuperAdminDashboardStatsProps {
  stats: Stats;
}

export function SuperAdminDashboardStats({ stats }: SuperAdminDashboardStatsProps) {
  return <StatsCards stats={stats} />;
}
