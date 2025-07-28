import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProactiveOpportunity } from "@/types";
import { Check, Sparkles, X, DollarSign, Clock, MapPin, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from 'date-fns';

interface ProactiveOpportunityCardProps {
  opportunity: ProactiveOpportunity;
  onAccept: (opportunityId: string) => void;
  onDismiss: (opportunityId: string) => void;
  isAccepting: boolean;
  isDismissing: boolean;
  currentUserId: string;
}

const InfoItem = ({ icon, text }: { icon: React.ReactNode, text: string | null | undefined }) => {
  if (!text) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
};

export function ProactiveOpportunityCard({ opportunity, onAccept, onDismiss, isAccepting, isDismissing }: ProactiveOpportunityCardProps) {
  const jobData = opportunity.job_data;

  const getPostedDate = (dateStr: any) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return `${formatDistanceToNow(date)} ago`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const postedAgo = getPostedDate(jobData.date_posted);

  const isProcessing = isAccepting || isDismissing;

  return (
    <Card className="w-full bg-card text-card-foreground border flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-lg">
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-base font-bold text-foreground leading-tight truncate">{jobData.company}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="flex-shrink-0 px-2 py-1 text-xs font-bold cursor-help">
                  <Sparkles className="h-3 w-3 mr-1.5 text-yellow-400" />
                  {opportunity.relevance_score}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="max-w-xs">
                <p className="font-bold">AI Analysis (Score: {opportunity.relevance_score})</p>
                <p className="whitespace-pre-wrap">{opportunity.relevance_reasoning}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex-grow">
        <p className="text-lg font-semibold text-primary mb-3">{jobData.title}</p>
        <div className="space-y-2">
          <InfoItem icon={<DollarSign size={14} />} text={opportunity.contract_value_assessment} />
          {postedAgo && <InfoItem icon={<Clock size={14} />} text={postedAgo} />}
          <InfoItem icon={<MapPin size={14} />} text={jobData.location} />
        </div>
      </CardContent>
      <CardFooter className="p-3 bg-black/20 border-t border-white/10 flex justify-end gap-2">
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => onDismiss(opportunity.id)}
          disabled={isProcessing}
          className="text-muted-foreground hover:text-red-500"
        >
          {isDismissing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          <span className="sr-only">Dismiss</span>
        </Button>
        <Button 
          size="sm" 
          className="w-full" 
          onClick={() => onAccept(opportunity.id)}
          disabled={isProcessing}
        >
          {isAccepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Accept Deal
        </Button>
      </CardFooter>
    </Card>
  );
}