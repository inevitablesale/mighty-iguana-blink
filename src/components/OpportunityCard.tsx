import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types";
import { DollarSign, BarChartHorizontal, Star, Building, MapPin, Users, Flame, Briefcase } from "lucide-react";
import { GenerateContractDialog } from "./GenerateContractDialog";
import { Separator } from "./ui/separator";

interface OpportunityCardProps {
  opportunity: Opportunity;
}

const InfoItem = ({ icon, text }: { icon: React.ReactNode, text: string | undefined | null }) => {
  if (!text) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{text}</span>
    </div>
  );
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'low': return 'bg-green-500/10 text-green-400 border-green-500/20';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const industry = opportunity.company_data_scraped?.categories?.join(', ') || 'N/A';
  const companySize = opportunity.company_data_scraped?.num_employees || 'N/A';

  return (
    <GenerateContractDialog opportunity={opportunity}>
      <Card className="w-full cursor-pointer group hover:border-primary transition-colors flex flex-col h-full bg-card text-card-foreground">
        <CardHeader className="p-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{opportunity.company_name}</h3>
              <p className="text-sm font-medium text-primary">{opportunity.role}</p>
            </div>
            <Badge variant="secondary" className="flex-shrink-0 text-base px-3 py-1">
              <Star className="h-4 w-4 mr-1.5 text-yellow-400" />
              {opportunity.match_score}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-grow space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <InfoItem icon={<Briefcase size={14} />} text={industry} />
            <InfoItem icon={<MapPin size={14} />} text={opportunity.location} />
            <InfoItem icon={<Users size={14} />} text={companySize} />
            <InfoItem icon={<Flame size={14} className={getUrgencyColor(opportunity.hiring_urgency)} />} text={`${opportunity.hiring_urgency} Urgency`} />
          </div>
          <Separator />
          <div className="flex justify-between items-center gap-2">
            <Badge variant="outline" className="text-base font-bold border-green-500/30 bg-green-900/30 text-green-300">
              <DollarSign className="h-4 w-4 mr-1.5" />
              {opportunity.contract_value_assessment}
            </Badge>
            <Badge variant="outline" className={`text-sm font-bold ${getDifficultyColor(opportunity.placement_difficulty)}`}>
              <BarChartHorizontal className="h-4 w-4 mr-1.5" />
              {opportunity.placement_difficulty}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </GenerateContractDialog>
  );
}