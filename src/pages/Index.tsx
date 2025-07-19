import { Header } from "@/components/Header";
import { Bot, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { usePredictiveLeads } from "@/hooks/usePredictiveLeads";
import { PredictiveLeads } from "@/components/PredictiveLeads";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRevenueChartData } from "@/hooks/useRevenueChartData";
import { RevenueChart } from "@/components/RevenueChart";

export default function Index() {
  const { leads, loading: leadsLoading } = usePredictiveLeads();
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
            {leadsLoading ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold tracking-tight">Searching for Proactive Leads...</h2>
                <p className="text-sm text-muted-foreground">Your agents are on the lookout.</p>
              </div>
            ) : leads.length > 0 ? (
              <PredictiveLeads 
                leads={leads} 
                onInvestigate={() => {}}
                investigatingLead={null}
                investigatedLeads={[]}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <Bot className="h-12 w-12 text-primary" />
                <h2 className="text-2xl font-bold tracking-tight">Welcome to Coogi</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Your AI recruiting intelligence platform. Visit the{" "}
                  <Link to="/agents" className="underline text-primary">Agents page</Link>
                  {" "}to deploy an agent and find new opportunities.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}