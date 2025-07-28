import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Opportunity, Contact, ContactEnrichmentTask } from "@/types/index";
import { Sparkles, MessageSquare, Loader2, XCircle, SearchCheck } from "lucide-react";
import { LeadAnalysisDialog } from "./LeadAnalysisDialog";
import { ViewContactsDialog } from "./ViewContactsDialog";

interface LeadCardProps {
  opportunity: Opportunity;
  allCompanyOpportunities: Opportunity[];
  companyContacts: Contact[];
  task?: ContactEnrichmentTask;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
  onRevealContact: (contactId: string) => Promise<void>;
  revealedContactIds: Set<string>;
}

export function LeadCard({
  opportunity,
  allCompanyOpportunities,
  companyContacts,
  task,
  onGenerateCampaign,
  isGeneratingCampaign,
  generatingContactId,
  onRevealContact,
  revealedContactIds,
}: LeadCardProps) {

  const renderContactButton = () => {
    if (companyContacts.length > 0) {
      return (
        <ViewContactsDialog
          companyName={opportunity.company_name}
          opportunities={allCompanyOpportunities}
          contacts={companyContacts}
          onGenerateCampaign={onGenerateCampaign}
          isGenerating={isGeneratingCampaign}
          generatingContactId={generatingContactId}
          onRevealContact={onRevealContact}
          revealedContactIds={revealedContactIds}
        >
          <Button size="sm" className="w-full coogi-gradient-bg text-primary-foreground hover:opacity-90">
            <MessageSquare className="mr-2 h-4 w-4" /> View Contacts ({companyContacts.length})
          </Button>
        </ViewContactsDialog>
      );
    }

    if (task) {
      switch (task.status) {
        case 'pending':
          return <Button size="sm" disabled variant="outline" className="w-full"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Queued</Button>;
        case 'processing':
          return <Button size="sm" disabled variant="outline" className="w-full"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</Button>;
        case 'complete':
          return <Button size="sm" disabled variant="outline" className="w-full"><SearchCheck className="mr-2 h-4 w-4" />No Contacts Found</Button>;
        case 'error':
          return <Button size="sm" variant="destructive" disabled className="w-full" title={task.error_message || 'An unknown error occurred'}><XCircle className="mr-2 h-4 w-4" />Error</Button>;
        default:
          return null;
      }
    }
    return null;
  };

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div>
            <CardTitle className="text-lg">{opportunity.company_name}</CardTitle>
            <CardDescription>{opportunity.location}</CardDescription>
          </div>
          <LeadAnalysisDialog opportunity={opportunity}>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </Button>
          </LeadAnalysisDialog>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="font-semibold">{opportunity.role}</p>
        <div className="flex items-center gap-2 mt-2">
          <Progress value={(opportunity.match_score || 0) * 10} className="h-2 w-full" />
          <span className="text-sm font-semibold text-muted-foreground">{(opportunity.match_score || 0)}/10</span>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 p-3">
        {renderContactButton()}
      </CardFooter>
    </Card>
  );
}