import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

interface PredictiveLead {
  companyName: string;
  signalType: 'funding' | 'expansion' | 'hiring_trend';
  signalStrength: number;
  predictedRoles: string[];
}

export function usePredictiveLeads() {
  const [leads, setLeads] = useState<PredictiveLead[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('proactive-search', {
        body: { profile: "recruiter-profile" }
      });
      
      if (error) throw error;
      setLeads(data.opportunities);
    } catch (err) {
      showError("Failed to load predictive leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return { leads, loading, refresh: fetchLeads };
}