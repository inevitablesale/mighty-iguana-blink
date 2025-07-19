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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Agent, AutonomyLevel } from "@/types/index";

interface EditAgentDialogProps {
  agent: Agent;
  onAgentUpdated: () => void;
  children: React.ReactNode;
}

export function EditAgentDialog({ agent, onAgentUpdated, children }: EditAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>("semi-automatic");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setPrompt(agent.prompt);
      setAutonomyLevel(agent.autonomy_level);
    }
  }, [agent]);

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) {
      toast.error("Name and specialty prompt cannot be empty.");
      return;
    }
    setIsSaving(true);

    const { error } = await supabase
      .from("agents")
      .update({
        name,
        prompt,
        autonomy_level: autonomyLevel,
      })
      .eq("id", agent.id);

    setIsSaving(false);
    if (error) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update agent.");
    } else {
      toast.success("Agent updated successfully!");
      onAgentUpdated();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
          <DialogDescription>
            Update the agent's properties and autonomy level.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Specialty</Label>
            <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          </div>
          <div className="space-y-3">
            <Label>Autonomy Level</Label>
            <RadioGroup value={autonomyLevel} onValueChange={(value: AutonomyLevel) => setAutonomyLevel(value)}>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="manual" id="edit-manual" />
                <Label htmlFor="edit-manual" className="font-normal">
                  <span className="font-semibold">Manual</span>
                  <p className="text-sm text-muted-foreground">Agent finds opportunities. I will manually approve them to draft outreach.</p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="semi-automatic" id="edit-semi-automatic" />
                <Label htmlFor="edit-semi-automatic" className="font-normal">
                  <span className="font-semibold">Semi-Automatic</span>
                  <p className="text-sm text-muted-foreground">Agent finds opportunities and drafts outreach. I will review and send emails.</p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="automatic" id="edit-automatic" />
                <Label htmlFor="edit-automatic" className="font-normal">
                  <span className="font-semibold">Automatic</span>
                  <p className="text-sm text-muted-foreground">Agent finds opportunities, drafts outreach, and sends emails automatically.</p>
                </Label>
              </div>
            </RadioGroup>
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