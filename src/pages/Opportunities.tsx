import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { OpportunityCard, Opportunity } from "@/components/OpportunityCard";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: oppsData, error: oppsError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (oppsError) {
        console.error("Error fetching opportunities:", oppsError);
        toast.error("Failed to load opportunities.");
      } else {
        setOpportunities(oppsData.map(o => ({...o, companyName: o.company_name, hiringUrgency: o.hiring_urgency, matchScore: o.match_score, keySignal: o.key_signal} as Opportunity)));
      }

      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('opportunity_id')
        .eq('user_id', user.id);
      
      if (campaignsError) {
        console.error("Error fetching campaigns:", campaignsError);
      } else {
        setApprovedIds(campaignsData.map(c => c.opportunity_id));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleApproveOutreach = async (opportunity: Opportunity) => {
    const toastId = toast.loading(`Drafting outreach for ${opportunity.companyName}...`);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('prompt')
        .eq('user_id', user.id);
      
      if (agentsError) throw agentsError;

      const recruiterSpecialty = agents.map(a => a.prompt).join(', ');

      const { data, error } = await supabase.functions.invoke('generate-outreach', {
        body: { opportunity, recruiterSpecialty },
      });

      if (error) throw new Error(error.message);

      const { draft, companyName, role } = data;
      const { error: insertError } = await supabase.from('campaigns').insert({
        user_id: user.id,
        opportunity_id: opportunity.id,
        company_name: companyName,
        role,
        subject: draft.subject,
        body: draft.body,
      });

      if (insertError) throw new Error(insertError.message);

      setApprovedIds(prev => [...prev, opportunity.id]);

      toast.success(`Draft created for ${opportunity.companyName}!`, {
        id: toastId,
        description: "You can now review the draft in the Campaigns tab.",
        action: {
          label: "View Drafts",
          onClick: () => navigate('/campaigns'),
        },
      });
    } catch (e) {
      const error = e as Error;
      console.error("Error generating outreach:", error);
      toast.error(error.message, { id: toastId });
    }
  };

  const renderLoadingState = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="p-4 border rounded-lg space-y-4 bg-card">
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex space-x-2 pt-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col">
      <Header title="Opportunities" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {loading ? (
          renderLoadingState()
        ) : opportunities.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                onApproveOutreach={handleApproveOutreach}
                isApproved={approvedIds.includes(opp.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-1 text-center">
              <Target className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-2xl font-bold tracking-tight">
                No Opportunities Found Yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Use the dashboard to find your first opportunity.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Opportunities;