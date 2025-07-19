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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";

interface AddAgentDialogProps {
  onAgentCreated: () => void;
}

export function AddAgentDialog({ onAgentCreated }: AddAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) {
      toast.error("Please provide a name and a specialty prompt for your agent.");
      return;
    }
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to create an agent.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("agents").insert({
      user_id: user.id,
      name,
      prompt,
    });

    setIsSaving(false);
    if (error) {
      console.error("Error creating agent:", error);
      toast.error("Failed to create agent.");
    } else {
      toast.success(`Agent "${name}" created successfully!`);
      onAgentCreated();
      setName("");
      setPrompt("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Define a new agent to proactively search for and contact new leads.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 'Fintech Sales Agent'"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prompt" className="text-right">
              Specialty
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 'I specialize in placing VPs of Sales...'"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave} disabled={isSaving} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
            {isSaving ? "Saving..." : "Save Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}