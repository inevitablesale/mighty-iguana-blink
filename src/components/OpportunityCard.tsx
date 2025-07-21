import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Opportunity } from "@/types/index";

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
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
    <Card>
      <CardHeader>
        <CardTitle>{opportunity.companyName}</CardTitle>
        <CardDescription>{opportunity.role}</CardDescription>
      </CardHeader>
      <CardContent>
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
    </Card>
  );
}