import { Header } from "@/components/Header";
import { Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRevenueChartData } from "@/hooks/useRevenueChartData";
import { RevenueChart } from "@/components/RevenueChart";
import { CommandSender } from "@/components/CommandSender";

export default function Index() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { data: chartData, loading: chartLoading } = useRevenueChartData();

  return (
    <div className="flex flex-col h-screen">
      <Header title="Dashboard" />
      <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-6">
        <DashboardMetrics stats={stats} loading={statsLoading} />
        
        <RevenueChart data={chartData} loading={chartLoading} />

        <div className="flex-1 flex flex-col justify-center">
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bot className="h-12 w-12 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Welcome to Coogi</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Your AI recruiting intelligence platform. Visit the{" "}
                <Link to="/agents" className="underline text-primary">Agents page</Link>
                {" "}to deploy an agent and find new opportunities.
              </p>
            </div>
          </div>
        </div>
        <CommandSender />
      </main>
    </div>
  );
}