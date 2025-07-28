import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Opportunity, SearchParams } from '@/types';
import { toast } from 'sonner';
import { DealCard } from '@/components/DealCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { SaveAgentDialog } from '@/components/SaveAgentDialog';
import { Bot, Loader2 } from 'lucide-react';
import { PitchModeSheet } from '@/components/PitchModeSheet';

export default function Market() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesizedParams, setSynthesizedParams] = useState<SearchParams | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Opportunity | null>(null);
  const [isPitchModeOpen, setIsPitchModeOpen] = useState(false);

  useEffect(() => {
    const fetchOpportunities = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-featured-opportunities');
        if (error) throw error;
        
        // Map to deal structure
        const deals = (data.opportunities || []).map((d: any) => ({
            ...d,
            deal_signals: [
                { type: 'Urgency', value: d.hiring_urgency, description: 'The company is showing signs of needing to hire quickly.' },
                { type: 'Budget', value: d.contract_value_assessment, description: 'This is an estimate of the potential placement fee.' }
            ],
            ta_team_status: 'Unknown',
            match_score: d.match_score || 75,
        }));
        setOpportunities(deals);

      } catch (err) {
        toast.error("Failed to fetch market opportunities", { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchOpportunities();
  }, []);

  const handleSynthesize = async () => {
    if (opportunities.length === 0) {
      toast.info("No opportunities to analyze.");
      return;
    }
    setIsSynthesizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('synthesize-opportunities-for-agent', {
        body: { opportunities },
      });
      if (error) throw error;
      setSynthesizedParams(data);
      toast.success("Agent prompt created!", { description: "You can now save this as a new agent."});
    } catch (err) {
      toast.error("Failed to create agent prompt", { description: (err as Error).message });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleDealClick = (deal: Opportunity) => {
    setSelectedDeal(deal);
    setIsPitchModeOpen(true);
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <header className="mb-6 pb-6 border-b border-white/20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Market Intelligence</h1>
            <p className="text-white/80 mt-1 max-w-xl">
              High-potential opportunities discovered by Coogi's market scanner in the last 24 hours.
            </p>
          </div>
          <SaveAgentDialog searchParams={synthesizedParams}>
            <Button size="lg" onClick={handleSynthesize} disabled={isSynthesizing || loading || opportunities.length === 0}>
              {isSynthesizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
              Create Agent from Intel
            </Button>
          </SaveAgentDialog>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full bg-white/10" />)}
            </div>
          ) : opportunities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {opportunities.map((opp) => (
                <DealCard key={opp.id} opportunity={opp} onClick={handleDealClick} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-black/20 border border-dashed border-white/10 rounded-lg backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white">No Hot Opportunities Right Now</h3>
              <p className="text-white/70 mt-2">The market scanner hasn't found any high-value public opportunities in the last day. Check back soon.</p>
            </div>
          )}
        </div>
      </div>
      <PitchModeSheet
        opportunity={selectedDeal}
        isOpen={isPitchModeOpen}
        onOpenChange={setIsPitchModeOpen}
      />
    </div>
  );
}