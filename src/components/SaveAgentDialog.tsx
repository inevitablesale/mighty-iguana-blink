import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { SearchParams } from '@/types';

interface SaveAgentDialogProps {
  searchParams: SearchParams;
  children: React.ReactNode;
}

export function SaveAgentDialog({ searchParams, children }: SaveAgentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!agentName.trim()) {
      toast.error("Please provide a name for your agent.");
      return;
    }
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to create an agent.");

      const { error } = await supabase.from('agents').insert({
        user_id: user.id,
        name: agentName,
        prompt: searchParams.recruiter_specialty,
      });

      if (error) throw error;

      toast.success(`Agent "${agentName}" saved successfully!`, {
        description: "It will now run in the background to find new opportunities for you.",
      });

      // Trigger intent profile update in the background
      supabase.functions.invoke('update-user-intent-profile', {
        body: { userId: user.id },
      }).then(({ error: funcError }) => {
        if (funcError) console.error("Failed to update intent profile:", funcError.message);
        else console.log("User intent profile update triggered.");
      });

      setIsOpen(false);
      setAgentName('');
    } catch (err) {
      toast.error("Failed to save agent", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Search as a New Agent</DialogTitle>
          <DialogDescription>
            This will create a new agent that automatically searches for opportunities matching your query.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name</Label>
            <Input 
              id="agentName" 
              value={agentName} 
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g., 'Bay Area Fintech Sales'"
            />
          </div>
          <div className="space-y-2">
            <Label>Search Criteria (Prompt)</Label>
            <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md border">
              {searchParams.recruiter_specialty}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}