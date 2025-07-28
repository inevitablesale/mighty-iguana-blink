import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Opportunity } from "@/types";
import { ContactIntelCard } from "./ContactIntelCard";
import { SmartOutreachAssistant } from "./SmartOutreachAssistant";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlusCircle, Loader2 } from "lucide-react";

interface PitchModeSheetProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function PitchModeSheet({ opportunity, isOpen, onOpenChange }: PitchModeSheetProps) {
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();

  if (!opportunity) return null;

  const handleAddToPipeline = async () => {
    if (!opportunity) return;
    setIsAdding(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { data: existingCampaign, error: checkError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('opportunity_id', opportunity.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingCampaign) {
        toast.info("This deal is already in your pipeline.");
        onOpenChange(false);
        return;
      }

      const { error: insertError } = await supabase.from('campaigns').insert({
        user_id: user.id,
        opportunity_id: opportunity.id,
        company_name: opportunity.company_name,
        role: opportunity.role,
        status: 'draft',
        contact_name: opportunity.primary_contact?.name,
        contact_email: opportunity.primary_contact?.email,
      });

      if (insertError) throw insertError;

      toast.success(`${opportunity.company_name} added to your pipeline!`, {
        action: {
          label: "View Pipeline",
          onClick: () => navigate('/pipeline'),
        },
      });
      onOpenChange(false);

    } catch (err) {
      toast.error("Failed to add to pipeline", { description: (err as Error).message });
    } finally {
      setIsAdding(false);
    }
  };

  const isLoadingContact = false;
  const handleScrapeContacts = () => {
    console.log("Triggering contact scrape for:", opportunity.id);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-2xl">{opportunity.company_name}</SheetTitle>
          <SheetDescription className="text-lg text-primary">{opportunity.role}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            <ContactIntelCard 
              contact={opportunity.primary_contact} 
              isLoading={isLoadingContact}
              onScrape={handleScrapeContacts}
            />
            <Separator />
            <SmartOutreachAssistant />
          </div>
        </ScrollArea>
        <SheetFooter className="p-6 pt-4 border-t bg-background">
          <Button className="w-full" onClick={handleAddToPipeline} disabled={isAdding}>
            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Add to Pipeline
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}