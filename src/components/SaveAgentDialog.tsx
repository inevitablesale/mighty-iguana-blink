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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Agent, SearchParams } from '@/types';

interface SaveAgentDialogProps {
  searchParams: SearchParams | null;
  children: React.ReactNode;
}

export function SaveAgentDialog({ searchParams, children }: SaveAgentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState<Agent['autonomy_level']>('semi-automatic');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!agentName.trim()) {
      toast.error("Please provide a name for your agent.");
      return;
    }
    if (!searchParams) {
      toast.error("Cannot save agent until the prompt has been generated.");
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
        autonomy_level: autonomyLevel,
      });

      if (error) throw error;

      toast.success(`Agent "${agentName}" saved successfully!`, {
        description: "It will now run in the background to find new opportunities for you.",
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save Search as a New Agent</DialogTitle>
          <DialogDescription>
            This will create a new agent that automatically searches for opportunities matching your query.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
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
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md border min-h-[60px] flex items-center">
              {searchParams ? (
                <p className="text-foreground">{searchParams.recruiter_specialty}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating prompt based on market intel...</span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <Label>Autonomy Level</Label>
            <RadioGroup value={autonomyLevel} onValueChange={(value) => setAutonomyLevel(value as Agent['autonomy_level'])}>
              <Label htmlFor="new-manual" className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary">
                <RadioGroupItem value="manual" id="new-manual" className="mt-1" />
                <div>
                  <p className="font-semibold">Manual</p>
                  <p className="text-sm text-muted-foreground">Agent only runs when you click "Run Now". Finds deals but takes no further action.</p>
                </div>
              </Label>
              <Label htmlFor="new-semi-automatic" className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary">
                <RadioGroupItem value="semi-automatic" id="new-semi-automatic" className="mt-1" />
                <div>
                  <p className="font-semibold">Semi-Automatic</p>
                  <p className="text-sm text-muted-foreground">Automatically finds deals, enriches them, and creates outreach drafts for your approval in the pipeline.</p>
                </div>
              </Label>
              <Label htmlFor="new-automatic" className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary">
                <RadioGroupItem value="automatic" id="new-automatic" className="mt-1" />
                <div>
                  <p className="font-semibold">Automatic</p>
                  <p className="text-sm text-muted-foreground">Fully autonomous. Finds deals, enriches them, generates outreach, and sends it to the best contact. The campaign will appear in your "Contacted" column.</p>
                </div>
              </Label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !searchParams}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}