import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProactiveOpportunity } from "@/types";
import { Check, Sparkles, X, DollarSign, Flame, Briefcase, BarChartHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProactiveOpportunityCardProps {
  opportunity: ProactiveOpportunity;
  onAccept: (opportunityId: string) => void;
  onDismiss: (opportunityId: string) => void;
  isAccepting: boolean;
  isDismissing: boolean;
  currentUserId: string;
}

export function ProactiveOpportunityCard({ opportunity, onAccept, onDismiss, isAccepting, isDismissing }: ProactiveOpportunityCardProps) {

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'high': return 'text-red-400 border-red-400/50';
      case 'medium': return 'text-yellow-400 border-yellow-400/50';
      case 'low': return 'text-green-400 border-green-400/50';
      default: return 'text-muted-foreground';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case 'high': return 'text-red-400 border-red-400/50';
      case 'medium': return 'text-yellow-400 border-yellow-400/50';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="w-full bg-card text-card-foreground border flex flex-col">
      <CardHeader className="p-3 pb-2 relative">
        <div className="pr-8">
          <CardTitle className="text-base font-bold text-foreground leading-tight">{opportunity.job_data.company}</CardTitle>
          <CardDescription className="text-sm text-primary font-medium leading-tight truncate">{opportunity.job_data.title}</CardDescription>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => onDismiss(opportunity.id)}
                disabled={isAccepting || isDismissing}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Dismiss Opportunity</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-3 pt-2 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
          <DollarSign size={14} />
          <span>{opportunity.contract_value_assessment}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${getUrgencyColor(opportunity.hiring_urgency || '')}`}>
            <Flame size={12} className="mr-1" /> {opportunity.hiring_urgency}
          </Badge>
          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${getDifficultyColor(opportunity.placement_difficulty || '')}`}>
            <BarChartHorizontal size={12} className="mr-1" /> {opportunity.placement_difficulty}
          </Badge>
          <Badge variant="outline" className="text-xs px-2 py-0.5">
            <Briefcase size={12} className="mr-1" /> {opportunity.seniority_level}
          </Badge>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                <Sparkles className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                <span className="italic truncate">Score {opportunity.relevance_score}: {opportunity.relevance_reasoning}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs">
              <p className="font-bold">AI Analysis (Score: {opportunity.relevance_score})</p>
              <p className="whitespace-pre-wrap">{opportunity.relevance_reasoning}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardContent>
      <CardFooter className="p-2">
        <Button 
          size="sm" 
          className="w-full" 
          onClick={() => onAccept(opportunity.id)}
          disabled={isAccepting || isDismissing}
        >
          <Check className="mr-2 h-4 w-4" />
          {isAccepting ? 'Accepting...' : 'Accept'}
        </Button>
      </CardFooter>
    </Card>
  );
}