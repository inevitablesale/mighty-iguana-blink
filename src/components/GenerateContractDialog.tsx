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
import { Opportunity, Contact } from "@/types";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

interface GenerateContractDialogProps {
  opportunity: Opportunity;
  children: React.ReactNode;
}

export function GenerateContractDialog({ opportunity, children }: GenerateContractDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && step === 1 && contacts.length === 0) {
      const findContacts = async () => {
        setIsLoading(true);
        try {
          const { data: existingContacts, error: existingError } = await supabase
            .from('contacts')
            .select('*')
            .eq('opportunity_id', opportunity.id);

          if (existingError) {
            toast.error("Failed to check for existing contacts.");
          }

          if (existingContacts && existingContacts.length > 0) {
            setContacts(existingContacts);
          } else {
            const { data, error } = await supabase.functions.invoke('find-contacts-for-opportunity', {
              body: { opportunityId: opportunity.id },
            });

            if (error) throw new Error(error.message);
            if (!data.contacts || data.contacts.length === 0) {
              toast.info("No contacts with emails could be found for this company.");
            }
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
  }, [isOpen, opportunity.id, step, contacts.length]);

  const handleNext = () => {
    if (selectedContactId) {
      setStep(2);
      // Placeholder for next step
      toast.info("Email generation coming soon!");
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setContacts([]);
        setSelectedContactId(null);
        setIsLoading(false);
      }, 300);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Contract for {opportunity.company_name}</DialogTitle>
          <DialogDescription>
            {step === 1 ? "First, select the best contact to send the proposal to." : "Now, let's craft the perfect email."}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
          <div>
            {isLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            ) : (
              <RadioGroup onValueChange={setSelectedContactId} className="py-4 max-h-[40vh] overflow-y-auto pr-2 space-y-2">
                {contacts.length > 0 ? contacts.map((contact) => (
                  <Label key={contact.id} htmlFor={contact.id} className="flex items-center gap-4 rounded-md border p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-accent">
                    <RadioGroupItem value={contact.id} id={contact.id} />
                    <div>
                      <p className="font-semibold">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.job_title}</p>
                    </div>
                  </Label>
                )) : <p className="text-sm text-muted-foreground text-center py-8">No contacts found.</p>}
              </RadioGroup>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="py-4 text-center">
            <p>Email generation UI will go here.</p>
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <Button onClick={handleNext} disabled={!selectedContactId || isLoading}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}