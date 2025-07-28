import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Opportunity } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { DealCard } from '@/components/DealCard';
import { DealStreamFilters, Filters } from '@/components/DealStreamFilters';
import { Button } from '@/components/ui/button';
import { Bot, Settings } from 'lucide-react';

const initialFilters: Filters = {
  urgency: 'All',
};

export default function DealStream() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(initialFilters);

  useEffect(() => {
    const fetchFeaturedOpportunities = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-featured-opportunities');
        if (error) throw error;
        setOpportunities(data.opportunities || []);
      } catch (err) {
        toast.error("Failed to fetch featured deals", { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchFeaturedOpportunities();
  }, []);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      if (filters.urgency !== 'All' && opp.hiring_urgency !== filters.urgency) return false;
      return true;
    });
  }, [opportunities, filters]);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <header className="mb-6 pb-6 border-b border-white/20">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white">Your AI-Curated Deal Stream</h1>
          <p className="text-white/80 mt-1 max-w-2xl">
            These are the highest-potential deals on the market right now, analyzed and enriched by Coogi. New deals are added daily.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary">
              <Bot className="mr-2 h-4 w-4" />
              Refine Your Recommendations
            </Button>
            <Button variant="ghost">
              <Settings className="mr-2 h-4 w-4" />
              Manage Agents
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <DealStreamFilters filters={filters} onFilterChange={setFilters} onReset={() => setFilters(initialFilters)} />
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 w-full bg-white/10" />)}
            </div>
          ) : filteredOpportunities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredOpportunities.map((opp) => (
                <DealCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-black/20 border border-dashed border-white/10 rounded-lg backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white">No Deals Match Your Filters</h3>
              <p className="text-white/70 mt-2">Try adjusting or resetting the filters to see more opportunities.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}