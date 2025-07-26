import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Opportunity, Contact } from "@/types/index";
import { Users, MessageSquare, Sparkles } from "lucide-react";
import { ViewContactsDialog } from "@/components/ViewContactsDialog";
import { LeadAnalysisDialog } from "./LeadAnalysisDialog";

interface OpportunityRowProps {
  opportunity: Opportunity;
  contacts: Contact[];
  onFindContacts: (opportunity: Opportunity) => void;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
}

export function OpportunityRow({ opportunity, contacts, onFindContacts, onGenerateCampaign, isGeneratingCampaign, generatingContactId }: OpportunityRowProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50">
      <div className="flex-1">
        <p className="font-semibold">{opportunity.role}</p>
        <p className="text-sm text-muted-foreground">{opportunity.location}</p>
      </div>
      <div className="flex items-center gap-4 w-1/3">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs font-medium">Match</p>
            <LeadAnalysisDialog opportunity={opportunity}>
              <Button variant="ghost" size="sm" className="text-xs h-auto py-0 px-1">
                <Sparkles className="h-3 w-3" />
                 <span className="sr-only">View AI Analysis</span>
              </Button>
            </LeadAnalysisDialog>
          </div>
          <Progress value={opportunity.match_score * 10} className="h-1.5" />
        </div>
      </div>
      <div className="flex justify-end gap-2 w-1/3 pl-4">
        {contacts.length > 0 ? (
          <ViewContactsDialog
            opportunity={opportunity}
            contacts={contacts}
            onGenerateCampaign={onGenerateCampaign}
            isGenerating={isGeneratingCampaign}
            generatingContactId={generatingContactId}
          >
            <Button size="sm" className="coogi-gradient-bg text-primary-foreground hover:opacity-90 w-full">
              <MessageSquare className="mr-2 h-4 w-4" /> View Contacts ({contacts.length})
            </Button>
          </ViewContactsDialog>
        ) : (
          <Button size="sm" onClick={() => onFindContacts(opportunity)} className="coogi-gradient-bg text-primary-foreground hover:opacity-90 w-full">
            <Users className="mr-2 h-4 w-4" /> Find Contacts
          </Button>
        )}
      </div>
    </div>
  );
}