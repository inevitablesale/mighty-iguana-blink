import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types";
import { DollarSign, BarChartHorizontal } from "lucide-react";
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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'high':
        return 'bg-red-900/50 text-red-300 border-red-500/30';
      case 'medium':
        return 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30';
      case 'low':
        return 'bg-green-900/50 text-green-300 border-green-500/30';
      default:
        return 'bg-gray-700/50 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <GenerateContractDialog opportunity={opportunity}>
      <Card className="w-full cursor-pointer group hover:border-white/50 transition-colors bg-black/20 border-white/10 text-white flex flex-col p-4 h-full">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-white leading-tight group-hover:text-primary transition-colors">{opportunity.company_name}</h3>
            <p className="text-sm text-white/80">{opportunity.role}</p>
          </div>
          <Badge className={`text-white flex-shrink-0 text-xs px-1.5 py-0.5 ${getMatchColor(opportunity.match_score)}`}>
            {opportunity.match_score}
          </Badge>
        </div>

        <div className="flex-grow" />

        <div className="flex items-center justify-between mt-3 space-x-2">
          <Badge variant="outline" className="border-white/20 text-white/80 font-semibold whitespace-nowrap">
            <DollarSign className="h-3 w-3 mr-1.5" />
            {opportunity.contract_value_assessment}
          </Badge>
          <Badge variant="outline" className={`font-semibold whitespace-nowrap ${getDifficultyColor(opportunity.placement_difficulty)}`}>
            <BarChartHorizontal className="h-3 w-3 mr-1.5" />
            {opportunity.placement_difficulty}
          </Badge>
        </div>
      </Card>
    </GenerateContractDialog>
  );
}