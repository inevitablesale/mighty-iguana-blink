import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProactiveOpportunity } from '@/types';
import { toast } from 'sonner';
import { ProactiveOpportunityCard } from '@/components/ProactiveOpportunityCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfile } from '@/hooks/useUserProfile';

export default function CommunityBounties() {
  const [opportunities, setOpportunities] = useState<ProactiveOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user } = useUserProfile();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOpportunities = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-enriched-proactive-opportunities');
        if (error) throw error;
        setOpportunities(data.opportunities || []);
      } catch (err) {
        toast.error("Failed to fetch market opportunities", { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchOpportunities();
  }, []);

  const handleAccept = async (opportunityId: string) => {
    setProcessingId(opportunityId);
    try {
      const { data, error } = await supabase.functions.invoke('accept-proactive-opportunity', {
        body: { proactiveOpportunityId: opportunityId },
      });
      if (error) throw error;
      
      toast.success("Deal accepted and added to your campaigns!", {
        description: `The ${data.campaign.company_name} opportunity is now in your drafts.`,
        action: {
          label: "View Campaigns",
          onClick: () => navigate('/campaigns'),
        },
      });
      setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    } catch (err) {
      toast.error("Failed to accept deal", { description: (err as Error).message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (opportunityId: string) => {
    // For now, this just removes it from the view. A more robust solution
    // would persist this dismissal per-user.
    setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    toast.info("Opportunity dismissed from your view.");
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <header className="mb-6 pb-6 border-b border-white/20">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-white">Community Bounties</h1>
          <p className="text-white/80 mt-1 max-w-xl">
            High-potential opportunities discovered by Coogi's market scanner. These are available to all users until accepted.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-72 w-full bg-white/10" />)}
            </div>
          ) : opportunities.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {opportunities.map((opp) => (
                <ProactiveOpportunityCard 
                  key={opp.id} 
                  opportunity={opp}
                  onAccept={handleAccept}
                  onDismiss={handleDismiss}
                  isAccepting={processingId === opp.id}
                  isDismissing={false} // Not implementing a separate loading state for dismiss
                  currentUserId={user?.id || ''}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-black/20 border border-dashed border-white/10 rounded-lg backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white">No Hot Opportunities Right Now</h3>
              <p className="text-white/70 mt-2">The market scanner hasn't found any high-value public opportunities. Check back soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}