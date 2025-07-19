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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Campaign } from "@/types/index";

interface CreatePlacementDialogProps {
  campaign: Campaign;
  onPlacementCreated: () => void;
  children: React.ReactNode;
}

export function CreatePlacementDialog({ campaign, onPlacementCreated, children }: CreatePlacementDialogProps) {
  const [open, setOpen] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!candidateName.trim()) {
      toast.error("Please provide the candidate's name.");
      return;
    }
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to create a placement.");
      setIsSaving(false);
      return;
    }

    const { error: placementError } = await supabase.from("placements").insert({
      user_id: user.id,
      campaign_id: campaign.id,
      candidate_name: candidateName,
      fee_amount: feeAmount ? parseFloat(feeAmount) : null,
      start_date: startDate || null,
    });

    if (placementError) {
      console.error("Error creating placement:", placementError);
      toast.error("Failed to create placement.");
      setIsSaving(false);
      return;
    }
    
    const { error: campaignError } = await supabase
      .from('campaigns')
      .update({ status: 'placed' })
      .eq('id', campaign.id);

    setIsSaving(false);
    if (campaignError) {
      console.error("Error updating campaign status:", campaignError);
      toast.error("Placement created, but failed to update campaign status.");
    } else {
      toast.success(`Placement for ${candidateName} recorded!`);
      onPlacementCreated();
      setCandidateName("");
      setFeeAmount("");
      setStartDate("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record New Placement</DialogTitle>
          <DialogDescription>
            Log the details for the successful placement with {campaign.company_name}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="candidate-name" className="text-right">
              Candidate
            </Label>
            <Input
              id="candidate-name"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 'Jane Doe'"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fee-amount" className="text-right">
              Fee ($)
            </Label>
            <Input
              id="fee-amount"
              type="number"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 20000"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="start-date" className="text-right">
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave} disabled={isSaving} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
            {isSaving ? "Saving..." : "Save Placement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}