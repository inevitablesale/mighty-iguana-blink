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
  const [subject, setSubject] = useState(campaign.subject);
  const [body, setBody] = useState(campaign.body);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject(campaign.subject);
      setBody(campaign.body);
    }
  }, [open, campaign]);

  const handleSave = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body cannot be empty.");
      return;
    }
    setIsSaving(true);

    const { error } = await supabase
      .from("campaigns")
      .update({ subject, body })
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
          <DialogTitle>Edit Email Draft</DialogTitle>
          <DialogDescription>
            Make changes to the email before sending.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subject" className="text-right">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="body" className="text-right pt-2">
              Body
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
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