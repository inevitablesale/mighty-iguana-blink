import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types";
import { ArrowRight, DollarSign, Clock } from "lucide-react";
import { GenerateContractDialog } from "./GenerateContractDialog";

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const getMatchColor = (score: number) => {
    if (score > 8) return "bg-green-500";
    if (score > 6) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <GenerateContractDialog opportunity={opportunity}>
      <Card className="w-full cursor-pointer hover:border-white/50 transition-colors bg-black/20 border border-white/10 text-white flex flex-col p-4 h-full">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-white leading-tight">{opportunity.company_name}</h3>
            <p className="text-sm text-white/80">{opportunity.role}</p>
          </div>
          <Badge className={`text-white flex-shrink-0 ${getMatchColor(opportunity.match_score)}`}>
            {opportunity.match_score}/10
          </Badge>
        </div>
        <p className="text-xs text-white/70 line-clamp-2 flex-grow mb-3">
          {opportunity.key_signal_for_outreach}
        </p>
        <div className="flex items-center justify-between text-xs mt-auto">
            <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="border-white/20 text-white/80">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {opportunity.contract_value_assessment}
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/80">
                  <Clock className="h-3 w-3 mr-1" />
                  {opportunity.hiring_urgency}
                </Badge>
            </div>
            <ArrowRight className="h-4 w-4 text-white/70 flex-shrink-0" />
        </div>
      </Card>
    </GenerateContractDialog>
  );
}