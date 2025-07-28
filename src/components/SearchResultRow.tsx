import { TableRow, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Opportunity } from "@/types/index";
import { Sparkles, Briefcase } from "lucide-react";
import { LeadAnalysisDialog } from "./LeadAnalysisDialog";
import { CompanyBriefingDialog } from "./CompanyBriefingDialog";

interface SearchResultRowProps {
  opportunity: Opportunity;
}

export function SearchResultRow({ opportunity }: SearchResultRowProps) {
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
            <Button variant="ghost" size="icon" title="View AI Analysis">
              <Sparkles className="h-4 w-4" />
              <span className="sr-only">View AI Analysis</span>
            </Button>
          </LeadAnalysisDialog>
          <CompanyBriefingDialog companyName={opportunity.company_name}>
            <Button variant="ghost" size="icon" title="View Company Briefing">
              <Briefcase className="h-4 w-4" />
              <span className="sr-only">View Company Briefing</span>
            </Button>
          </CompanyBriefingDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}