import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Eye, X } from "lucide-react";
import { Opportunity } from "@/types/index";
import { OpportunityAnalysisDialog } from "./OpportunityAnalysisDialog";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onApproveOutreach: (opportunity: Opportunity) => void;
  onDismiss: () => void;
  isApproved: boolean;
  isApproving: boolean;
}

export function OpportunityCard({ opportunity, onApproveOutreach, onDismiss, isApproved, isApproving }: OpportunityCardProps) {
  const getBadgeVariant = (value: string) => {
    if (!value) return "outline";
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes("high")) return "destructive";
    if (lowerValue.includes("medium")) return "secondary";
    return "outline";
  };

  const getPotentialValue = (assessment: string) => {
    if (!assessment) return 'N/A';
    return assessment.split(' - ')[0];
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{opportunity.companyName}</CardTitle>
        <CardDescription>{opportunity.role}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={getBadgeVariant(opportunity.hiring_urgency)}>
              Urgency: {opportunity.hiring_urgency}
            </Badge>
            <Badge variant={getBadgeVariant(opportunity.contract_value_assessment)}>
              Potential: {getPotentialValue(opportunity.contract_value_assessment)}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground italic">"{opportunity.key_signal_for_outreach}"</p>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">Match Score</span>
                <span className="font-bold">{opportunity.matchScore}/10</span>
              </div>
              <Progress value={opportunity.matchScore * 10} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-3 gap-2">
        <Button variant="outline" onClick={onDismiss} disabled={isApproving}><X className="mr-2 h-4 w-4" />Dismiss</Button>
        <OpportunityAnalysisDialog opportunity={opportunity}>
          <Button variant="outline" className="w-full"><Eye className="mr-2 h-4 w-4" />Analysis</Button>
        </OpportunityAnalysisDialog>
        {isApproved ? (
          <Button disabled>
            <Check className="mr-2 h-4 w-4" />
            Drafted
          </Button>
        ) : (
          <Button onClick={() => onApproveOutreach(opportunity)} disabled={isApproving} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
            {isApproving ? 'Approving...' : 'Approve'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}