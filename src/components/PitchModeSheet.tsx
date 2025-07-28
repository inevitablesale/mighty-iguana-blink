import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Opportunity } from "@/types";
import { ContactIntelCard } from "./ContactIntelCard";
import { SmartOutreachAssistant } from "./SmartOutreachAssistant";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";

interface PitchModeSheetProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function PitchModeSheet({ opportunity, isOpen, onOpenChange }: PitchModeSheetProps) {
  if (!opportunity) return null;

  // Placeholder logic for contact loading and scraping
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
      </SheetContent>
    </Sheet>
  );
}