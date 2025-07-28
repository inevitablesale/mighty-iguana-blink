import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Opportunity, Contact, ContactEnrichmentTask } from "@/types/index";
import { LeadRow } from "./LeadRow";

interface LeadsTableProps {
  opportunities: Opportunity[];
  opportunitiesByCompany: Map<string, Opportunity[]>;
  contactsByCompany: Map<string, Contact[]>;
  tasksByCompany: Map<string, ContactEnrichmentTask>;
  onFindContacts: (opportunity: Opportunity) => void;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
}

export function LeadsTable({
  opportunities,
  opportunitiesByCompany,
  contactsByCompany,
  tasksByCompany,
  onFindContacts,
  onGenerateCampaign,
  isGeneratingCampaign,
  generatingContactId,
}: LeadsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[25%]">Company</TableHead>
          <TableHead className="w-[30%]">Role</TableHead>
          <TableHead>Match Score</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {opportunities.map((opportunity) => (
          <LeadRow
            key={opportunity.id}
            opportunity={opportunity}
            allCompanyOpportunities={opportunitiesByCompany.get(opportunity.company_name) || []}
            companyContacts={contactsByCompany.get(opportunity.company_name) || []}
            task={tasksByCompany.get(opportunity.company_name)}
            onFindContacts={onFindContacts}
            onGenerateCampaign={onGenerateCampaign}
            isGeneratingCampaign={isGeneratingCampaign}
            generatingContactId={generatingContactId}
          />
        ))}
      </TableBody>
    </Table>
  );
}