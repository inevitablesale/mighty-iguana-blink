import { useState, useEffect } from "react";
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
import { Placement } from "@/types/index";
import { format } from 'date-fns';

interface EditPlacementDialogProps {
  placement: Placement;
  onPlacementUpdated: () => void;
  children: React.ReactNode;
}

export function EditPlacementDialog({ placement, onPlacementUpdated, children }: EditPlacementDialogProps) {
  const [open, setOpen] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (placement) {
      setCandidateName(placement.candidate_name);
      setFeeAmount(placement.fee_amount?.toString() || "");
      setStartDate(placement.start_date ? format(new Date(placement.start_date), 'yyyy-MM-dd') : "");
    }
  }, [placement]);

  const handleSave = async () => {
    if (!candidateName.trim()) {
      toast.error("Candidate's name cannot be empty.");
      return;
    }
    setIsSaving(true);

    const { error } = await supabase
      .from("placements")
      .update({
        candidate_name: candidateName,
        fee_amount: feeAmount ? parseFloat(feeAmount) : null,
        start_date: startDate || null,
      })
      .eq("id", placement.id);

    setIsSaving(false);
    if (error) {
      console.error("Error updating placement:", error);
      toast.error("Failed to update placement.");
    } else {
      toast.success("Placement updated successfully!");
      onPlacementUpdated();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Placement</DialogTitle>
          <DialogDescription>
            Update the details for the placement of {placement.candidate_name}.
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
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}