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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Playbook, AutonomyLevel } from "@/types/index";
import { supportedCountries } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";

interface EditPlaybookDialogProps {
  playbook: Playbook;
  onPlaybookUpdated: () => void;
  children: React.ReactNode;
}

export function EditPlaybookDialog({ playbook, onPlaybookUpdated, children }: EditPlaybookDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>("semi-automatic");
  const [searchLookbackHours, setSearchLookbackHours] = useState("720");
  const [maxResults, setMaxResults] = useState("20");
  const [jobType, setJobType] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [country, setCountry] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState("email");

  useEffect(() => {
    if (playbook) {
      setName(playbook.name);
      setPrompt(playbook.prompt);
      setAutonomyLevel(playbook.autonomy_level);
      setSearchLookbackHours(playbook.search_lookback_hours.toString());
      setMaxResults(playbook.max_results.toString());
      setJobType(playbook.job_type || "");
      setIsRemote(playbook.is_remote || false);
      setCountry(playbook.country || "");
    }
  }, [playbook]);

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
        search_lookback_hours: parseInt(searchLookbackHours, 10),
        max_results: parseInt(maxResults, 10),
        job_type: jobType || null,
        is_remote: isRemote,
        country: country || null,
      })
      .eq("id", playbook.id);

    setIsSaving(false);
    if (error) {
      console.error("Error updating playbook:", error);
      toast.error("Failed to update playbook.");
    } else {
      toast.success("Playbook updated successfully!");
      onPlaybookUpdated();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Playbook: {playbook.name}</DialogTitle>
          <DialogDescription>
            Update the playbook's properties and autonomy level.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Specialty & Location</Label>
            <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
            <p className="text-xs text-muted-foreground">The AI will extract the job title and city/state from this prompt.</p>
          </div>
          <div className="space-y-3">
            <Label>Outreach Channel</Label>
            <RadioGroup value={outreachChannel} onValueChange={setOutreachChannel}>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="email" id="edit-channel-email" />
                <Label htmlFor="edit-channel-email" className="font-normal">
                  <span className="font-semibold">Email</span>
                  <p className="text-sm text-muted-foreground">The playbook will generate and send outreach emails.</p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 rounded-md border p-3 has-[:disabled]:opacity-50">
                <RadioGroupItem value="linkedin" id="edit-channel-linkedin" disabled />
                <Label htmlFor="edit-channel-linkedin" className="font-normal">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">LinkedIn</span>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">The playbook will send connection requests and messages on LinkedIn.</p>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-country">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="edit-country">
                  <SelectValue placeholder="Select Country (for Indeed/Glassdoor)" />
                </SelectTrigger>
                <SelectContent>
                  {supportedCountries.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-job-type">Job Type</Label>
              <Select value={jobType} onValueChange={setJobType}>
                <SelectTrigger id="edit-job-type">
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
              <Label htmlFor="edit-lookback">Search Lookback</Label>
              <Select value={searchLookbackHours} onValueChange={setSearchLookbackHours}>
                <SelectTrigger id="edit-lookback">
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
              <Label htmlFor="edit-max-results">Max Results</Label>
              <Input
                id="edit-max-results"
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                placeholder="e.g., 20"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="edit-is-remote" checked={isRemote} onCheckedChange={setIsRemote} />
            <Label htmlFor="edit-is-remote">Remote Only</Label>
          </div>
          <div className="space-y-3">
            <Label>Autonomy Level</Label>
            <RadioGroup value={autonomyLevel} onValueChange={(value: AutonomyLevel) => setAutonomyLevel(value)}>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="manual" id="edit-manual" />
                <Label htmlFor="edit-manual" className="font-normal">
                  <span className="font-semibold">Manual</span>
                  <p className="text-sm text-muted-foreground">Finds leads. I will manually find contacts and draft outreach.</p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="semi-automatic" id="edit-semi-automatic" />
                <Label htmlFor="edit-semi-automatic" className="font-normal">
                  <span className="font-semibold">Semi-Automatic</span>
                  <p className="text-sm text-muted-foreground">Finds leads, finds contacts, and drafts outreach. I will review and send.</p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 rounded-md border p-3">
                <RadioGroupItem value="automatic" id="edit-automatic" />
                <Label htmlFor="automatic" className="font-normal">
                  <span className="font-semibold">Automatic</span>
                  <p className="text-sm text-muted-foreground">Finds leads, finds contacts, drafts outreach, and sends emails automatically.</p>
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