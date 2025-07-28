import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Opportunity, Contact, ContactEnrichmentTask } from "@/types/index";
import { OpportunityRow } from "./OpportunityRow";
import { Separator } from "./ui/separator";
import { CompanyBriefingDialog } from "./CompanyBriefingDialog";
import { Button } from "./ui/button";
import { Briefcase, ChevronDown, ChevronUp, Users, MessageSquare, Loader2, XCircle, SearchCheck } from "lucide-react";
import { ViewContactsDialog } from "./ViewContactsDialog";

interface CompanyLeadGroupProps {
  companyName: string;
  opportunities: Opportunity[];
  companyContacts: Contact[];
  task?: ContactEnrichmentTask;
  onFindContacts: (opportunity: Opportunity) => void;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
  onEnrichContact: (contact: Contact) => void;
  enrichingContactId: string | null;
}

export function CompanyLeadGroup({
  companyName,
  opportunities,
  companyContacts,
  task,
  onFindContacts,
  onGenerateCampaign,
  isGeneratingCampaign,
  generatingContactId,
  onEnrichContact,
  enrichingContactId,
}: CompanyLeadGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ROLE_LIMIT = 5;
  const hasMore = opportunities.length > ROLE_LIMIT;

  const displayedOpportunities = hasMore && !isExpanded
    ? opportunities.slice(0, ROLE_LIMIT)
    : opportunities;

  const renderContactButton = () => {
    if (companyContacts.length > 0) {
      return (
        <ViewContactsDialog
          companyName={companyName}
          opportunities={opportunities}
          contacts={companyContacts}
          onGenerateCampaign={onGenerateCampaign}
          isGenerating={isGeneratingCampaign}
          generatingContactId={generatingContactId}
          onEnrichContact={onEnrichContact}
          enrichingContactId={enrichingContactId}
        >
          <Button className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
            <MessageSquare className="mr-2 h-4 w-4" /> Draft Outreach ({companyContacts.length})
          </Button>
        </ViewContactsDialog>
      );
    }

    if (task) {
      switch (task.status) {
        case 'pending':
        case 'processing':
          return (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </Button>
          );
        case 'complete':
          return (
            <Button disabled variant="outline">
              <SearchCheck className="mr-2 h-4 w-4" />
              No Contacts Found
            </Button>
          );
        case 'error':
        case 'error_no_linkedin_url':
          return (
            <Button variant="destructive" onClick={() => onFindContacts(opportunities[0])}>
              <XCircle className="mr-2 h-4 w-4" />
              Search Failed - Retry
            </Button>
          );
        default:
          return (
            <Button onClick={() => onFindContacts(opportunities[0])} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
              <Users className="mr-2 h-4 w-4" /> Find Contacts
            </Button>
          );
      }
    }

    // Default case: no contacts and no task (for legacy leads or if task creation failed)
    return (
      <Button onClick={() => onFindContacts(opportunities[0])} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
        <Users className="mr-2 h-4 w-4" /> Find Contacts
      </Button>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{companyName}</CardTitle>
          <CardDescription>{opportunities.length} open role{opportunities.length > 1 ? 's' : ''} found</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <CompanyBriefingDialog companyName={companyName}>
            <Button variant="outline">
              <Briefcase className="mr-2 h-4 w-4" />
              Company Briefing
            </Button>
          </CompanyBriefingDialog>
          {renderContactButton()}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col">
          {displayedOpportunities.map((opp, index) => (
            <div key={opp.id}>
              <OpportunityRow opportunity={opp} />
              {index < displayedOpportunities.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </CardContent>
      {hasMore && (
        <CardFooter className="p-1 border-t">
          <Button
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                Show Less <ChevronUp className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Show {opportunities.length - ROLE_LIMIT} More Roles <ChevronDown className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}