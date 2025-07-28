import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Opportunity } from '@/types';
import { toast } from 'sonner';
import { DealCard } from '@/components/DealCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { PitchModeSheet } from '@/components/PitchModeSheet';

// This is a placeholder for the real implementation of fetching deals.
// In a real scenario, this would call a dedicated 'get-deal-stream' Edge Function.
const fetchDeals = async (): Promise<Opportunity[]> => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .limit(10)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  // This is a temporary mapping to the new data structure.
  // The backend function will provide this structure directly.
  return (data as any[]).map(d => ({
    ...d,
    deal_signals: [
        { type: 'Urgency', value: d.hiring_urgency || 'Medium', description: 'The company is showing signs of needing to hire quickly.' },
        { type: 'Budget', value: d.contract_value_assessment || 'Est. Fee: $25,000', description: 'This is an estimate of the potential placement fee.' }
    ],
    ta_team_status: 'Unknown',
    match_score: d.match_score || 75,
    primary_contact: {
        name: 'Jane Doe',
        title: 'VP of Engineering',
        email: 'jane.doe@example.com',
        email_confidence: 'Verified',
        reason: 'Likely Direct Manager'
    }
  }));
};


export default function DealStream() {
  const [deals, setDeals] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Opportunity | null>(null);
  const [isPitchModeOpen, setIsPitchModeOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchDeals()
      .then(setDeals)
      .catch(err => toast.error("Failed to fetch deal stream", { description: (err as Error).message }))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSearching) return;
    
    setIsSearching(true);
    toast.info("Searching for new deals...", { description: "This may take a moment." });

    // Placeholder for calling the 'process-chat-command' function
    // and getting back new deals to prepend to the stream.
    setTimeout(() => {
        toast.success("Found new deals!", { description: "They have been added to the top of your stream." });
        setIsSearching(false);
        setInput('');
    }, 2000);
  };

  const handleDealClick = (deal: Opportunity) => {
    setSelectedDeal(deal);
    setIsPitchModeOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-white/10 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSearch} className="relative">
              <Textarea
                placeholder="Find new deals... e.g., 'Series A fintechs in NY hiring sales leaders'"
                className="min-h-[48px] rounded-2xl resize-none p-4 pr-16 bg-black/30 border-white/20 text-white placeholder:text-white/60"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    handleSearch(e);
                  }
                }}
                disabled={isSearching}
              />
              <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex items-center">
                <Button type="submit" size="icon" variant="ghost" disabled={isSearching || !input.trim()}>
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  <span className="sr-only">Search</span>
                </Button>
              </div>
            </form>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {loading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-48 w-full bg-white/10" />)
          ) : (
            deals.map(deal => <DealCard key={deal.id} opportunity={deal} onClick={handleDealClick} />)
          )}
        </div>
      </main>
      <PitchModeSheet 
        opportunity={selectedDeal}
        isOpen={isPitchModeOpen}
        onOpenChange={setIsPitchModeOpen}
      />
    </div>
  );
}