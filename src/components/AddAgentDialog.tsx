import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { AutonomyLevel } from "@/types/index";
import { supportedCountries } from "@/lib/countries";
import { useFeedback } from "@/contexts/FeedbackContext";

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentCreated: () => void;
}

export function AddAgentDialog({ open, onOpenChange, onAgentCreated }: AddAgentDialogProps) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>("semi-automatic");
  const [searchLookbackHours, setSearchLookbackHours] = useState("720");
  const [maxResults, setMaxResults] = useState("20");
  const [jobType, setJobType] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [country, setCountry] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { showFeedback } = useFeedback();

  const resetForm = () => {
    setName("");
    setPrompt("");
    setAutonomyLevel("semi-automatic");
    setSearchLookbackHours("720");
    setMaxResults("20");
    setJobType("");
    setIsRemote(false);
    setCountry("");
  };

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) {
      showFeedback({ type: 'error', message: "Please provide a name and a specialty prompt." });
      return;
    }
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showFeedback({ type: 'error', message: "You must be logged in to create an agent." });
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("agents").insert({
      user_id: user.id,
      name,
      prompt,
      autonomy_level: autonomyLevel,
      search_lookback_hours: parseInt(searchLookbackHours, 10),
      max_results: parseInt(maxResults, 10),
      job_type: jobType || null,
      is_remote: isRemote,
      country: country || null,
    });

    setIsSaving(false);
    if (error) {
      console.error("Error creating agent:", error);
      showFeedback({ type: 'error', message: "Failed to create agent." });
    } else {
      showFeedback({ type: 'success', message: `Agent "${name}" created successfully!` });
      onAgentCreated();
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Define a new agent to proactively search for and contact new leads.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 'Fintech Sales Agent'"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Specialty & Location</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'I specialize in placing VPs of Sales in the New York City area...'"
              rows={3}
            />
             <p className="text-xs text-muted-foreground">The AI will extract the job title and city/state from this prompt.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select Country (for Indeed/Glassdoor)" />
                </SelectTrigger>
                <SelectContent>
                  {supportedCountries.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label htmlFor="job-type">Job Type</Label>
              <Select value={jobType} onValueChange={setJobType}>
                <SelectTrigger id="job-type">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fulltime">Full-time</SelectItem>
                  <SelectItem value="parttime">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="lookback">Search Lookback</Label>
              <Select value={searchLookbackHours} onValueChange={setSearchLookbackHours}>
                <SelectTrigger id="lookback">
                  <SelectValue placeholder="Select lookback period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">Last 24 hours</SelectItem>
                  <SelectItem value="168">Last 7 days</SelectItem>
                  <SelectItem value="720">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-results">Max Results</Label>
              <Input
                id="max-results"
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                placeholder="e.g., 20"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="is-remote" checked={isRemote} onCheckedChange={setIsRemote} />
            <Label htmlFor="is-remote">Remote Only</Label>
          </div>
          <div className="space-y-3">
            <Label>Autonomy Level</Label>
            <RadioGroup value={autonomyLevel} onValueChange={(value: AutonomyLevel) => setAutonomyLevel(value)}>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="font-normal">
                  <span className="font-semibold">Manual</span>
                  <p className="text-sm text-muted-foreground">Agent finds opportunities. I will manually approve them to draft outreach.</p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="semi-automatic" id="semi-automatic" />
                <Label htmlFor="semi-automatic" className="font-normal">
                  <span className="font-semibold">Semi-Automatic</span>
                  <p className="text-sm text-muted-foreground">Agent finds opportunities and drafts outreach. I will review and send emails.</p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="automatic" id="automatic" />
                <Label htmlFor="automatic" className="font-normal">
                  <span className="font-semibold">Automatic</span>
                  <p className="text-sm text-muted-foreground">Agent finds opportunities, drafts outreach, and sends emails automatically.</p>
                </Label>
              </div>
            </RadioGroup>
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