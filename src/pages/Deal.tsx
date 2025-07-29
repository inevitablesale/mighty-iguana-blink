import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Opportunity, EvaluatedContact, Campaign, ContactEnrichmentTask } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Search, ThumbsUp, ThumbsDown, BarChart, Star, Briefcase, MapPin, Clock, Users, BrainCircuit, Target, Send, Globe, Mail, Linkedin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { OutreachEditor } from '@/components/OutreachEditor';

interface Analysis {
  score: number;
  positive_signals: string[];
  negative_signals: string[];
  summary: string;
}

const IntelligenceDetail = ({ icon, label, value, isLink = false }: { icon: React.ReactNode, label: string, value: string | undefined | null, isLink?: boolean }) => {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground font-semibold">
        {isLink ? (
          <a href={`http://${value}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
};

export default function Deal() {
  const { opportunityId } = useParams();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [contacts, setContacts] = useState<EvaluatedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<EvaluatedContact | null>(null);
  const [draftCampaign, setDraftCampaign] = useState<Campaign | null>(null);
  const [enrichmentTask, setEnrichmentTask] = useState<ContactEnrichmentTask | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [isFindingContacts, setIsFindingContacts] = useState(false);
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fetchAndEvaluateContacts = useCallback(async (opportunityId: string) => {
    const { data: contactsData, error: contactsError } = await supabase.from('contacts').select('*').eq('opportunity_id', opportunityId).order('created_at', { ascending: false });
    if (contactsError) throw contactsError;

    const initialContacts = contactsData || [];
    setContacts(initialContacts.map(c => ({ ...c, isEvaluating: true })));

    const evaluatedContacts = await Promise.all(initialContacts.map(async (contact) => {
      try {
        const { data, error } = await supabase.functions.invoke('evaluate-contact-fit', { body: { contact, opportunityId } });
        if (error) return { ...contact, isEvaluating: false };
        return { ...contact, evaluation: data.evaluation, isEvaluating: false };
      } catch (e) {
        return { ...contact, isEvaluating: false };
      }
    }));
    setContacts(evaluatedContacts);
  }, []);

  useEffect(() => {
    if (!opportunityId) return;

    const fetchInitialData = async () => {
      setLoading(true);
      setIsAnalysisLoading(true);
      try {
        const oppPromise = supabase.from('opportunities').select('*').eq('id', opportunityId).single();
        const analysisPromise = supabase.functions.invoke('analyze-propensity-to-switch', { body: { opportunityId } });
        const taskPromise = supabase.from('contact_enrichment_tasks').select('*').eq('opportunity_id', opportunityId).order('created_at', { ascending: false }).limit(1).single();

        const [oppResult, analysisResult, taskResult] = await Promise.all([oppPromise, analysisPromise, taskPromise]);

        if (oppResult.error) throw oppResult.error;
        setOpportunity(oppResult.data);

        if (analysisResult.error) console.error(`Analysis Error: ${analysisResult.error.message}`);
        else setAnalysis(analysisResult.data.analysis);
        setIsAnalysisLoading(false);

        if (taskResult.data) setEnrichmentTask(taskResult.data);

        await fetchAndEvaluateContacts(opportunityId);

      } catch (err) {
        toast.error("Failed to load opportunity details", { description: (err as Error).message });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    const contactsChannel = supabase.channel(`contacts-${opportunityId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts', filter: `opportunity_id=eq.${opportunityId}` }, () => fetchAndEvaluateContacts(opportunityId))
      .subscribe();

    const tasksChannel = supabase.channel(`tasks-${opportunityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_enrichment_tasks', filter: `opportunity_id=eq.${opportunityId}` }, (payload) => {
        if (payload.new) {
          setEnrichmentTask(payload.new as ContactEnrichmentTask);
          setIsFindingContacts(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [opportunityId, navigate, fetchAndEvaluateContacts]);

  const handleFindContacts = async () => {
    if (!opportunityId) return;
    setIsFindingContacts(true);
    const toastId = toast.loading("Adding contact search to the queue...");
    try {
      const { error } = await supabase.functions.invoke('create-single-contact-task', {
        body: { opportunityId }
      });
      if (error) throw new Error(error.message);
      toast.success("Contact search queued!", { id: toastId, description: "The system will start finding contacts shortly." });
    } catch (err) {
      toast.error("Failed to queue contact search", { id: toastId, description: (err as Error).message });
      setIsFindingContacts(false);
    }
  };

  const handleGenerateOutreach = async () => {
    if (!selectedContact || !opportunityId) return;
    setIsGeneratingOutreach(true);
    const toastId = toast.loading(`Generating outreach for ${selectedContact.name}...`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId, contact: selectedContact, isAutomatic: false }
      });
      if (error) throw error;
      setDraftCampaign(data.campaign);
      toast.success(data.message, { id: toastId });
    } catch (err) {
      toast.error("Failed to generate outreach", { id: toastId, description: (err as Error).message });
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  const handleSendEmail = async (campaignId: string, subject: string, body: string) => {
    setIsSending(true);
    const toastId = toast.loading("Sending email...");
    try {
      const { error } = await supabase.functions.invoke('send-campaign-email', {
        body: { campaignId, subject, body }
      });
      if (error) throw error;
      toast.success("Email sent successfully!", {
        id: toastId,
        action: { label: "View Campaigns", onClick: () => navigate('/campaigns') }
      });
      setDraftCampaign(null);
    } catch (err) {
      toast.error("Failed to send email", { id: toastId, description: (err as Error).message });
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Good Match') return 'text-green-500';
    if (status === 'Potential Fit') return 'text-yellow-500';
    return 'text-red-500';
  };

  const isSearching = (enrichmentTask?.status === 'pending' || enrichmentTask?.status === 'processing') || isFindingContacts;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-1/2" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className="lg:col-span-2 space-y-6"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
          <div className="space-y-6"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!opportunity) return null;

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <header className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 -ml-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-white">{opportunity.company_name}</h1>
        <p className="text-xl text-primary mt-1">{opportunity.role}</p>
      </header>
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Propensity Analysis</CardTitle></CardHeader>
              <CardContent>
                {isAnalysisLoading ? <Skeleton className="h-48 w-full" /> : analysis ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3"><Badge className="text-base px-3 py-1"><BarChart className="h-4 w-4 mr-2" />Propensity Score: {analysis.score}/10</Badge><p className="text-sm text-muted-foreground">{analysis.summary}</p></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ThumbsUp className="text-green-500" /> Positive Signals</CardTitle></CardHeader><CardContent><ul className="list-disc pl-5 text-sm space-y-1">{analysis.positive_signals.map((signal, i) => <li key={i}>{signal}</li>)}</ul></CardContent></Card>
                      <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ThumbsDown className="text-red-500" /> Negative Signals</CardTitle></CardHeader><CardContent><ul className="list-disc pl-5 text-sm space-y-1">{analysis.negative_signals.map((signal, i) => <li key={i}>{signal}</li>)}</ul></CardContent></Card>
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Could not load analysis.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Enriched Deal Intelligence</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                  <IntelligenceDetail icon={<Globe size={14} />} label="Company Domain" value={opportunity.company_domain} isLink={true} />
                  <IntelligenceDetail icon={<Briefcase size={14} />} label="Seniority Level" value={opportunity.seniority_level} />
                  <IntelligenceDetail icon={<MapPin size={14} />} label="Location Flexibility" value={opportunity.location_flexibility} />
                  <IntelligenceDetail icon={<Clock size={14} />} label="Est. Time to Fill" value={opportunity.estimated_time_to_fill} />
                  <IntelligenceDetail icon={<Users size={14} />} label="TA Team Status" value={opportunity.ta_team_status} />
                  <IntelligenceDetail icon={<BrainCircuit size={14} />} label="Placement Difficulty" value={opportunity.placement_difficulty} />
                  <IntelligenceDetail icon={<Target size={14} />} label="Likely Decision Maker" value={opportunity.likely_decision_maker} />
                </dl>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
              <CardContent>
                <RadioGroup onValueChange={(id) => setSelectedContact(contacts.find(c => c.id === id) || null)} className="max-h-[40vh] overflow-y-auto pr-2 space-y-2">
                  {contacts.map((contact) => (
                    <Label key={contact.id} htmlFor={contact.id} className="flex items-start gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent has-[input:checked]:border-primary">
                      <RadioGroupItem value={contact.id} id={contact.id} className="mt-1" />
                      <div className="flex-grow">
                        <p className="font-semibold">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">{contact.job_title}</p>
                        
                        <div className="mt-2 space-y-1 text-sm">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail size={14} />
                              <span className="text-foreground">{contact.email}</span>
                            </div>
                          )}
                          {contact.linkedin_profile_url && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Linkedin size={14} />
                              <a href={contact.linkedin_profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                View Profile
                              </a>
                            </div>
                          )}
                        </div>

                        {contact.isEvaluating ? <Skeleton className="h-4 w-3/4 mt-2" /> : contact.evaluation && (
                          <div className="mt-2 text-xs">
                            <Badge variant="secondary" className={`font-semibold ${getStatusColor(contact.evaluation.status)}`}><Star className="h-3 w-3 mr-1.5" />{contact.evaluation.score}/10 {contact.evaluation.status}</Badge>
                            <p className="text-muted-foreground mt-1 italic">"{contact.evaluation.reasoning}"</p>
                          </div>
                        )}
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
                
                {isSearching ? (
                  <div className="text-center py-4 border border-dashed rounded-lg mt-2">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {enrichmentTask?.status === 'pending' ? 'Waiting in queue...' : 'Actively searching for contacts...'}
                    </p>
                  </div>
                ) : contacts.length === 0 && (
                  <div className="text-center py-4 border border-dashed rounded-lg mt-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      {enrichmentTask?.status === 'complete' ? 'Search complete. No contacts found.' : 'No contacts found yet.'}
                    </p>
                    <Button onClick={handleFindContacts} size="sm" variant="secondary" disabled={isSearching}>
                      <Search className="mr-2 h-4 w-4" />
                      Find Contacts
                    </Button>
                  </div>
                )}

                {enrichmentTask?.status === 'error' && (
                  <div className="text-center py-4 border border-dashed border-red-500/50 rounded-lg mt-2">
                    <p className="text-sm text-red-400 mb-2">The last search failed.</p>
                    <p className="text-xs text-muted-foreground px-2">{enrichmentTask.error_message}</p>
                    <Button onClick={handleFindContacts} size="sm" variant="secondary" className="mt-3" disabled={isSearching}>
                      <Search className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            {draftCampaign ? (
              <OutreachEditor campaign={draftCampaign} onSend={handleSendEmail} isSending={isSending} />
            ) : (
              <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={!selectedContact || isGeneratingOutreach} onClick={handleGenerateOutreach}>
                    {isGeneratingOutreach ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Generate Outreach Draft
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}