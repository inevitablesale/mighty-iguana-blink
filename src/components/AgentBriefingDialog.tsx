import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Bot, PartyPopper } from "lucide-react";
import { AgentBriefing, Opportunity } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    // Reset on new briefing
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
      // Briefing is finished
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

  const progress = isFinished ? 100 : ((currentOppIndex) / opportunities.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="p-4 rounded-lg bg-muted">
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
        </DialogHeader>
        <div className="px-6 pb-6 flex justify-center min-h-[450px] items-center">
          {isFinished ? (
            <div className="text-center py-12">
              <PartyPopper className="mx-auto h-16 w-16 text-primary" />
              <h3 className="mt-4 text-2xl font-bold">Briefing Complete!</h3>
              <p className="mt-2 text-muted-foreground">You've reviewed all new opportunities from this agent.</p>
              <Button onClick={onBriefingComplete} className="mt-6">Close</Button>
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
      </DialogContent>
    </Dialog>
  );
}