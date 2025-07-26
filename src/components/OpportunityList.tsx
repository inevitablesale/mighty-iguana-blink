import { OpportunityCard } from "./OpportunityCard";
import { Opportunity, Agent, Contact } from "@/types/index";

export interface OpportunityListProps {
  agent: Agent;
  opportunities: Opportunity[];
  contactsByOppId: Map<string, Contact[]>;
  onGenerateCampaignForContact: (opportunity: Opportunity, contact: Contact) => void;
  onEnrichCompany: (opportunity: Opportunity) => void;
  onFindContacts: (opportunity: Opportunity) => void;
  generatingCampaignForContactId: string | null;
}

export function OpportunityList({ agent, opportunities, contactsByOppId, onGenerateCampaignForContact, onEnrichCompany, onFindContacts, generatingCampaignForContactId }: OpportunityListProps) {
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
            contacts={contactsByOppId.get(opp.id) || []}
            onGenerateCampaignForContact={onGenerateCampaignForContact}
            onEnrichCompany={onEnrichCompany}
            onFindContacts={onFindContacts}
            generatingCampaignForContactId={generatingCampaignForContactId}
          />
        ))}
      </div>
    </div>
  );
}