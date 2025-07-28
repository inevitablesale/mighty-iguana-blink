import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types";
import { DollarSign, BarChartHorizontal, Star, MapPin, Users, Flame, Briefcase } from "lucide-react";
import { GenerateContractDialog } from "./GenerateContractDialog";

interface OpportunityCardProps {
  opportunity: Opportunity;
}

const InfoItem = ({ icon, text, highlight = false, colorClass = 'text-muted-foreground' }: { icon: React.ReactNode, text: string | undefined | null, highlight?: boolean, colorClass?: string }) => {
  if (!text) return null;
  return (
    <div className={`flex items-center gap-2 text-sm ${highlight ? 'text-foreground font-semibold' : colorClass}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'high': return 'text-red-500 dark:text-red-400';
      case 'medium': return 'text-yellow-500 dark:text-yellow-400';
      case 'low': return 'text-green-500 dark:text-green-400';
      default: return 'text-muted-foreground';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case 'high': return 'text-red-500 dark:text-red-400';
      case 'medium': return 'text-yellow-500 dark:text-yellow-400';
      default: return 'text-muted-foreground';
    }
  };

  const industry = opportunity.company_data_scraped?.categories?.[0] || null;
  const companySize = opportunity.company_data_scraped?.num_employees || null;

  return (
    <GenerateContractDialog opportunity={opportunity}>
      <Card className="w-full cursor-pointer group hover:border-primary transition-colors flex flex-col h-full bg-card text-card-foreground border">
        <CardHeader className="p-4">
          <div className="flex justify-between items-start gap-2">
            <div>
              <CardTitle className="text-base font-bold text-foreground">{opportunity.company_name}</CardTitle>
              <CardDescription className="text-sm text-primary font-medium">{opportunity.role}</CardDescription>
            </div>
            <Badge variant="secondary" className="flex-shrink-0 px-2 py-1 text-xs font-bold">
              <Star className="h-3 w-3 mr-1.5 text-yellow-400" />
              {opportunity.match_score}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-grow space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <InfoItem icon={<Briefcase size={14} />} text={industry} />
            <InfoItem icon={<MapPin size={14} />} text={opportunity.location} />
            <InfoItem icon={<Users size={14} />} text={companySize} />
            <InfoItem icon={<Flame size={14} />} text={`${opportunity.hiring_urgency} Urgency`} colorClass={getUrgencyColor(opportunity.hiring_urgency)} />
          </div>
          <div className="border-t border-border pt-3 space-y-2">
             <InfoItem icon={<DollarSign size={14} />} text={opportunity.contract_value_assessment} highlight colorClass="text-green-600 dark:text-green-400" />
             <InfoItem icon={<BarChartHorizontal size={14} />} text={`${opportunity.placement_difficulty} Difficulty`} highlight colorClass={getDifficultyColor(opportunity.placement_difficulty)} />
          </div>
        </CardContent>
      </Card>
    </GenerateContractDialog>
  );
}