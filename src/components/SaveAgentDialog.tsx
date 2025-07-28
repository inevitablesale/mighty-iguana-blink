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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Agent, SearchParams } from '@/types';
import { supportedCountries } from '@/lib/countries';

const siteNameOptions = ["linkedin", "indeed", "zip_recruiter", "google", "glassdoor", "bayt", "naukri"];
const jobTypeOptions = ["fulltime", "parttime", "internship", "contract"];

interface SaveAgentDialogProps {
  searchParams: SearchParams | null;
  children: React.ReactNode;
}

export function SaveAgentDialog({ searchParams, children }: SaveAgentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState<Agent['autonomy_level']>('semi-automatic');
  const [isSaving, setIsSaving] = useState(false);

  // New state for advanced options
  const [siteNames, setSiteNames] = useState<string[]>(["linkedin", "indeed", "zip_recruiter", "google"]);
  const [jobType, setJobType] = useState<string | null>('fulltime');
  const [isRemote, setIsRemote] = useState(false);
  const [country, setCountry] = useState<string | null>('USA');
  const [distance, setDistance] = useState(50);
  const [maxResults, setMaxResults] = useState(20);
  const [hoursOld, setHoursOld] = useState(72);
  const [googleSearchTerm, setGoogleSearchTerm] = useState('');

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
        site_names: siteNames,
        job_type: jobType,
        is_remote: isRemote,
        country: country,
        distance: distance,
        max_results: maxResults,
        search_lookback_hours: hoursOld,
        google_search_term: googleSearchTerm,
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Save Search as a New Agent</DialogTitle>
          <DialogDescription>
            This will create a new agent that automatically searches for opportunities matching your query.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          {/* Column 1 */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="agentName">Agent Name</Label>
              <Input id="agentName" value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g., 'Bay Area Fintech Sales'" />
            </div>
            <div className="space-y-2">
              <Label>Search Criteria (Prompt)</Label>
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md border min-h-[60px] flex items-center">
                {searchParams ? <p className="text-foreground">{searchParams.recruiter_specialty}</p> : <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span>Generating prompt...</span></div>}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Autonomy Level</Label>
              <RadioGroup value={autonomyLevel} onValueChange={(value) => setAutonomyLevel(value as Agent['autonomy_level'])}>
                <Label className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary"><RadioGroupItem value="manual" id="new-manual" className="mt-1" /><div><p className="font-semibold">Manual</p><p className="text-sm text-muted-foreground">Agent only runs when you click "Run Now".</p></div></Label>
                <Label className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary"><RadioGroupItem value="semi-automatic" id="new-semi-automatic" className="mt-1" /><div><p className="font-semibold">Semi-Automatic</p><p className="text-sm text-muted-foreground">Finds deals, enriches them, and creates outreach drafts.</p></div></Label>
                <Label className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary"><RadioGroupItem value="automatic" id="new-automatic" className="mt-1" /><div><p className="font-semibold">Automatic</p><p className="text-sm text-muted-foreground">Finds, enriches, and sends outreach automatically.</p></div></Label>
              </RadioGroup>
            </div>
          </div>

          {/* Column 2 */}
          <div className="space-y-6">
            <div>
              <Label>Job Boards</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {siteNameOptions.map(site => (
                  <div key={site} className="flex items-center space-x-2">
                    <Checkbox id={`site-${site}`} checked={siteNames.includes(site)} onCheckedChange={(checked) => {
                      setSiteNames(prev => checked ? [...prev, site] : prev.filter(s => s !== site));
                    }} />
                    <Label htmlFor={`site-${site}`} className="font-normal capitalize">{site.replace('_', ' ')}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="googleSearchTerm">Google Search Term (Advanced)</Label>
              <Input id="googleSearchTerm" value={googleSearchTerm} onChange={(e) => setGoogleSearchTerm(e.target.value)} placeholder="e.g., software engineer jobs near San Francisco, CA since yesterday" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="jobType">Job Type</Label><Select value={jobType || ''} onValueChange={setJobType}><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger><SelectContent>{jobTypeOptions.map(type => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="country">Country</Label><Select value={country || ''} onValueChange={setCountry}><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger><SelectContent>{supportedCountries.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="maxResults">Results Wanted</Label><Input id="maxResults" type="number" value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label htmlFor="hoursOld">Hours Old</Label><Input id="hoursOld" type="number" value={hoursOld} onChange={e => setHoursOld(Number(e.target.value))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="distance">Distance (miles)</Label><Input id="distance" type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} /></div>
              <div className="flex items-end"><div className="flex items-center space-x-2"><Checkbox id="isRemote" checked={isRemote} onCheckedChange={c => setIsRemote(!!c)} /><Label htmlFor="isRemote">Remote Only</Label></div></div>
            </div>
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