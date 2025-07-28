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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Agent } from '@/types';
import { supportedCountries } from '@/lib/countries';

const siteNameOptions = ["linkedin", "indeed", "zip_recruiter", "google", "glassdoor", "bayt", "naukri"];
const jobTypeOptions = ["fulltime", "parttime", "internship", "contract"];

interface EditAgentDialogProps {
  agent: Agent;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAgentUpdate: (updatedAgent: Agent) => void;
}

export function EditAgentDialog({ agent, isOpen, onOpenChange, onAgentUpdate }: EditAgentDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Agent>>({});

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        autonomy_level: agent.autonomy_level,
        site_names: agent.site_names || ["linkedin", "indeed"],
        job_type: agent.job_type,
        is_remote: agent.is_remote,
        country: agent.country,
        distance: agent.distance,
        max_results: agent.max_results,
        search_lookback_hours: agent.search_lookback_hours,
        google_search_term: agent.google_search_term,
      });
    }
  }, [agent]);

  const handleFieldChange = (field: keyof Agent, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSiteNamesChange = (site: string, checked: boolean) => {
    const currentSites = formData.site_names || [];
    const newSites = checked ? [...currentSites, site] : currentSites.filter(s => s !== site);
    handleFieldChange('site_names', newSites);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error("Please provide a name for your agent.");
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .update(formData)
        .eq('id', agent.id)
        .select()
        .single();

      if (error) throw error;

      toast.success(`Agent "${formData.name}" updated successfully!`);
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
          <DialogDescription>
            Update the agent's settings below. Changes will apply to its next run.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          {/* Column 1 */}
          <div className="space-y-6">
            <div className="space-y-2"><Label htmlFor="agentName">Agent Name</Label><Input id="agentName" value={formData.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} /></div>
            <div className="space-y-2"><Label>Search Criteria (Prompt)</Label><div className="text-sm text-muted-foreground p-3 bg-muted rounded-md border min-h-[60px] flex items-center"><p className="text-foreground">{agent.prompt}</p></div></div>
            <div className="space-y-3"><Label>Autonomy Level</Label><RadioGroup value={formData.autonomy_level} onValueChange={(v) => handleFieldChange('autonomy_level', v as Agent['autonomy_level'])}>{/* ... Radio items ... */}</RadioGroup></div>
          </div>
          {/* Column 2 */}
          <div className="space-y-6">
            <div><Label>Job Boards</Label><div className="grid grid-cols-2 gap-2 mt-2">{siteNameOptions.map(site => (<div key={site} className="flex items-center space-x-2"><Checkbox id={`edit-site-${site}`} checked={formData.site_names?.includes(site)} onCheckedChange={(c) => handleSiteNamesChange(site, !!c)} /><Label htmlFor={`edit-site-${site}`} className="font-normal capitalize">{site.replace('_', ' ')}</Label></div>))}</div></div>
            <div className="space-y-2"><Label htmlFor="googleSearchTerm">Google Search Term (Advanced)</Label><Input id="googleSearchTerm" value={formData.google_search_term || ''} onChange={(e) => handleFieldChange('google_search_term', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="jobType">Job Type</Label><Select value={formData.job_type || ''} onValueChange={(v) => handleFieldChange('job_type', v)}><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger><SelectContent>{jobTypeOptions.map(type => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="country">Country</Label><Select value={formData.country || ''} onValueChange={(v) => handleFieldChange('country', v)}><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger><SelectContent>{supportedCountries.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="maxResults">Results Wanted</Label><Input id="maxResults" type="number" value={formData.max_results || 20} onChange={e => handleFieldChange('max_results', Number(e.target.value))} /></div>
              <div className="space-y-2"><Label htmlFor="hoursOld">Hours Old</Label><Input id="hoursOld" type="number" value={formData.search_lookback_hours || 72} onChange={e => handleFieldChange('search_lookback_hours', Number(e.target.value))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="distance">Distance (miles)</Label><Input id="distance" type="number" value={formData.distance || 50} onChange={e => handleFieldChange('distance', Number(e.target.value))} /></div>
              <div className="flex items-end"><div className="flex items-center space-x-2"><Checkbox id="isRemoteEdit" checked={formData.is_remote} onCheckedChange={c => handleFieldChange('is_remote', !!c)} /><Label htmlFor="isRemoteEdit">Remote Only</Label></div></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}