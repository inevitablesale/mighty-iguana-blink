import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Opportunity, Contact, Campaign } from "@/types";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight, Send, Loader2, ThumbsUp, ThumbsDown, BarChart, Search } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { Separator } from "./ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface GenerateContractDialogProps {
  opportunity: Opportunity;
  children: React.ReactNode;
}

interface Analysis {
  score: number;
  positive_signals: string[];
  negative_signals: string[];
  summary: string;
}

const feeOptions = [
  { id: "fee1", label: "Contingency: 20% of First-Year Base Salary", value: "20% of the candidate's first-year base salary, payable upon the candidate's start date." },
  { id: "fee2", label: "Contingency: 25% of First-Year Base Salary", value: "25% of the candidate's first-year base salary, payable upon the candidate's start date." },
  { id: "fee3", label: "Retained: 30% of First-Year OTE", value: "30% of the candidate's first-year on-target earnings (OTE), payable in three installments: one-third upon signing this agreement, one-third upon presentation of a candidate shortlist, and the final third upon the candidate's start date." },
];

export function GenerateContractDialog({ opportunity, children }: GenerateContractDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [selectedFee, setSelectedFee] = useState<string | null>(null);
  const [generatedProposal, setGeneratedProposal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFindingContacts, setIsFindingContacts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  const resetState = () => {
    setStep(1);
    setContacts([]);
    setSelectedContact(null);
    setCampaign(null);
    setSelectedFee(null);
    setGeneratedProposal(null);
    setIsLoading(false);
    setIsFindingContacts(false);
    setIsGenerating(false);
    setIsSending(false);
    setAnalysis(null);
    setIsAnalysisLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      const fetchInitialData = async () => {
        setIsLoading(true);
        setIsAnalysisLoading(true);
        try {
          const analysisPromise = supabase.functions.invoke('analyze-propensity-to-switch', {
            body: { opportunityId: opportunity.id }
          });
          const contactsPromise = supabase.from('contacts').select('*').eq('opportunity_id', opportunity.id);

          const [analysisResult, contactsResult] = await Promise.all([analysisPromise, contactsPromise]);

          if (analysisResult.error) throw new Error(analysisResult.error.message);
          setAnalysis(analysisResult.data.analysis);

          if (contactsResult.error) throw new Error(contactsResult.error.message);
          setContacts(contactsResult.data || []);

        } catch (err) {
          toast.error("Failed to load opportunity data", { description: (err as Error).message });
        } finally {
          setIsLoading(false);
          setIsAnalysisLoading(false);
        }
      };
      fetchInitialData();
    }
  }, [isOpen, opportunity.id]);

  const handleFindContacts = async () => {
    setIsFindingContacts(true);
    const toastId = toast.loading("Searching for contacts...", {
      description: "This can take a minute or two. Please wait."
    });
    try {
      const { data, error } = await supabase.functions.invoke('find-contacts-for-opportunity', {
        body: { opportunityId: opportunity.id }
      });

      if (error) throw new Error(error.message);

      if (data.contacts && data.contacts.length > 0) {
        setContacts(data.contacts);
        toast.success(`Found ${data.contacts.length} new contacts!`, { id: toastId });
      } else {
        toast.info("No new contacts found.", { id: toastId, description: "The search completed, but didn't find anyone new." });
      }
    } catch (err) {
      toast.error("Failed to find contacts", { id: toastId, description: (err as Error).message });
    } finally {
      setIsFindingContacts(false);
    }
  };

  const handleContactNext = async () => {
    if (!selectedContact) return;
    setIsLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) throw new Error("User not found");

      const { data: newCampaign, error } = await supabase.from('campaigns').insert({
        user_id: user.user.id,
        opportunity_id: opportunity.id,
        company_name: opportunity.company_name,
        role: opportunity.role,
        contact_name: selectedContact.name,
        contact_email: selectedContact.email,
        status: 'draft',
      }).select().single();

      if (error) throw error;
      setCampaign(newCampaign);
      setStep(2);
    } catch (err) {
      toast.error("Failed to create campaign", { description: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateProposal = async () => {
    if (!campaign || !selectedFee) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-proposal', {
        body: { campaign, feeStructure: selectedFee },
      });
      if (error) throw new Error(error.message);
      setGeneratedProposal(data.proposal.proposalBody);
      setStep(3);
    } catch (err) {
      toast.error("Failed to generate proposal", { description: (err as Error).message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendProposal = async () => {
    if (!campaign || !generatedProposal || !selectedFee) return;
    setIsSending(true);
    try {
      const { error } = await supabase.from('proposals').insert({
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        status: 'sent',
        fee_structure: selectedFee,
        generated_body: generatedProposal,
      });
      if (error) throw error;
      
      await supabase.from('campaigns').update({ status: 'contacted' }).eq('id', campaign.id);

      toast.success("Proposal sent successfully!");
      handleOpenChange(false);
    } catch (err) {
      toast.error("Failed to send proposal", { description: (err as Error).message });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setTimeout(resetState, 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Opportunity Details: {opportunity.company_name}</DialogTitle>
          <DialogDescription>
            Review the AI-powered analysis below, then follow the steps to generate and send a contract.
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4">
          <h3 className="text-base font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Propensity Analysis</h3>
          {isAnalysisLoading ? (
            <div className="space-y-3"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-16 w-full" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div></div>
          ) : analysis ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3"><Badge className="text-base px-3 py-1"><BarChart className="h-4 w-4 mr-2" />Propensity Score: {analysis.score}/10</Badge><p className="text-sm text-muted-foreground">{analysis.summary}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ThumbsUp className="text-green-500" /> Positive Signals</CardTitle></CardHeader><CardContent><ul className="list-disc pl-5 text-sm space-y-1">{analysis.positive_signals.map((signal, i) => <li key={i}>{signal}</li>)}</ul></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ThumbsDown className="text-red-500" /> Negative Signals</CardTitle></CardHeader><CardContent><ul className="list-disc pl-5 text-sm space-y-1">{analysis.negative_signals.map((signal, i) => <li key={i}>{signal}</li>)}</ul></CardContent></Card>
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Could not load analysis.</p>}
        </div>

        <Separator className="my-6" />

        <div>
          <h3 className="text-base font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Step {step}: {step === 1 ? "Select Contact" : step === 2 ? "Choose Fee Structure" : "Review Proposal"}</h3>
          {step === 1 && (
            <div>
              {isLoading ? (
                <div className="space-y-4 py-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : (
                <div className="py-4">
                  <RadioGroup onValueChange={(id) => setSelectedContact(contacts.find(c => c.id === id) || null)} className="max-h-[30vh] overflow-y-auto pr-2 space-y-2">
                    {contacts.map((contact) => (
                      <Label key={contact.id} htmlFor={contact.id} className="flex items-center gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-accent">
                        <RadioGroupItem value={contact.id} id={contact.id} />
                        <div>
                          <p className="font-semibold">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">{contact.job_title}</p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                  
                  {contacts.length === 0 && !isFindingContacts && (
                    <div className="text-center py-8 border border-dashed rounded-lg">
                      <p className="text-sm text-muted-foreground mb-4">No contacts found for this opportunity yet.</p>
                      <Button onClick={handleFindContacts} disabled={isFindingContacts}>
                        <Search className="mr-2 h-4 w-4" />
                        Find Contacts Now
                      </Button>
                    </div>
                  )}

                  {isFindingContacts && (
                     <div className="text-center py-8">
                       <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                       <p className="text-sm text-muted-foreground mt-4">Searching for contacts, please wait...</p>
                     </div>
                  )}
                </div>
              )}
            </div>
          )}
          {step === 2 && <RadioGroup onValueChange={setSelectedFee} className="py-4 space-y-2">{feeOptions.map((option) => <Label key={option.id} htmlFor={option.id} className="flex items-center gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-accent"><RadioGroupItem value={option.value} id={option.id} /><p className="font-semibold">{option.label}</p></Label>)}</RadioGroup>}
          {step === 3 && <ScrollArea className="h-[50vh] my-4 rounded-md border p-4"><div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{generatedProposal}</ReactMarkdown></div></ScrollArea>}
        </div>

        <DialogFooter>
          {step === 1 && <Button onClick={handleContactNext} disabled={!selectedContact || isLoading || isFindingContacts}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Next'} <ArrowRight className="ml-2 h-4 w-4" /></Button>}
          {step === 2 && <Button onClick={handleGenerateProposal} disabled={!selectedFee || isGenerating}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Generate Proposal'} <ArrowRight className="ml-2 h-4 w-4" /></Button>}
          {step === 3 && <Button onClick={handleSendProposal} disabled={isSending}>{isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Proposal'} <Send className="ml-2 h-4 w-4" /></Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}