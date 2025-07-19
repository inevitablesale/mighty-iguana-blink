import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { CandidateCard, Candidate } from "@/components/CandidateCard";
import { Opportunity } from "@/components/OpportunityCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const CandidatesPage = () => {
  const { opportunityId } = useParams();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!opportunityId) {
      toast.error("Opportunity ID is missing.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const { data: oppData, error: oppError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single();

      if (oppError) {
        console.error("Error fetching opportunity:", oppError);
        toast.error("Failed to load opportunity details.");
      } else {
        setOpportunity({
          ...oppData, 
          companyName: oppData.company_name, 
          hiringUrgency: oppData.hiring_urgency, 
          matchScore: oppData.match_score, 
          keySignal: oppData.key_signal
        } as Opportunity);
      }

      const { data: candData, error: candError } = await supabase
        .from('candidates')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('match_score', { ascending: false });

      if (candError) {
        console.error("Error fetching candidates:", candError);
        toast.error("Failed to load candidates.");
      } else {
        setCandidates(candData as Candidate[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [opportunityId]);

  const renderLoadingState = () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <Header title="Sourced Candidates" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {loading ? (
          renderLoadingState()
        ) : opportunity ? (
          <div>
            <div className="mb-4">
              <Button variant="outline" asChild>
                <Link to="/opportunities">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Opportunities
                </Link>
              </Button>
            </div>
            <h2 className="text-2xl font-semibold">
              Candidates for {opportunity.role} at {opportunity.companyName}
            </h2>
            <p className="text-muted-foreground mb-6">
              Here are the top candidates sourced by the AI.
            </p>
            {candidates.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {candidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Users className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">
                    No Candidates Sourced Yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Click "Source Candidates" on an opportunity to begin.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p>Opportunity not found.</p>
        )}
      </main>
    </div>
  );
};

export default CandidatesPage;