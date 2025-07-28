import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types";
import { DollarSign, BarChartHorizontal, Star } from "lucide-react";
import { GenerateContractDialog } from "./GenerateContractDialog";

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <GenerateContractDialog opportunity={opportunity}>
      <Card className="w-full cursor-pointer group hover:border-primary transition-colors flex flex-col h-full">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">{opportunity.company_name}</CardTitle>
            <Badge variant="secondary" className="flex-shrink-0">
              <Star className="h-3 w-3 mr-1.5 text-yellow-500" />
              {opportunity.match_score}
            </Badge>
          </div>
          <CardDescription>{opportunity.role}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow" />
        <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-muted-foreground pt-2">
          <Badge variant="outline" className="font-normal">
            <DollarSign className="h-3 w-3 mr-1.5" />
            {opportunity.contract_value_assessment}
          </Badge>
          <Badge className={`font-normal ${getDifficultyColor(opportunity.placement_difficulty)}`}>
            <BarChartHorizontal className="h-3 w-3 mr-1.5" />
            {opportunity.placement_difficulty} Difficulty
          </Badge>
        </CardFooter>
      </Card>
    </GenerateContractDialog>
  );
}