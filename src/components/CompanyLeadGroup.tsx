import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Opportunity, Contact } from "@/types/index";
import { OpportunityRow } from "./OpportunityRow";
import { Separator } from "./ui/separator";
import { CompanyBriefingDialog } from "./CompanyBriefingDialog";
import { Button } from "./ui/button";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";

interface CompanyLeadGroupProps {
  companyName: string;
  opportunities: Opportunity[];
  contactsByOppId: Map<string, Contact[]>;
  onFindContacts: (opportunity: Opportunity) => void;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
}

export function CompanyLeadGroup({
  companyName,
  opportunities,
  contactsByOppId,
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
        <CompanyBriefingDialog companyName={companyName}>
          <Button variant="outline">
            <Briefcase className="mr-2 h-4 w-4" />
            Company Briefing
          </Button>
        </CompanyBriefingDialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col">
          {displayedOpportunities.map((opp, index) => (
            <div key={opp.id}>
              <OpportunityRow
                opportunity={opp}
                contacts={contactsByOppId.get(opp.id) || []}
                onFindContacts={onFindContacts}
                onGenerateCampaign={onGenerateCampaign}
                isGeneratingCampaign={isGeneratingCampaign}
                generatingContactId={generatingContactId}
              />
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