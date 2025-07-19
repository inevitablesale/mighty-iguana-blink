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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Campaign } from "@/types/index";

interface EditCampaignDialogProps {
  campaign: Campaign;
  onCampaignUpdated: () => void;
  children: React.ReactNode;
}

export function EditCampaignDialog({ campaign, onCampaignUpdated, children }: EditCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState(campaign.linkedin_message);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLinkedinMessage(campaign.linkedin_message);
    }
  }, [open, campaign]);

  const handleSave = async () => {
    if (!linkedinMessage.trim()) {
      toast.error("Message cannot be empty.");
      return;
    }
    setIsSaving(true);

    const { error } = await supabase
      .from("campaigns")
      .update({ linkedin_message: linkedinMessage })
      .eq("id", campaign.id);

    setIsSaving(false);
    if (error) {
      console.error("Error updating campaign:", error);
      toast.error("Failed to update draft.");
    } else {
      toast.success("Draft updated successfully!");
      onCampaignUpdated();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit LinkedIn Message</DialogTitle>
          <DialogDescription>
            Make changes to the message before sending.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="message" className="text-right pt-2">
              Message
            </Label>
            <Textarea
              id="message"
              value={linkedinMessage}
              onChange={(e) => setLinkedinMessage(e.target.value)}
              className="col-span-3"
              rows={10}
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