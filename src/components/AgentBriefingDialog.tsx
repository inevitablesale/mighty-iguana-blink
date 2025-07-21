import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Bot, PartyPopper, Check, X, Info } from "lucide-react";
import { AgentBriefing, Opportunity } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AgentMessage } from "./AgentMessage";
import { IntelligenceDialog } from "./IntelligenceDialog";

interface AgentBriefingDialogProps {
  briefing: AgentBriefing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBriefingComplete: () => void;
}

export function AgentBriefingDialog({ briefing, open, onOpenChange, onBriefingComplete }: AgentBriefingDialogProps) {
  const navigate = useNavigate();
  const [currentOppIndex, setCurrentOppIndex] = useState(0);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [processedOppIds, setProcessedOppIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrentOppIndex(0);
    setProcessedOppIds(new Set());
  }, [briefing]);

  const { agent, opportunities } = briefing;
  const currentOpp = opportunities[currentOppIndex];
  const isFinished = currentOppIndex >= opportunities.length;

  const handleNext = () => {
    if (currentOppIndex < opportunities.length - 1) {
      setCurrentOppIndex(prev => prev + 1);
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

  const isApproved = currentOpp ? processedOppIds.has(currentOpp.id) : false;
  const isApproving = currentOpp ? approvingId === currentOpp.id : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <span>Briefing with {agent.name}</span>
          </DialogTitle>
          <DialogDescription>
            Your agent will present its findings. Review each opportunity below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 pb-6 space-y-4">
          {isFinished ? (
            <div className="text-center py-12">
              <PartyPopper className="mx-auto h-16 w-16 text-primary" />
              <h3 className="mt-4 text-2xl font-bold">Briefing Complete!</h3>
              <p className="mt-2 text-muted-foreground">You've reviewed all new opportunities from this agent.</p>
              <Button onClick={onBriefingComplete} className="mt-6">Close</Button>
            </div>
          ) : (
            <>
              <AgentMessage>
                <p>
                  Alright, let's look at this opportunity at <strong>{currentOpp.companyName}</strong> for a <strong>{currentOpp.role}</strong> role.
                  I've rated this a <strong>{currentOpp.matchScore}/10</strong> match based on your specialty. My analysis suggests their key pain point is related to "{currentOpp.pain_points.split('\\n- ')[1]?.replace(/^- /, '') || 'growth'}".
                  What are your thoughts?
                </p>
              </AgentMessage>

              <OpportunityCard opportunity={currentOpp} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleNext} disabled={isApproving}>
                  <X className="mr-2 h-4 w-4" /> Dismiss
                </Button>
                
                <IntelligenceDialog opportunity={currentOpp}>
                  <Button variant="outline" className="w-full">
                    <Info className="mr-2 h-4 w-4" /> Intelligence Briefing
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}