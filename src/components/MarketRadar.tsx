import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProactiveOpportunity } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ProactiveOpportunityCard } from './ProactiveOpportunityCard';
import { Radar } from 'lucide-react';

export function MarketRadar() {
  const [opportunities, setOpportunities] = useState<ProactiveOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'dismiss' | null>(null);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('proactive_opportunities')
        .select('id, relevance_reasoning, relevance_score, job_data, user_id')
        .eq('user_id', user.id)
        .eq('status', 'reviewed')
        .order('relevance_score', { ascending: false })
        .limit(5);

      if (error) throw error;
      setOpportunities(data as ProactiveOpportunity[]);
    } catch (err) {
      toast.error("Failed to fetch market radar opportunities", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleAccept = async (opportunityId: string) => {
    setProcessingId(opportunityId);
    setActionType('accept');
    try {
      // This will be implemented in Phase 4
      // For now, we just simulate the action
      await new Promise(res => setTimeout(res, 1000)); // Simulate network delay
      
      // Placeholder for accept logic
      const { error } = await supabase.from('proactive_opportunities').update({ status: 'accepted' }).eq('id', opportunityId);
      if (error) throw error;

      toast.success("Opportunity accepted!", { description: "It has been moved to your main pipeline for enrichment." });
      setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    } catch (err) {
      toast.error("Failed to accept opportunity", { description: (err as Error).message });
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  const handleDismiss = async (opportunityId: string) => {
    setProcessingId(opportunityId);
    setActionType('dismiss');
    try {
      const { error } = await supabase.from('proactive_opportunities').update({ status: 'dismissed' }).eq('id', opportunityId);
      if (error) throw error;
      toast.info("Opportunity dismissed.");
      setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    } catch (err) {
      toast.error("Failed to dismiss opportunity", { description: (err as Error).message });
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Radar className="h-7 w-7 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-white">Market Radar</h2>
            <p className="text-sm text-white/70">High-value opportunities we found for you based on your profile.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mb-8">
      <div className="flex items-center gap-3 mb-4">
        <Radar className="h-7 w-7 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-white">Market Radar</h2>
          <p className="text-sm text-white/70">High-value opportunities we found for you based on your profile.</p>
        </div>
      </div>
      {opportunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {opportunities.map(opp => (
            <ProactiveOpportunityCard 
              key={opp.id} 
              opportunity={opp}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
              isAccepting={processingId === opp.id && actionType === 'accept'}
              isDismissing={processingId === opp.id && actionType === 'dismiss'}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 border border-dashed border-white/20 rounded-lg bg-black/10">
          <h3 className="text-lg font-semibold text-white">Scanning the Market...</h3>
          <p className="text-white/70 mt-2 max-w-md mx-auto text-sm">
            The radar is currently empty. As you save agents, we'll learn your preferences and automatically surface relevant opportunities here.
          </p>
        </div>
      )}
    </div>
  );
}