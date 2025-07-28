import { TableRow, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Opportunity, Contact, ContactEnrichmentTask } from "@/types/index";
import { Sparkles, MessageSquare, Loader2, XCircle, SearchCheck } from "lucide-react";
import { LeadAnalysisDialog } from "./LeadAnalysisDialog";
import { ViewContactsDialog } from "./ViewContactsDialog";

interface LeadRowProps {
  opportunity: Opportunity;
  allCompanyOpportunities: Opportunity[];
  companyContacts: Contact[];
  task?: ContactEnrichmentTask;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
}

export function LeadRow({
  opportunity,
  allCompanyOpportunities,
  companyContacts,
  task,
  onGenerateCampaign,
  isGeneratingCampaign,
  generatingContactId,
}: LeadRowProps) {

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
        >
          <Button size="sm" className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
            <MessageSquare className="mr-2 h-4 w-4" /> Draft Outreach ({companyContacts.length})
          </Button>
        </ViewContactsDialog>
      );
    }

    if (task) {
      switch (task.status) {
        case 'pending':
          return <Button size="sm" disabled variant="outline"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Queued</Button>;
        case 'processing':
          return <Button size="sm" disabled variant="outline"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</Button>;
        case 'complete':
          return <Button size="sm" disabled variant="outline"><SearchCheck className="mr-2 h-4 w-4" />No Contacts Found</Button>;
        case 'error':
          return <Button size="sm" variant="destructive" disabled title={task.error_message || 'An unknown error occurred'}><XCircle className="mr-2 h-4 w-4" />Error</Button>;
        default:
          return null;
      }
    }

    return <Button size="sm" disabled variant="outline"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Queued</Button>;
  };

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{opportunity.company_name}</div>
        <div className="text-sm text-muted-foreground">{opportunity.location}</div>
      </TableCell>
      <TableCell>{opportunity.role}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={(opportunity.match_score || 0) * 10} className="h-2 w-24" />
          <span className="text-sm font-semibold text-muted-foreground">{(opportunity.match_score || 0)}/10</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <LeadAnalysisDialog opportunity={opportunity}>
            <Button variant="ghost" size="icon"><Sparkles className="h-4 w-4" /></Button>
          </LeadAnalysisDialog>
          {renderContactButton()}
        </div>
      </TableCell>
    </TableRow>
  );
}