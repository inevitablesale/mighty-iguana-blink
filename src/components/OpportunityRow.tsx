import { Progress } from "@/components/ui/progress";
import { Opportunity } from "@/types/index";
import { Sparkles } from "lucide-react";
import { LeadAnalysisDialog } from "./LeadAnalysisDialog";
import { Button } from "./ui/button";

interface OpportunityRowProps {
  opportunity: Opportunity;
}

export function OpportunityRow({ opportunity }: OpportunityRowProps) {
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
    </div>
  );
}