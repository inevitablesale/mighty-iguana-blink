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
import { ArrowRight, Send, Loader2 } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface GenerateContractDialogProps {
  opportunity: Opportunity;
  children: React.ReactNode;
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const resetState = () => {
    setStep(1);
    setContacts([]);
    setSelectedContact(null);
    setCampaign(null);
    setSelectedFee(null);
    setGeneratedProposal(null);
    setIsLoading(false);
    setIsGenerating(false);
    setIsSending(false);
  };

  useEffect(() => {
    if (isOpen && step === 1 && contacts.length === 0) {
      const findContacts = async () => {
        setIsLoading(true);
        try {
          const { data: existingContacts, error: existingError } = await supabase.from('contacts').select('*').eq('opportunity_id', opportunity.id);
          if (existingError) throw existingError;
          if (existingContacts && existingContacts.length > 0) {
            setContacts(existingContacts);
          } else {
            const { data, error } = await supabase.functions.invoke('find-contacts-for-opportunity', { body: { opportunityId: opportunity.id } });
            if (error) throw new Error(error.message);
            if (!data.contacts || data.contacts.length === 0) toast.info("No contacts with emails could be found for this company.");
            setContacts(data.contacts);
          }
        } catch (err) {
          toast.error("Failed to find contacts", { description: (err as Error).message });
        } finally {
          setIsLoading(false);
        }
      };
      findContacts();
    }
  }, [isOpen, opportunity.id, step]);

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
      
      // Also update the campaign status
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Contract for {opportunity.company_name}</DialogTitle>
          <DialogDescription>
            {step === 1 && "First, select the best contact to send the proposal to."}
            {step === 2 && "Next, choose the fee structure for this engagement."}
            {step === 3 && "Finally, review the generated proposal and send it."}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
          <div>
            {isLoading ? (
              <div className="space-y-4 py-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : (
              <RadioGroup onValueChange={(id) => setSelectedContact(contacts.find(c => c.id === id) || null)} className="py-4 max-h-[40vh] overflow-y-auto pr-2 space-y-2">
                {contacts.length > 0 ? contacts.map((contact) => (
                  <Label key={contact.id} htmlFor={contact.id} className="flex items-center gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-accent">
                    <RadioGroupItem value={contact.id} id={contact.id} />
                    <div><p className="font-semibold">{contact.name}</p><p className="text-sm text-muted-foreground">{contact.job_title}</p></div>
                  </Label>
                )) : <p className="text-sm text-muted-foreground text-center py-8">No contacts found.</p>}
              </RadioGroup>
            )}
          </div>
        )}

        {step === 2 && (
          <RadioGroup onValueChange={setSelectedFee} className="py-4 space-y-2">
            {feeOptions.map((option) => (
              <Label key={option.id} htmlFor={option.id} className="flex items-center gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-accent">
                <RadioGroupItem value={option.value} id={option.id} />
                <p className="font-semibold">{option.label}</p>
              </Label>
            ))}
          </RadioGroup>
        )}

        {step === 3 && (
          <ScrollArea className="h-[50vh] my-4 rounded-md border p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{generatedProposal}</ReactMarkdown>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {step === 1 && <Button onClick={handleContactNext} disabled={!selectedContact || isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Next'} <ArrowRight className="ml-2 h-4 w-4" /></Button>}
          {step === 2 && <Button onClick={handleGenerateProposal} disabled={!selectedFee || isGenerating}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Generate Proposal'} <ArrowRight className="ml-2 h-4 w-4" /></Button>}
          {step === 3 && <Button onClick={handleSendProposal} disabled={isSending}>{isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Proposal'} <Send className="ml-2 h-4 w-4" /></Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}