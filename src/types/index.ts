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
  company_name: string;
  role: string;
  subject: string;
  body: string;
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

// Types for the new Chat UI
export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text?: string;
  // We will add more content types here, like deal cards or email previews
}