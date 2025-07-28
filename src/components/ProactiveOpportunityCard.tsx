import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProactiveOpportunity } from "@/types";
import { Check, Sparkles, X, User, Globe } from "lucide-react";

interface ProactiveOpportunityCardProps {
  opportunity: ProactiveOpportunity;
  onAccept: (opportunityId: string) => void;
  onDismiss: (opportunityId: string) => void;
  isAccepting: boolean;
  isDismissing: boolean;
  currentUserId: string;
}

export function ProactiveOpportunityCard({ opportunity, onAccept, onDismiss, isAccepting, isDismissing, currentUserId }: ProactiveOpportunityCardProps) {
  const isPersonalized = opportunity.user_id === currentUserId;

  return (
    <Card className="w-full bg-card text-card-foreground border flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div>
            <CardTitle className="text-base font-bold text-foreground">{opportunity.job_data.company}</CardTitle>
            <CardDescription className="text-sm text-primary font-medium">{opportunity.job_data.title}</CardDescription>
          </div>
          <Badge variant={isPersonalized ? "default" : "secondary"} className="flex-shrink-0 px-2 py-1 text-xs font-bold">
            {isPersonalized ? <User className="h-3 w-3 mr-1.5" /> : <Globe className="h-3 w-3 mr-1.5" />}
            {isPersonalized ? "For You" : "Hot Market"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="bg-muted/50 border rounded-md p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-purple-400" />
            AI Analysis (Score: {opportunity.relevance_score})
          </p>
          <p className="text-sm text-foreground italic">"{opportunity.relevance_reasoning}"</p>
        </div>
      </CardContent>
      <CardFooter className="p-3 flex gap-2">
        <Button 
          size="sm" 
          className="w-full" 
          onClick={() => onAccept(opportunity.id)}
          disabled={isAccepting || isDismissing}
        >
          <Check className="mr-2 h-4 w-4" />
          {isAccepting ? 'Accepting...' : 'Accept'}
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          className="w-full" 
          onClick={() => onDismiss(opportunity.id)}
          disabled={isAccepting || isDismissing}
        >
          <X className="mr-2 h-4 w-4" />
          {isDismissing ? 'Dismissing...' : 'Dismiss'}
        </Button>
      </CardFooter>
    </Card>
  );
}