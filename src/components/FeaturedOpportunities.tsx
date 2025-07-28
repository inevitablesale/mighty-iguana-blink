import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Opportunity } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { OpportunityCard } from './OpportunityCard';
import { Sparkles } from 'lucide-react';

export function FeaturedOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOpportunities = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-featured-opportunities');
        if (error) throw new Error(error.message);
        if (data.opportunities) {
          setOpportunities(data.opportunities);
        }
      } catch (err) {
        // Silently fail for this component
        console.error("Could not load featured opportunities:", (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  if (loading) {
    return (
      <div className="pt-8">
        <Skeleton className="h-8 w-72 mx-auto mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return null;
  }

  return (
    <div className="pt-8">
      <div className="text-center mb-4">
        <h2 className="text-lg font-medium text-white/80 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Today's Top Opportunities
        </h2>
        <p className="text-sm text-white/60">A look at high-value roles currently on the market.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>
    </div>
  );
}