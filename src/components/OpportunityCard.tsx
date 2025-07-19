import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface Opportunity {
  companyName: string;
  role: string;
  location: string;
  potential: "High" | "Medium" | "Low";
  hiringUrgency: "High" | "Medium" | "Low";
}

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const getBadgeVariant = (value: string) => {
    switch (value) {
      case "High":
        return "destructive";
      case "Medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{opportunity.companyName}</CardTitle>
        <CardDescription>{opportunity.role}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-2">
          <p className="text-sm text-muted-foreground">{opportunity.location}</p>
          <div className="flex space-x-2">
            <Badge variant={getBadgeVariant(opportunity.hiringUrgency)}>
              Urgency: {opportunity.hiringUrgency}
            </Badge>
            <Badge variant={getBadgeVariant(opportunity.potential)}>
              Potential: {opportunity.potential}
            </Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button variant="outline">View Details</Button>
        <Button>Approve Outreach</Button>
      </CardFooter>
    </Card>
  );
}