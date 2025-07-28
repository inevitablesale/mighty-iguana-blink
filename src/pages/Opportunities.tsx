import { useLocation, Link } from 'react-router-dom';
import { Opportunity, SearchParams } from '@/types';
import { DealCard } from '@/components/DealCard';
import { SaveAgentDialog } from '@/components/SaveAgentDialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useState, useMemo } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { PitchModeSheet } from '@/components/PitchModeSheet';

export default function Opportunities() {
  const location = useLocation();
  const { opportunities, searchParams } = (location.state || { opportunities: [], searchParams: null }) as { opportunities: Opportunity[], searchParams: SearchParams };

  const [minScore, setMinScore] = useState(6);
  const [selectedDeal, setSelectedDeal] = useState<Opportunity | null>(null);
  const [isPitchModeOpen, setIsPitchModeOpen] = useState(false);

  const filteredOpportunities = useMemo(() => {
    if (!opportunities) return [];
    // Temporary fix for match_score which is now a percentage
    return opportunities.filter(opp => (opp.match_score / 10) >= minScore);
  }, [opportunities, minScore]);

  const handleDealClick = (deal: Opportunity) => {
    setSelectedDeal(deal);
    setIsPitchModeOpen(true);
  };

  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white">
        <div className="bg-black/20 border border-white/10 p-8 rounded-lg backdrop-blur-sm text-center">
          <h2 className="text-2xl font-bold">No Opportunities Found</h2>
          <p className="text-white/80 mt-2">There was an issue loading the opportunities.</p>
          <Button asChild variant="link" className="mt-4 text-white">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Deal Stream
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <header className="mb-6 pb-6 border-b border-white/20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Deal Flow</h1>
            <p className="text-white/80 mt-1 max-w-xl">
              Found {opportunities.length} opportunities for: <span className="font-semibold text-white">{searchParams?.recruiter_specialty}</span>
            </p>
          </div>
          {searchParams && (
            <SaveAgentDialog searchParams={searchParams}>
              <Button size="lg">
                <Save className="mr-2 h-4 w-4" />
                Automate this Search
              </Button>
            </SaveAgentDialog>
          )}
        </div>
        <div className="max-w-5xl mx-auto mt-6">
          <Label htmlFor="min-score-slider" className="text-white">Filter by Minimum Match Score: <span className="font-bold">{minScore}</span></Label>
          <Slider
            id="min-score-slider"
            min={1}
            max={10}
            step={1}
            value={[minScore]}
            onValueChange={(value) => setMinScore(value[0])}
            className="mt-2"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {filteredOpportunities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpportunities.map((opp) => (
                <DealCard key={opp.id} opportunity={opp} onClick={handleDealClick} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-black/20 border border-dashed border-white/10 rounded-lg backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white">No opportunities match your filter</h3>
              <p className="text-white/70 mt-2">Try adjusting the match score slider above.</p>
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