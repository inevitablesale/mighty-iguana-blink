import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Agent } from '@/types';

interface EditAgentDialogProps {
  agent: Agent;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAgentUpdate: (updatedAgent: Agent) => void;
}

export function EditAgentDialog({ agent, isOpen, onOpenChange, onAgentUpdate }: EditAgentDialogProps) {
  const [agentName, setAgentName] = useState(agent.name);
  const [autonomyLevel, setAutonomyLevel] = useState(agent.autonomy_level);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAgentName(agent.name);
    setAutonomyLevel(agent.autonomy_level);
  }, [agent]);

  const handleSave = async () => {
    if (!agentName.trim()) {
      toast.error("Please provide a name for your agent.");
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({
          name: agentName,
          autonomy_level: autonomyLevel,
        })
        .eq('id', agent.id)
        .select()
        .single();

      if (error) throw error;

      toast.success(`Agent "${agentName}" updated successfully!`);
      onAgentUpdate(data as Agent);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to update agent", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
          <DialogDescription>
            Update the agent's settings below. Changes will apply to its next run.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name</Label>
            <Input 
              id="agentName" 
              value={agentName} 
              onChange={(e) => setAgentName(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <Label>Autonomy Level</Label>
            <RadioGroup value={autonomyLevel} onValueChange={(value) => setAutonomyLevel(value as Agent['autonomy_level'])}>
              <Label htmlFor="manual" className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary">
                <RadioGroupItem value="manual" id="manual" className="mt-1" />
                <div>
                  <p className="font-semibold">Manual</p>
                  <p className="text-sm text-muted-foreground">Agent only runs when you click "Run Now". Finds deals but takes no further action.</p>
                </div>
              </Label>
              <Label htmlFor="semi-automatic" className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary">
                <RadioGroupItem value="semi-automatic" id="semi-automatic" className="mt-1" />
                <div>
                  <p className="font-semibold">Semi-Automatic</p>
                  <p className="text-sm text-muted-foreground">Automatically finds deals, enriches them, and creates outreach drafts for your approval in the pipeline.</p>
                </div>
              </Label>
              <Label htmlFor="automatic" className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary">
                <RadioGroupItem value="automatic" id="automatic" className="mt-1" />
                <div>
                  <p className="font-semibold">Automatic</p>
                  <p className="text-sm text-muted-foreground">Fully autonomous. Finds deals, enriches them, generates outreach, and sends it to the best contact. The campaign will appear in your "Contacted" column.</p>
                </div>
              </Label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}