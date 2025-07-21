import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Bot, ArrowLeft, PartyPopper } from "lucide-react";
import { AgentBriefing, Opportunity } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Briefing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { briefing } = (location.state as { briefing: AgentBriefing }) || {};

  const [currentOppIndex, setCurrentOppIndex] = useState(0);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [processedOppIds, setProcessedOppIds] = useState<Set<string>>(new Set());

  if (!briefing) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Briefing" />
        <main className="flex-1 flex items-center justify-center">
          <p>No briefing data found. Please start from the dashboard.</p>
          <Button onClick={() => navigate('/')} className="mt-4">Go to Dashboard</Button>
        </main>
      </div>
    );
  }

  const { agent, opportunities } = briefing;
  const currentOpp = opportunities[currentOppIndex];
  const isFinished = currentOppIndex >= opportunities.length;

  const handleNext = () => {
    setCurrentOppIndex(prev => prev + 1);
  };

  const handleApprove = async (opportunity: Opportunity) => {
    setApprovingId(opportunity.id);
    const toastId = toast.loading("Generating outreach draft...");
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId: opportunity.id },
      });
      if (error) throw error;
      toast.success("Draft created!", {
        id: toastId,
        description: "You can now view it in Campaigns.",
        action: { label: "View Campaigns", onClick: () => navigate('/campaigns') },
      });
      setProcessedOppIds(prev => new Set(prev).add(opportunity.id));
      handleNext();
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setApprovingId(null);
    }
  };

  const progress = isFinished ? 100 : ((currentOppIndex) / opportunities.length) * 100;

  return (
    <div className="flex flex-col h-screen">
      <Header title={`Briefing: ${agent.name}`} />
      <main className="flex-1 flex flex-col items-center p-4 lg:p-6 overflow-y-auto">
        <div className="w-full max-w-4xl">
          <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="p-4 rounded-lg bg-muted mb-6">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Briefing from: {agent.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {isFinished ? "Briefing complete!" : `Reviewing opportunity ${currentOppIndex + 1} of ${opportunities.length}`}
                </p>
              </div>
            </div>
            <Progress value={progress} className="mt-3 h-2" />
          </div>

          <div className="flex justify-center">
            {isFinished ? (
              <div className="text-center py-12">
                <PartyPopper className="mx-auto h-16 w-16 text-primary" />
                <h3 className="mt-4 text-2xl font-bold">Briefing Complete!</h3>
                <p className="mt-2 text-muted-foreground">You've reviewed all new opportunities from this agent.</p>
                <Button onClick={() => navigate('/')} className="mt-6">Return to Dashboard</Button>
              </div>
            ) : (
              <div className="w-full max-w-md">
                <OpportunityCard
                  key={currentOpp.id}
                  opportunity={currentOpp}
                  onApproveOutreach={handleApprove}
                  isApproved={processedOppIds.has(currentOpp.id)}
                  isApproving={approvingId === currentOpp.id}
                  onDismiss={handleNext}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Briefing;