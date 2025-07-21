import { useState } from "react";
import { Header } from "@/components/Header";
import { Bot, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRevenueChartData } from "@/hooks/useRevenueChartData";
import { RevenueChart } from "@/components/RevenueChart";
import { useDashboardBriefings, AgentBriefing } from "@/hooks/useDashboardBriefings";
import { AgentBriefingCard } from "@/components/AgentBriefingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { AgentBriefingDialog } from "@/components/AgentBriefingDialog";

export default function Index() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { data: chartData, loading: chartLoading } = useRevenueChartData();
  const { briefings, loading: briefingsLoading, refresh: refreshBriefings } = useDashboardBriefings();
  const [selectedBriefing, setSelectedBriefing] = useState<AgentBriefing | null>(null);

  return (
    <div className="flex flex-col h-screen">
      <Header title="Dashboard" />
      <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-6">
        
        {briefingsLoading ? (
          <Card>
            <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
        ) : briefings.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Agent Briefings</h2>
            </div>
            <p className="text-muted-foreground">Your agents have new opportunities ready for your review.</p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {briefings.map((briefing) => (
                <AgentBriefingCard
                  key={briefing.agent.id}
                  agent={briefing.agent}
                  opportunityCount={briefing.opportunities.length}
                  onStartReview={() => setSelectedBriefing(briefing)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-6 min-h-[200px]">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bot className="h-12 w-12 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">All Caught Up!</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Your agents have no new opportunities right now. Visit the{" "}
                <Link to="/agents" className="underline text-primary">Agents page</Link>
                {" "}to deploy an agent or run an existing one.
              </p>
            </div>
          </div>
        )}

        <Separator />

        <DashboardMetrics stats={stats} loading={statsLoading} />
        
        <RevenueChart data={chartData} loading={chartLoading} />

      </main>

      {selectedBriefing && (
        <AgentBriefingDialog
          briefing={selectedBriefing}
          open={!!selectedBriefing}
          onOpenChange={(open) => {
            if (!open) setSelectedBriefing(null);
          }}
          onBriefingComplete={() => {
            setSelectedBriefing(null);
            refreshBriefings();
          }}
        />
      )}
    </div>
  );
}