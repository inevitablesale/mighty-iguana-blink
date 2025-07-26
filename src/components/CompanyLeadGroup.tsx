import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Opportunity, Contact } from "@/types/index";
import { OpportunityRow } from "./OpportunityRow";
import { Separator } from "./ui/separator";
import { CompanyBriefingDialog } from "./CompanyBriefingDialog";
import { Button } from "./ui/button";
import { Briefcase, ChevronDown, ChevronUp, Users, MessageSquare } from "lucide-react";
import { ViewContactsDialog } from "./ViewContactsDialog";

interface CompanyLeadGroupProps {
  companyName: string;
  opportunities: Opportunity[];
  companyContacts: Contact[];
  onFindContacts: (opportunity: Opportunity) => void;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
}

export function CompanyLeadGroup({
  companyName,
  opportunities,
  companyContacts,
  onFindContacts,
  onGenerateCampaign,
  isGeneratingCampaign,
  generatingContactId,
}: CompanyLeadGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ROLE_LIMIT = 5;
  const hasMore = opportunities.length > ROLE_LIMIT;

  const displayedOpportunities = hasMore && !isExpanded
    ? opportunities.slice(0, ROLE_LIMIT)
    : opportunities;

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
          
          {companyContacts.length > 0 ? (
            <ViewContactsDialog
              companyName={companyName}
              opportunities={opportunities}
              contacts={companyContacts}
              onGenerateCampaign={onGenerateCampaign}
              isGenerating={isGeneratingCampaign}
              generatingContactId={generatingContactId}
            >
              <Button className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
                <MessageSquare className="mr-2 h-4 w-4" /> View Contacts ({companyContacts.length})
              </Button>
            </ViewContactsDialog>
          ) : (
            <Button onClick={() => onFindContacts(opportunities[0])} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
              <Users className="mr-2 h-4 w-4" /> Find Contacts
            </Button>
          )}
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