import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, Check } from "lucide-react";
import { Opportunity } from "@/types/index";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onApproveOutreach: (opportunity: Opportunity) => void;
  isApproved: boolean;
}

export function OpportunityCard({ opportunity, onApproveOutreach, isApproved }: OpportunityCardProps) {
  const getBadgeVariant = (value: string) => {
    if (!value) return "outline";
    const lowerValue = value.toLowerCase();
    if (lowerValue.startsWith("high")) return "destructive";
    if (lowerValue.startsWith("medium")) return "secondary";
    return "outline";
  };

  const getPotentialValue = (assessment: string) => {
    if (!assessment) return 'N/A';
    return assessment.split(' - ')[0];
  }

  return (
    <Dialog>
      <Card>
        <CardHeader className="coogi-gradient-bg rounded-t-lg">
          <CardTitle className="text-primary-foreground">{opportunity.companyName}</CardTitle>
          <CardDescription className="text-primary-foreground/80">{opportunity.role}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2">
            <p className="text-sm text-muted-foreground">{opportunity.location}</p>
            <div className="flex space-x-2">
              <Badge variant={getBadgeVariant(opportunity.hiring_urgency)} className={opportunity.hiring_urgency === 'Medium' ? 'text-secondary-foreground' : ''}>
                Urgency: {opportunity.hiring_urgency}
              </Badge>
              <Badge variant={getBadgeVariant(opportunity.contract_value_assessment)} className={getPotentialValue(opportunity.contract_value_assessment) === 'Medium' ? 'text-secondary-foreground' : ''}>
                Potential: {getPotentialValue(opportunity.contract_value_assessment)}
              </Badge>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-dashed">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Key Signal</span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Zap size={12} className="text-yellow-500" /> {opportunity.key_signal_for_outreach}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
              <span>Match Score</span>
              <div className="w-1/2 flex items-center gap-2">
                <Progress value={opportunity.matchScore * 10} className="h-2" />
                <span className="font-semibold text-foreground">{opportunity.matchScore}/10</span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <DialogTrigger asChild>
            <Button variant="outline">Details</Button>
          </DialogTrigger>
          {isApproved ? (
            <Button disabled>
              <Check className="mr-2 h-4 w-4" />
              Drafted
            </Button>
          ) : (
            <Button onClick={() => onApproveOutreach(opportunity)} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">Approve</Button>
          )}
        </CardFooter>
      </Card>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{opportunity.companyName}</DialogTitle>
          <DialogDescription>{opportunity.role} - {opportunity.location}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Potential</span>
            <Badge variant={getBadgeVariant(opportunity.contract_value_assessment)} className={getPotentialValue(opportunity.contract_value_assessment) === 'Medium' ? 'text-secondary-foreground' : ''}>{getPotentialValue(opportunity.contract_value_assessment)}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Hiring Urgency</span>
            <Badge variant={getBadgeVariant(opportunity.hiring_urgency)} className={opportunity.hiring_urgency === 'Medium' ? 'text-secondary-foreground' : ''}>{opportunity.hiring_urgency}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Match Score</span>
            <span className="font-semibold">{opportunity.matchScore}/10</span>
          </div>
           <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Key Signal</span>
            <span className="font-semibold text-right">{opportunity.key_signal_for_outreach}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}