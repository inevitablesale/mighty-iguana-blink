import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
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
      <Card className="w-full cursor-pointer hover:border-white/50 transition-colors bg-black/20 border border-white/10 text-white">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg text-white">{opportunity.company_name}</CardTitle>
              <CardDescription className="text-white/80">{opportunity.role}</CardDescription>
            </div>
            <Badge className={`text-white ${getMatchColor(opportunity.match_score)}`}>
              Match: {opportunity.match_score}/10
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/80 line-clamp-2 mb-4">
            {opportunity.key_signal_for_outreach}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-white/20 text-white/80">
              <DollarSign className="h-3 w-3 mr-1.5" />
              {opportunity.contract_value_assessment}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/80">
              <Clock className="h-3 w-3 mr-1.5" />
              {opportunity.hiring_urgency}
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-4">
          <div className="flex items-center text-white font-semibold text-sm hover:text-primary transition-colors">
            View Details & Generate Contract <ArrowRight className="ml-2 h-4 w-4" />
          </div>
        </CardFooter>
      </Card>
    </GenerateContractDialog>
  );
}