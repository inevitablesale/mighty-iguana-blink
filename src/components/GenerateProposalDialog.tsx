import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Campaign } from "@/types/index";
import { useCanvas } from "@/contexts/CanvasContext";

interface GenerateProposalDialogProps {
  campaign: Campaign;
  onProposalCreated: () => void;
  children: React.ReactNode;
}

export function GenerateProposalDialog({ campaign, onProposalCreated, children }: GenerateProposalDialogProps) {
  const [open, setOpen] = useState(false);
  const [feeStructure, setFeeStructure] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { setCurrentView } = useCanvas();

  const handleGenerate = async () => {
    if (!feeStructure.trim()) {
      toast.error("Please define the fee structure for this proposal.");
      return;
    }
    setIsGenerating(true);
    const toastId = toast.loading("Generating proposal...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { data, error: functionError } = await supabase.functions.invoke('generate-proposal', {
        body: { campaign, feeStructure },
      });

      if (functionError) throw new Error(functionError.message);

      const { error: insertError } = await supabase.from('proposals').insert({
        user_id: user.id,
        campaign_id: campaign.id,
        status: 'draft',
        fee_structure: feeStructure,
        generated_body: data.proposal.proposalBody,
      });

      if (insertError) throw new Error(insertError.message);

      toast.success("Proposal generated successfully!", {
        id: toastId,
        description: "You can now view it in the Proposals tab.",
        action: {
          label: "View Proposals",
          onClick: () => setCurrentView('proposals'),
        },
      });
      onProposalCreated();
      setFeeStructure("");
      setOpen(false);
    } catch (e) {
      const err = e as Error;
      console.error("Error generating proposal:", err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Proposal for {campaign.company_name}</DialogTitle>
          <DialogDescription>
            Define the fee structure to generate a formal contract proposal for the {campaign.role} role.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="fee-structure">Fee Structure</Label>
            <Textarea
              id="fee-structure"
              value={feeStructure}
              onChange={(e) => setFeeStructure(e.target.value)}
              placeholder="e.g., '20% of the candidate's first-year base salary, payable upon start date.'"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleGenerate} disabled={isGenerating} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
            {isGenerating ? "Generating..." : "Generate Proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}