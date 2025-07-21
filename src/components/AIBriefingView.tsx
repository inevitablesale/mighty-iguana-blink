import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AgentBriefing, Opportunity } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AgentMessage } from "./AgentMessage";
import { OpportunityCard } from "./OpportunityCard";
import { Button } from "./ui/button";
import { Check, X, Info, PartyPopper } from "lucide-react";
import { IntelligenceDialog } from "./IntelligenceDialog";

interface AIBriefingViewProps {
  briefings: AgentBriefing[];
  onBriefingComplete: () => void;
}

export function AIBriefingView({ briefings, onBriefingComplete }: AIBriefingViewProps) {
  const navigate = useNavigate();
  const [agentIndex, setAgentIndex] = useState(0);
  const [oppIndex, setOppIndex] = useState(0);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [processedOppIds, setProcessedOppIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAgentIndex(0);
    setOppIndex(0);
    setProcessedOppIds(new Set());
  }, [briefings]);

  const currentAgentBriefing = briefings[agentIndex];
  const currentOpp = currentAgentBriefing?.opportunities[oppIndex];

  const handleNext = () => {
    if (currentAgentBriefing && oppIndex < currentAgentBriefing.opportunities.length - 1) {
      setOppIndex(prev => prev + 1);
    } else if (agentIndex < briefings.length - 1) {
      setAgentIndex(prev => prev + 1);
      setOppIndex(0);
    } else {
      onBriefingComplete();
    }
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

  if (!currentOpp) {
    return (
      <div className="text-center py-12">
        <PartyPopper className="mx-auto h-16 w-16 text-primary" />
        <h3 className="mt-4 text-2xl font-bold">Briefing Complete!</h3>
        <p className="mt-2 text-muted-foreground">You've reviewed all new opportunities.</p>
        <Button onClick={onBriefingComplete} className="mt-6">Return to Dashboard</Button>
      </div>
    );
  }

  const isApproved = processedOppIds.has(currentOpp.id);
  const isApproving = approvingId === currentOpp.id;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <AgentMessage>
        <p>
          Sir, my agent <strong>"{currentAgentBriefing.agent.name}"</strong> has identified a priority opportunity.
          Company: <strong>{currentOpp.companyName}</strong>, Role: <strong>{currentOpp.role}</strong>.
          My analysis indicates a <strong>{currentOpp.matchScore}/10</strong> strategic fit.
          My recommendation is to engage. Shall I proceed?
        </p>
      </AgentMessage>

      <OpportunityCard opportunity={currentOpp} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Button variant="outline" onClick={handleNext} disabled={isApproving}>
          <X className="mr-2 h-4 w-4" /> Dismiss
        </Button>
        
        <IntelligenceDialog opportunity={currentOpp}>
          <Button variant="outline" className="w-full">
            <Info className="mr-2 h-4 w-4" /> Full Intelligence Briefing
          </Button>
        </IntelligenceDialog>

        <Button 
          onClick={() => handleApprove(currentOpp)} 
          disabled={isApproving || isApproved}
          className="coogi-gradient-bg text-primary-foreground hover:opacity-90 md:col-span-2"
        >
          <Check className="mr-2 h-4 w-4" />
          {isApproving ? 'Approving...' : (isApproved ? 'Approved' : 'Approve & Draft Email')}
        </Button>
      </div>
    </div>
  );
}