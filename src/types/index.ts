export interface Opportunity {
  id: string;
  agent_id: string;
  company_name: string; // Changed from companyName
  role: string;
  location: string;
  match_score: number; // Changed from matchScore
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

export type AutonomyLevel = 'manual' | 'semi-automatic' | 'automatic';

export interface Playbook {
  id: string;
  name: string;
  prompt: string;
  last_run_at?: string;
  autonomy_level: AutonomyLevel;
  search_lookback_hours: number;
  max_results: number;
  job_type?: string | null;
  is_remote?: boolean;
  country?: string | null;
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

export interface NewsItem {
  title: string;
  source: string;
  date: string;
}

export interface CompanyBriefing {
  overview: string;
  recentNews: NewsItem[];
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