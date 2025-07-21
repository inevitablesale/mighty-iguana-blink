import { OpportunityCard } from "./OpportunityCard";
import { Opportunity, Agent } from "@/types/index";

export interface OpportunityListProps {
  agent: Agent;
  opportunities: Opportunity[];
  onApproveOutreach: (opportunity: Opportunity) => void;
  processedOppIds: Set<string>;
  approvingId: string | null;
}

export function OpportunityList({ agent, opportunities, onApproveOutreach, processedOppIds, approvingId }: OpportunityListProps) {
  return (
    <div className="space-y-6">
      <div className="coogi-gradient-bg p-4 rounded-lg">
        <h2 className="text-2xl font-bold text-primary-foreground">{agent.name}</h2>
        <p className="text-sm text-primary-foreground/80">This agent found {opportunities.length} high-potential opportunities based on its specialty: "{agent.prompt}"</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onApproveOutreach={onApproveOutreach}
            isApproved={processedOppIds.has(opp.id)}
            isApproving={approvingId === opp.id}
          />
        ))}
      </div>
    </div>
  );
}