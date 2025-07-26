import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Opportunity, Contact } from "@/types/index";
import { OpportunityRow } from "./OpportunityRow";
import { Separator } from "./ui/separator";
import { CompanyBriefingDialog } from "./CompanyBriefingDialog";
import { Button } from "./ui/button";
import { Briefcase } from "lucide-react";

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
          {opportunities.map((opp, index) => (
            <div key={opp.id}>
              <OpportunityRow
                opportunity={opp}
                contacts={contactsByOppId.get(opp.id) || []}
                onFindContacts={onFindContacts}
                onGenerateCampaign={onGenerateCampaign}
                isGeneratingCampaign={isGeneratingCampaign}
                generatingContactId={generatingContactId}
              />
              {index < opportunities.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}