export interface DealSignal {
  type: 'Urgency' | 'Strategic' | 'Budget' | 'Resource Gap' | 'Role Type';
  value: string;
  description: string; // e.g., "Why this matters..."
}

export interface ContactIntel {
  name: string;
  title: string;
  linkedin_url?: string;
  email?: string;
  email_confidence?: 'Verified' | 'Unverified' | 'Guessed';
  phone?: string;
  reason: string; // "Posted job," "Likely Direct Manager," etc.
}

export interface Opportunity {
  id: string;
  agent_id?: string;
  company_name: string;
  role: string;
  location: string;
  match_score: number; // The overall "Recruiter Fit" score
  
  // Core Deal Intelligence
  company_overview: string;
  contract_value_assessment: string;
  hiring_urgency: string;
  pain_points: string;
  recruiter_angle: string;
  key_signal_for_outreach: string;
  
  // New Signal-Based Data
  deal_signals: DealSignal[];
  ta_team_status: 'No Recruiters' | 'Lean Team' | 'Healthy Team' | 'Unknown';
  
  // Contact & Confidence
  primary_contact?: ContactIntel;
  contact_confidence?: number; // 0-100%
  value_confidence?: number; // 0-100%
  urgency_confidence?: number; // 0-100%

  // Existing fields
  linkedin_url_slug?: string | null;
  placement_difficulty: string;
  company_data_scraped?: any;
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
    date_posted?: string;
  };
  user_id: string | null;
  contract_value_assessment?: string;
  hiring_urgency?: string;
  placement_difficulty?: string;
  seniority_level?: string;
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

export interface EvaluatedContact extends Contact {
  evaluation?: {
    score: number;
    status: string;
    reasoning: string;
  };
  isEvaluating?: boolean;
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
  opportunities?: {
    contract_value_assessment: string;
  } | null;
}

export interface SearchParams {
  recruiter_specialty: string;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  created_at: string;
  last_run_at: string | null;
  autonomy_level: 'manual' | 'semi-automatic' | 'automatic';
  search_lookback_hours: number;
  max_results: number;
  job_type: string | null;
  is_remote: boolean;
  country: string | null;
  site_names: string[];
  distance: number;
  google_search_term?: string | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface AnalysisProgressJob {
  company: string;
  title: string;
  status: 'pending' | 'analyzed';
  match_score?: number;
}

export interface AnalysisProgress {
  jobs: AnalysisProgressJob[];
}

export interface FeedItem {
  id: string;
  user_id: string;
  type: 'agent_run_summary' | 'user_search';
  role: 'system' | 'user';
  content: {
    agentName?: string;
    summary?: string;
    query?: string;
    opportunities?: Opportunity[];
    searchParams?: SearchParams;
    analysisProgress?: AnalysisProgress;
  };
  created_at: string;
  conversation_id?: string;
}