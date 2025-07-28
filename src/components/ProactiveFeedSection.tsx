import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProactiveOpportunity } from '@/types';
import { toast } from 'sonner';
import { ProactiveOpportunityCard } from '@/components/ProactiveOpportunityCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@supabase/supabase-js';

export function ProactiveFeedSection() {
  const [opportunities, setOpportunities] = useState<ProactiveOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOpp, setProcessingOpp] = useState<{ id: string; type: 'accept' | 'dismiss' } | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchProactiveOpps = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // Don't throw, just exit gracefully if not logged in
        setUser(user);

        const { data, error } = await supabase.functions.invoke('get-enriched-proactive-opportunities');
        if (error) throw error;
        setOpportunities(data.opportunities as ProactiveOpportunity[]);
      } catch (err) {
        console.error("Failed to fetch proactive opportunities:", (err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchProactiveOpps();
  }, []);

  const handleAcceptOpportunity = async (opportunityId: string) => {
    setProcessingOpp({ id: opportunityId, type: 'accept' });
    try {
      const { error } = await supabase.functions.invoke('accept-proactive-opportunity', {
        body: { proactiveOpportunityId: opportunityId }
      });

      if (error) throw new Error(error.message);

      setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
      toast.success("Opportunity accepted!", {
        description: "It has been added to your pipeline's 'Draft' column.",
      });
    } catch (err) {
      toast.error("Failed to accept opportunity", { description: (err as Error).message });
    } finally {
      setProcessingOpp(null);
    }
  };

  const handleDismissOpportunity = async (opportunityId: string) => {
    setProcessingOpp({ id: opportunityId, type: 'dismiss' });
    const { error } = await supabase
      .from('proactive_opportunities')
      .update({ status: 'dismissed' })
      .eq('id', opportunityId);
    
    if (error) {
      toast.error("Failed to dismiss opportunity.");
    } else {
      setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
      toast.info("Opportunity dismissed.");
    }
    setProcessingOpp(null);
  };

  if (loading) {
    return (
      <div className="mb-6">
        <Skeleton className="h-8 w-1/2 mb-4 bg-white/10" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-48 w-full bg-white/10" />
          <Skeleton className="h-48 w-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (!user || opportunities.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-white mb-3">🔥 Hot off the press...</h2>
      <p className="text-sm text-muted-foreground mb-4">Coogi's market scanner found these new opportunities that might fit your profile. Accept them to add them to your pipeline.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {opportunities.map(opp => (
          <ProactiveOpportunityCard
            key={opp.id}
            opportunity={opp}
            onAccept={handleAcceptOpportunity}
            onDismiss={handleDismissOpportunity}
            isAccepting={processingOpp?.id === opp.id && processingOpp?.type === 'accept'}
            isDismissing={processingOpp?.id === opp.id && processingOpp?.type === 'dismiss'}
            currentUserId={user!.id}
          />
        ))}
      </div>
    </div>
  );
}