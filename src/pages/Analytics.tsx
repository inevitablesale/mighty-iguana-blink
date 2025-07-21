import { DashboardMetrics } from "@/components/DashboardMetrics";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRevenueChartData } from "@/hooks/useRevenueChartData";
import { RevenueChart } from "@/components/RevenueChart";

const Analytics = () => {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { data: chartData, loading: chartLoading } = useRevenueChartData();

  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 flex flex-col p-4 lg:p-6 pt-24 overflow-y-auto space-y-6">
        <DashboardMetrics stats={stats} loading={statsLoading} />
        <RevenueChart data={chartData} loading={chartLoading} />
      </main>
    </div>
  );
};

export default Analytics;