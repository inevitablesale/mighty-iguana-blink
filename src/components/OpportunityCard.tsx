import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types";
import { ArrowRight } from "lucide-react";

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
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{opportunity.company_name}</CardTitle>
            <CardDescription>{opportunity.role}</CardDescription>
          </div>
          <Badge className={`text-white ${getMatchColor(opportunity.match_score)}`}>
            Match: {opportunity.match_score}/10
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {opportunity.key_signal_for_outreach}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button variant="outline" size="sm">
          Generate Contract <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}