import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

export interface PredictiveLead {
  companyName: string;
  signalType: 'funding' | 'expansion' | 'hiring_trend';
  signalStrength: number;
  predictedRoles: string[];
}

export function usePredictiveLeads() {
  const [leads, setLeads] = useState<PredictiveLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLeads([]);
          setLoading(false);
          return;
        }

        const { data: agents, error: agentsError } = await supabase
          .from('agents')
          .select('prompt')
          .eq('user_id', user.id);

        if (agentsError) throw agentsError;

        const agentPrompts = agents.map(a => a.prompt);

        if (agentPrompts.length === 0) {
          setLeads([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('proactive-search', {
          body: { agentPrompts }
        });
        
        if (error) throw error;
        setLeads(data.leads || []);
      } catch (err) {
        const error = err as Error;
        showError(`Failed to load predictive leads: ${error.message}`);
        setLeads([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  return { leads, loading, refresh: () => {} };
}