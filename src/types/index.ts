export interface CrunchbaseData {
  name: string;
  categories?: string[];
  company_type?: string;
  num_employees?: string;
  revenue_range?: string;
  [key: string]: any; // Allow other properties
}

export interface Opportunity {
  id: string;
  agent_id: string;
  company_name: string;
  role: string;
  location: string;
  match_score: number;
  company_overview: string;
  contract_value_assessment: string;
  hiring_urgency: string;
  pain_points: string;
  recruiter_angle: string;
  key_signal_for_outreach: string;
  linkedin_url_slug?: string | null;
  placement_difficulty: string;
  company_data_scraped?: CrunchbaseData | null;
  estimated_time_to_fill?: string | null;
  client_demand_signal?: string | null;
  location_flexibility?: string | null;
  seniority_level?: string | null;
  likely_decision_maker?: string | null;
}

export interface ProactiveOpportunity {
  id: string;
  relevance_reasoning: string;
  relevance_score: number;
  job_data: {
    company: string;
    title: string;
    location: string;
    description: string;
  };
  user_id: string | null;
}

export interface Contact {
  id: string;
  task_id: string;
  opportunity_id: string;
  user_id: string;
  name: string | null;
  job_title: string | null;
  linkedin_profile_url: string | null;
  created_at: string;
  email?: string | null;
  email_status?: string | null;
  phone_number?: string | null;
}

export type CampaignStatus = 'draft' | 'contacted' | 'replied' | 'sourcing' | 'interviewing' | 'hired' | 'archived';

export interface Campaign {
  id: string;
  user_id: string;
  opportunity_id: string;
  company_name: string;
  role: string;
  subject: string | null;
  body: string | null;
  status: CampaignStatus;
  contact_name: string | null;
  contact_email: string | null;
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

export interface SearchParams {
  recruiter_specialty: string;
}

// Types for the new Feed UI
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType = 'chat' | 'agent_run_summary';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  created_at: string;
  content: {
    text?: string;
    opportunities?: Opportunity[];
    searchParams?: SearchParams;
    agentName?: string;
    summary?: string;
  };
  isLoading?: boolean; // Client-side only
}


export interface Agent {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  created_at: string;
  last_run_at: string | null;
  autonomy_level: 'manual' | 'semi-automatic' | 'automatic';
}