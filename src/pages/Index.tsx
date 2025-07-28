import { Header } from "@/components/Header";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRevenueChartData } from "@/hooks/useRevenueChartData";
import { useRecentLeads } from "@/hooks/useRecentLeads";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { RevenueChart } from "@/components/RevenueChart";
import { RecentLeads } from "@/components/RecentLeads";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function Index() {
  const { stats, loading: statsLoading, refresh: refreshStats } = useDashboardStats();
  const { data: chartData, loading: chartLoading, refresh: refreshChartData } = useRevenueChartData();
  const { leads, loading: leadsLoading, refresh: refreshLeads } = useRecentLeads();

  const handleRefresh = () => {
    refreshStats();
    refreshChartData();
    refreshLeads();
  };

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Welcome back!</h1>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
        <DashboardMetrics stats={stats} loading={statsLoading} />
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RevenueChart data={chartData} loading={chartLoading} />
          </div>
          <RecentLeads leads={leads} loading={leadsLoading} />
        </div>
      </main>
    </div>
  );
}