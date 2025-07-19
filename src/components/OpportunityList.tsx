import { OpportunityCard, Opportunity } from "./OpportunityCard";

export interface OpportunityListProps {
  opportunities: Opportunity[];
  onApproveOutreach: (opportunity: Opportunity) => void;
  approvedIds: string[];
}

export function OpportunityList({ opportunities, onApproveOutreach, approvedIds }: OpportunityListProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Here are the top {opportunities.length} opportunities I found:</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((opp, index) => (
          <OpportunityCard
            key={index}
            opportunity={opp}
            onApproveOutreach={onApproveOutreach}
            isApproved={approvedIds.includes(opp.id)}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">I've queued up 47 more. Would you like to see them or approve outreach for these?</p>
    </div>
  );
}