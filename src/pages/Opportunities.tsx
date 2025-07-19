import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { OpportunityCard, Opportunity } from "@/components/OpportunityCard";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const storedOpportunities = sessionStorage.getItem('allOpportunities');
    const storedApprovedIds = JSON.parse(sessionStorage.getItem('approvedOpportunityIds') || '[]');
    setApprovedIds(storedApprovedIds);

    if (storedOpportunities) {
      const opps = JSON.parse(storedOpportunities);
      const oppsWithIds = opps.map((opp: Opportunity) => ({
        ...opp,
        id: opp.id || uuidv4(),
      }));
      setOpportunities(oppsWithIds.reverse());
    }
  }, []);

  const handleApproveOutreach = async (opportunity: Opportunity) => {
    const toastId = toast.loading(`Drafting outreach for ${opportunity.companyName}...`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-outreach', {
        body: { opportunity },
      });

      if (error) throw new Error(error.message);

      const existingDrafts = JSON.parse(sessionStorage.getItem('campaignDrafts') || '[]');
      existingDrafts.push(data);
      sessionStorage.setItem('campaignDrafts', JSON.stringify(existingDrafts));

      const newApprovedIds = [...approvedIds, opportunity.id];
      setApprovedIds(newApprovedIds);
      sessionStorage.setItem('approvedOpportunityIds', JSON.stringify(newApprovedIds));

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
      toast.error("Failed to create draft. Please try again.", { id: toastId });
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Opportunities" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {opportunities.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {opportunities.map((opp, index) => (
              <OpportunityCard
                key={index}
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