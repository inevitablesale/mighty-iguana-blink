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

export interface Opportunity {
  id: string;
  companyName: string;
  role: string;
  location: string;
  potential: "High" | "Medium" | "Low";
  hiringUrgency: "High" | "Medium" | "Low";
  matchScore: number;
  keySignal: string;
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  onApproveOutreach: (opportunity: Opportunity) => void;
  isApproved: boolean;
}

export function OpportunityCard({ opportunity, onApproveOutreach, isApproved }: OpportunityCardProps) {
  const getBadgeVariant = (value: string) => {
    switch (value) {
      case "High":
        return "destructive";
      case "Medium":
        return "secondary";
      default:
        return "outline";
    }
  };

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
              <Badge variant={getBadgeVariant(opportunity.hiringUrgency)} className={opportunity.hiringUrgency === 'Medium' ? 'text-secondary-foreground' : ''}>
                Urgency: {opportunity.hiringUrgency}
              </Badge>
              <Badge variant={getBadgeVariant(opportunity.potential)} className={opportunity.potential === 'Medium' ? 'text-secondary-foreground' : ''}>
                Potential: {opportunity.potential}
              </Badge>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-dashed">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Key Signal</span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Zap size={12} className="text-yellow-500" /> {opportunity.keySignal}
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
            <Badge variant={getBadgeVariant(opportunity.potential)} className={opportunity.potential === 'Medium' ? 'text-secondary-foreground' : ''}>{opportunity.potential}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Hiring Urgency</span>
            <Badge variant={getBadgeVariant(opportunity.hiringUrgency)} className={opportunity.hiringUrgency === 'Medium' ? 'text-secondary-foreground' : ''}>{opportunity.hiringUrgency}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Match Score</span>
            <span className="font-semibold">{opportunity.matchScore}/10</span>
          </div>
           <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Key Signal</span>
            <span className="font-semibold text-right">{opportunity.keySignal}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}