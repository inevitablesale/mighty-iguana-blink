import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardBriefings } from "@/hooks/useDashboardBriefings";
import { AgentMessage } from "@/components/AgentMessage";
import { OpportunityCard } from "@/components/OpportunityCard";
import { IntelligenceDialog } from "@/components/IntelligenceDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";

const CommandCenter = () => {
  const { briefings, loading, refresh } = useDashboardBriefings();
  const [generatingCampaignId, setGeneratingCampaignId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGenerateOutreach = async (opportunityId: string) => {
    setGeneratingCampaignId(opportunityId);
    const toastId = toast.loading("Drafting outreach email...");
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId },
      });
      if (error) throw error;
      toast.success("Outreach draft created!", {
        id: toastId,
        description: "You can now view it in your Campaigns.",
        action: {
          label: "View Campaigns",
          onClick: () => navigate('/campaigns'),
        },
      });
      refresh();
    } catch (e) {
      const err = e as Error;
      console.error("Error generating outreach:", err);
      toast.error(err.message, { id: toastId });
    } finally {
      setGeneratingCampaignId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <main className="flex-1 flex flex-col p-4 lg:p-6 pt-24 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 flex flex-col p-4 lg:p-6 pt-24 space-y-6 overflow-y-auto">
        <AgentMessage>
          <p className="font-semibold">Welcome to your Command Center.</p>
          <p>Here are the latest opportunities your agents have found. Review the intelligence and approve the ones you want to pursue.</p>
        </AgentMessage>

        {briefings.length > 0 ? (
          briefings.map(({ agent, opportunities }) => (
            <div key={agent.id} className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">Briefing from: {agent.name}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {opportunities.map((opp) => (
                  <div key={opp.id} className="flex flex-col gap-2">
                    <IntelligenceDialog opportunity={opp}>
                      <div className="cursor-pointer">
                        <OpportunityCard opportunity={opp} />
                      </div>
                    </IntelligenceDialog>
                    <Button
                      onClick={() => handleGenerateOutreach(opp.id)}
                      disabled={generatingCampaignId === opp.id}
                      className="w-full coogi-gradient-bg text-primary-foreground hover:opacity-90"
                    >
                      {generatingCampaignId === opp.id ? "Generating..." : "Generate Outreach"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bot className="h-12 w-12 text-primary" />
              <h3 className="text-2xl font-bold tracking-tight">All Clear</h3>
              <p className="text-sm text-muted-foreground">Your agents haven't found any new opportunities. Try running a playbook!</p>
              <Button onClick={() => navigate('/agents')} className="mt-4">Go to Playbooks</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CommandCenter;