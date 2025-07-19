export type OpportunityPotential = "High" | "Medium" | "Low";

export interface Opportunity {
  id: string;
  companyName: string;
  role: string;
  location: string;
  potential: OpportunityPotential;
  hiringUrgency: OpportunityPotential;
  matchScore: number;
  keySignal: string;
}

export interface SearchCriteria {
  role?: string | null;
  location?: string | null;
  quantity?: number | null;
  vertical?: string | null;
  keywords?: string[] | null;
}

export interface ProcessedCommand {
  searchCriteria: SearchCriteria;
  opportunities: Opportunity[];
}

export type CampaignStatus = 'draft' | 'sent' | 'replied' | 'meeting' | 'closed' | 'placed';

export interface Campaign {
  id: string;
  company_name: string;
  role: string;
  linkedin_message: string;
  status: CampaignStatus;
}

export interface Agent {
  id: string;
  name: string;
  prompt: string;
}

export interface PredictiveLead {
  companyName: string;
  signalType: 'funding' | 'expansion' | 'hiring_trend';
  signalStrength: number;
  predictedRoles: string[];
}

export type PlacementStatus = 'active' | 'completed' | 'cancelled';

export interface Placement {
  id:string;
  campaign_id: string;
  candidate_name: string;
  start_date: string | null;
  fee_amount: number | null;
  status: PlacementStatus;
  campaigns?: {
    company_name: string;
    role: string;
  }
}

export interface CompanyBriefing {
  overview: string;
  recentNews: string;
  keyPersonnel: string;
  techStack: string;
  hiringAnalysis: string;
}

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived';

export interface Proposal {
  id: string;
  campaign_id: string;
  status: ProposalStatus;
  fee_structure: string | null;
  generated_body: string | null;
  created_at: string;
  campaigns?: {
    company_name: string;
    role: string;
  }
}