import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DashboardStats {
  totalOpportunities: number;
  outreachDrafted: number;
  outreachSent: number;
  approvalRate: number;
  totalPlacements: number;
  totalRevenue: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStats(null);
        return;
      }

      // Fetch opportunities
      const { count: oppCount, error: oppError } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (oppError) throw oppError;

      // Fetch campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('status')
        .eq('user_id', user.id);
      if (campaignsError) throw campaignsError;

      // Fetch placements
      const { data: placements, error: placementsError } = await supabase
        .from('placements')
        .select('fee_amount')
        .eq('user_id', user.id);
      if (placementsError) throw placementsError;

      // Calculate stats
      const totalOpportunities = oppCount || 0;
      const outreachDrafted = campaigns?.filter(c => c.status === 'draft').length || 0;
      const outreachSent = campaigns?.filter(c => c.status === 'sent').length || 0;
      const totalCampaigns = campaigns?.length || 0;
      const approvalRate = totalOpportunities > 0 ? (totalCampaigns / totalOpportunities) * 100 : 0;
      const totalPlacements = placements?.length || 0;
      const totalRevenue = placements?.reduce((sum, p) => sum + (p.fee_amount || 0), 0) || 0;

      setStats({
        totalOpportunities,
        outreachDrafted,
        outreachSent,
        approvalRate: Math.round(approvalRate),
        totalPlacements,
        totalRevenue,
      });

    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast.error("Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refresh: fetchStats };
}