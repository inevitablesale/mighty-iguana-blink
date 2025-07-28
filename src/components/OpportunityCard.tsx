import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types";
import { ArrowRight, DollarSign } from "lucide-react";
import { GenerateContractDialog } from "./GenerateContractDialog";

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const getMatchColor = (score: number) => {
    if (score > 8) return "bg-green-500/80";
    if (score > 6) return "bg-yellow-500/80";
    return "bg-red-500/80";
  };

  // Check if the assessment is a short qualitative value or a detailed sentence.
  const isShortAssessment = opportunity.contract_value_assessment.length < 20;

  return (
    <GenerateContractDialog opportunity={opportunity}>
      <Card className="w-full cursor-pointer hover:border-white/50 transition-colors bg-black/20 border-white/10 text-white flex flex-col p-4 h-full">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-white leading-tight">{opportunity.company_name}</h3>
            <p className="text-sm text-white/80">{opportunity.role}</p>
          </div>
          <Badge className={`text-white flex-shrink-0 text-xs px-1.5 py-0.5 ${getMatchColor(opportunity.match_score)}`}>
            {opportunity.match_score}
          </Badge>
        </div>

        <div className="flex-grow flex items-center my-2">
          <div className="flex items-center w-full">
            <div className="flex-grow">
              {isShortAssessment ? (
                <Badge variant="outline" className="border-white/20 text-white/80 font-semibold">
                  <DollarSign className="h-3 w-3 mr-1.5" />
                  {opportunity.contract_value_assessment}
                </Badge>
              ) : (
                <p className="text-xs text-white/90 bg-white/5 p-2.5 rounded-lg border border-white/10">
                  {opportunity.contract_value_assessment}
                </p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-white/70 ml-3 flex-shrink-0" />
          </div>
        </div>
      </Card>
    </GenerateContractDialog>
  );
}