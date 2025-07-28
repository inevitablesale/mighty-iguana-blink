import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Campaign } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { CampaignsTable } from '@/components/CampaignsTable';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data);
    } catch (err) {
      toast.error("Failed to fetch campaigns", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white">Campaigns</h1>
          <p className="text-white/80 mt-1">
            Track the status of all your outreach efforts and manage your pipeline.
          </p>
        </header>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : campaigns.length > 0 ? (
          <CampaignsTable campaigns={campaigns} />
        ) : (
          <div className="text-center py-16 border border-dashed border-white/20 rounded-lg">
            <h3 className="text-xl font-semibold text-white">No Campaigns Found</h3>
            <p className="text-white/70 mt-2">
              Start a new campaign by finding an opportunity in the main chat window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}