import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProactiveOpportunity, Opportunity } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ProactiveOpportunityCard } from './ProactiveOpportunityCard';
import { OpportunityCard } from './OpportunityCard';
import { Radar, Sparkles } from 'lucide-react';

export function MarketRadar() {
  const [proactiveOpportunities, setProactiveOpportunities] = useState<ProactiveOpportunity[]>([]);
  const [featuredOpportunities, setFeaturedOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'dismiss' | null>(null);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setProactiveOpportunities([]);
    setFeaturedOpportunities([]);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { data: featuredData, error: featuredError } = await supabase.functions.invoke('get-featured-opportunities');
        if (featuredError) throw featuredError;
        if (featuredData.opportunities) setFeaturedOpportunities(featuredData.opportunities);
        return;
      }

      const { data: proactiveData, error: proactiveError } = await supabase
        .from('proactive_opportunities')
        .select('id, relevance_reasoning, relevance_score, job_data, user_id')
        .eq('user_id', user.id)
        .eq('status', 'reviewed')
        .order('relevance_score', { ascending: false })
        .limit(5);

      if (proactiveError) throw proactiveError;

      if (proactiveData && proactiveData.length > 0) {
        setProactiveOpportunities(proactiveData as ProactiveOpportunity[]);
      } else {
        const { data: featuredData, error: featuredError } = await supabase.functions.invoke('get-featured-opportunities');
        if (featuredError) throw featuredError;
        if (featuredData.opportunities) {
          setFeaturedOpportunities(featuredData.opportunities);
        }
      }
    } catch (err) {
      // Silently fail, as the component will just not render if empty.
      console.error("Failed to fetch market opportunities", (err as Error).message);
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
      const { error } = await supabase.from('proactive_opportunities').update({ status: 'accepted' }).eq('id', opportunityId);
      if (error) throw error;
      toast.success("Opportunity accepted!", { description: "It has been moved to your main pipeline for enrichment." });
      setProactiveOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
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
      setProactiveOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    } catch (err) {
      toast.error("Failed to dismiss opportunity", { description: (err as Error).message });
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  const hasProactive = proactiveOpportunities.length > 0;
  const hasFeatured = featuredOpportunities.length > 0;

  const Title = () => (
    <div className="flex items-center gap-3 mb-4">
      {hasProactive ? <Radar className="h-7 w-7 text-primary" /> : <Sparkles className="h-7 w-7 text-primary" />}
      <div>
        <h2 className="text-xl font-bold text-white">{hasProactive ? "Market Radar" : "Today's Top Opportunities"}</h2>
        <p className="text-sm text-white/70">{hasProactive ? "High-value opportunities we found for you based on your profile." : "A look at high-value roles currently on the market."}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Radar className="h-7 w-7 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-white">Scanning the Market...</h2>
            <p className="text-sm text-white/70">Finding the best opportunities for you.</p>
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

  if (!hasProactive && !hasFeatured) {
    return null;
  }

  return (
    <div className="mb-8">
      <Title />
      {hasProactive ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proactiveOpportunities.map(opp => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredOpportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      )}
    </div>
  );
}