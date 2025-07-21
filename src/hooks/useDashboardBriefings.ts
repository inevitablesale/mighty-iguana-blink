import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Agent, Opportunity } from '@/types';
import { toast } from 'sonner';

export interface AgentBriefing {
  agent: Agent;
  opportunities: Opportunity[];
}

export function useDashboardBriefings() {
  const [briefings, setBriefings] = useState<AgentBriefing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBriefings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBriefings([]);
        setLoading(false);
        return;
      }

      const [oppsRes, campaignsRes, agentsRes] = await Promise.all([
        supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('campaigns').select('opportunity_id').eq('user_id', user.id),
        supabase.from('agents').select('*').eq('user_id', user.id)
      ]);

      if (oppsRes.error || agentsRes.error || campaignsRes.error) {
        throw new Error(oppsRes.error?.message || agentsRes.error?.message || campaignsRes.error?.message || "Failed to fetch data");
      }

      const processedOppIds = new Set(campaignsRes.data.map(c => c.opportunity_id).filter(Boolean));
      
      const allOpps: Opportunity[] = oppsRes.data.map((o: any) => ({
        id: o.id, agent_id: o.agent_id, companyName: o.company_name, role: o.role, location: o.location || 'N/A',
        matchScore: o.match_score || 0, company_overview: o.company_overview || 'N/A',
        contract_value_assessment: o.contract_value_assessment || 'N/A', hiring_urgency: o.hiring_urgency || 'N/A',
        pain_points: o.pain_points || 'N/A', recruiter_angle: o.recruiter_angle || 'N/A',
        key_signal_for_outreach: o.key_signal_for_outreach || 'N/A',
      }));

      const unreviewedOpps = allOpps.filter(opp => !processedOppIds.has(opp.id));

      const groupedOpps = new Map<string, Opportunity[]>();
      unreviewedOpps.forEach(opp => {
        if (opp.agent_id) {
          const agentOpps = groupedOpps.get(opp.agent_id) || [];
          agentOpps.push(opp);
          groupedOpps.set(opp.agent_id, agentOpps);
        }
      });

      const agentBriefings: AgentBriefing[] = agentsRes.data
        .map(agent => {
          const opportunities = groupedOpps.get(agent.id) || [];
          if (opportunities.length > 0) {
            // Sort opportunities by match score descending
            opportunities.sort((a, b) => b.matchScore - a.matchScore);
            return { agent, opportunities };
          }
          return null;
        })
        .filter((b): b is AgentBriefing => b !== null);

      setBriefings(agentBriefings);

    } catch (error) {
      console.error("Error fetching dashboard briefings:", error);
      toast.error("Failed to load agent briefings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefings();
  }, [fetchBriefings]);

  return { briefings, loading, refresh: fetchBriefings };
}