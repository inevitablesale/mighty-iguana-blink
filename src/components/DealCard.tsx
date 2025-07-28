import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity, DealSignal } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, Briefcase, MapPin, Users, XCircle, Star, DollarSign, ArrowRight } from "lucide-react";

interface DealCardProps {
  opportunity: Opportunity;
}

const signalIcons: { [key: string]: React.ReactNode } = {
  'Urgency': <Flame className="h-3 w-3" />,
  'Budget': <DollarSign className="h-3 w-3" />,
  'Strategic': <Briefcase className="h-3 w-3" />,
  'Resource Gap': <Users className="h-3 w-3" />,
  'Role Type': <Briefcase className="h-3 w-3" />,
};

const getSignalColor = (type: DealSignal['type']) => {
    switch(type) {
        case 'Urgency': return 'bg-red-500/20 text-red-300 border-red-500/30';
        case 'Budget': return 'bg-green-500/20 text-green-300 border-green-500/30';
        case 'Strategic': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        case 'Resource Gap': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
        default: return 'bg-muted text-muted-foreground';
    }
}

export function DealCard({ opportunity }: DealCardProps) {
  return (
    <Card 
      className="w-full bg-black/20 border-white/10 text-white backdrop-blur-sm transition-all hover:border-primary/50 cursor-pointer"
    >
      <CardHeader className="p-4">
        <div className="flex justify-between items-start gap-2">
          <div>
            <CardTitle className="text-base font-bold text-foreground">{opportunity.company_name}</CardTitle>
            <CardDescription className="text-sm text-primary font-medium">{opportunity.role}</CardDescription>
          </div>
          <Badge variant="secondary" className="flex-shrink-0 px-2 py-1 text-xs font-bold">
            <Star className="h-3 w-3 mr-1.5 text-yellow-400" />
            {opportunity.match_score}/10 Fit
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <MapPin size={12} /> <span>{opportunity.location}</span>
            {opportunity.ta_team_status === 'No Recruiters' && (
                <>
                <span className="mx-1">·</span>
                <span className="flex items-center gap-1.5 text-yellow-300"><XCircle size={12} /> No Recruiters Detected</span>
                </>
            )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-2">
            <TooltipProvider>
            {opportunity.deal_signals.map((signal, index) => (
                <Tooltip key={index} delayDuration={100}>
                    <TooltipTrigger>
                        <Badge variant="outline" className={`font-normal ${getSignalColor(signal.type)}`}>
                            <span className="mr-1.5">{signalIcons[signal.type]}</span>
                            {signal.value}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="font-bold">{signal.type} Signal</p>
                        <p>{signal.description}</p>
                    </TooltipContent>
                </Tooltip>
            ))}
            </TooltipProvider>
        </div>
      </CardContent>
      <CardFooter className="p-3 bg-black/30 border-t border-white/20 flex justify-end">
        <div className="text-xs text-muted-foreground flex items-center">
            Open Pitch Mode <ArrowRight className="ml-2 h-3 w-3" />
        </div>
      </CardFooter>
    </Card>
  );
}