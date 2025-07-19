import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { OpportunityList } from "@/components/OpportunityList";
import { Opportunity } from "@/components/OpportunityCard";
import { SearchParameters } from "@/components/SearchParameters";
import { Bot, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { usePredictiveLeads } from "@/hooks/usePredictiveLeads";
import { PredictiveLeads } from "@/components/PredictiveLeads";

interface ProcessedCommand {
  searchCriteria: {
    role?: string | null;
    location?: string | null;
    quantity?: number | null;
    vertical?: string | null;
    keywords?: string[] | null;
  };
  opportunities: Opportunity[];
}

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [processedCommand, setProcessedCommand] = useState<ProcessedCommand | null>(null);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { leads, loading: leadsLoading } = usePredictiveLeads();

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('opportunity_id')
        .eq('user_id', user.id);
      
      if (campaignsError) {
        console.error("Error fetching campaigns:", campaignsError);
      } else {
        setApprovedIds(campaignsData.map(c => c.opportunity_id));
      }
    };
    fetchInitialData();
  }, []);

  const handleSendCommand = async (command: string) => {
    setIsLoading(true);
    setProcessedCommand(null);
    const toastId = toast.loading("Finding opportunities...");

    try {
      const { data, error } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (error) throw new Error(error.message);

      const opportunitiesWithIds = data.opportunities.map((opp: any) => ({ ...opp, id: uuidv4() }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const opportunitiesToInsert = opportunitiesWithIds.map((opp: any) => ({
        id: opp.id,
        user_id: user.id,
        company_name: opp.companyName,
        role: opp.role,
        location: opp.location,
        potential: opp.potential,
        hiring_urgency: opp.hiringUrgency,
        match_score: opp.matchScore,
        key_signal: opp.keySignal,
      }));

      const { error: insertError } = await supabase.from('opportunities').insert(opportunitiesToInsert);
      if (insertError) throw new Error(insertError.message);

      setProcessedCommand({ ...data, opportunities: opportunitiesWithIds });
      toast.success("Found new opportunities!", { id: toastId });
    } catch (e) {
      const err = e as Error;
      console.error("Error processing command:", err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

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

  const isInitialView = !isLoading && !processedCommand;

  return (
    <div className="flex flex-col h-screen">
      <Header title="Dashboard" />
      <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-6">
        <DashboardMetrics />
        
        <div className="flex-1 flex flex-col justify-center">
          {isLoading && (
            <div className="flex flex-col items-center gap-2 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold tracking-tight">Finding Opportunities...</h2>
              <p className="text-sm text-muted-foreground">The AI is analyzing the market for you.</p>
            </div>
          )}

          {isInitialView && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full p-6">
              {leadsLoading ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <h2 className="text-xl font-semibold tracking-tight">Searching for Proactive Leads...</h2>
                  <p className="text-sm text-muted-foreground">Your agents are on the lookout.</p>
                </div>
              ) : leads.length > 0 ? (
                <PredictiveLeads leads={leads} />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Bot className="h-12 w-12 text-primary" />
                  <h2 className="text-2xl font-bold tracking-tight">Welcome to Coogi</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Your AI recruiting intelligence platform. Use the command bar below or{" "}
                    <Link to="/agents" className="underline text-primary">set up your agents</Link>
                    {" "}for automated searches.
                  </p>
                </div>
              )}
            </div>
          )}

          {processedCommand && (
            <div className="space-y-6">
              <SearchParameters params={processedCommand.searchCriteria} />
              <OpportunityList 
                opportunities={processedCommand.opportunities}
                onApproveOutreach={handleApproveOutreach}
                approvedIds={approvedIds}
              />
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          <CommandBar onSendCommand={handleSendCommand} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
}