import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  totalOpportunities: number;
  sentCampaigns: number;
  draftCampaigns: number;
  newLeads: number;
  sentRate: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: opportunities, error: oppsError, count: oppsCount } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);
      if (oppsError) throw oppsError;

      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('status')
        .eq('user_id', user.id);
      if (campaignsError) throw campaignsError;

      const totalOpportunities = oppsCount ?? 0;
      const sentCampaigns = campaigns.filter(c => c.status === 'sent').length;
      const draftCampaigns = campaigns.filter(c => c.status === 'draft').length;
      const totalCampaigns = campaigns.length;
      
      const newLeads = totalOpportunities - totalCampaigns;
      const sentRate = totalCampaigns > 0 ? Math.round((sentCampaigns / totalCampaigns) * 100) : 0;

      setStats({
        totalOpportunities,
        sentCampaigns,
        draftCampaigns,
        newLeads,
        sentRate,
      });

    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refresh: fetchStats };
}