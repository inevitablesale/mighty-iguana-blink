import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { OpportunityList } from "@/components/OpportunityList";
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
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRevenueChartData } from "@/hooks/useRevenueChartData";
import { RevenueChart } from "@/components/RevenueChart";
import { Opportunity, ProcessedCommand, PredictiveLead } from "@/types/index";

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [processedCommand, setProcessedCommand] = useState<ProcessedCommand | null>(null);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { leads, loading: leadsLoading } = usePredictiveLeads();
  const { stats, loading: statsLoading, refresh: refreshStats } = useDashboardStats();
  const { data: chartData, loading: chartLoading, refresh: refreshChart } = useRevenueChartData();
  const [investigatingLead, setInvestigatingLead] = useState<PredictiveLead | null>(null);
  const [investigatedLeads, setInvestigatedLeads] = useState<string[]>([]);

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
  
  const refreshAllStats = () => {
    refreshStats();
    refreshChart();
  }

  const handleSendCommand = async (command: string) => {
    setIsLoading(true);
    setProcessedCommand(null);
    const toastId = toast.loading("Finding opportunities...");

    try {
      const { data, error } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (error) throw new Error(error.message);

      const opportunitiesWithIds = data.opportunities.map((opp: Omit<Opportunity, 'id'>) => ({ ...opp, id: uuidv4() }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const opportunitiesToInsert = opportunitiesWithIds.map((opp: Opportunity) => ({
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

      setProcessedCommand({ searchCriteria: data.searchCriteria, opportunities: opportunitiesWithIds });
      toast.success("Found new opportunities!", { id: toastId });
    } catch (e) {
      const err = e as Error;
      console.error("Error processing command:", err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsLoading(false);
      refreshAllStats();
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
      refreshAllStats();
    } catch (e) {
      const error = e as Error;
      console.error("Error generating outreach:", error);
      toast.error(error.message, { id: toastId });
    }
  };

  const handleInvestigateLead = async (lead: PredictiveLead) => {
    setInvestigatingLead(lead);
    const toastId = toast.loading(`Investigating ${lead.companyName}...`);

    try {
      const { data: opportunityData, error: functionError } = await supabase.functions.invoke('convert-lead-to-opportunity', {
        body: { lead },
      });

      if (functionError) throw new Error(functionError.message);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const newOpportunity = {
        id: uuidv4(),
        user_id: user.id,
        company_name: opportunityData.companyName,
        role: opportunityData.role,
        location: opportunityData.location,
        potential: opportunityData.potential,
        hiring_urgency: opportunityData.hiringUrgency,
        match_score: opportunityData.matchScore,
        key_signal: opportunityData.keySignal,
      };

      const { error: insertError } = await supabase.from('opportunities').insert(newOpportunity);
      if (insertError) throw new Error(insertError.message);

      setInvestigatedLeads(prev => [...prev, lead.companyName]);
      toast.success(`New opportunity created for ${opportunityData.companyName}!`, {
        id: toastId,
        description: "You can now find it in the Opportunities tab.",
        action: {
          label: "View Opportunities",
          onClick: () => navigate('/opportunities'),
        },
      });
      refreshAllStats();

    } catch (e) {
      const err = e as Error;
      console.error("Error investigating lead:", err);
      toast.error(err.message, { id: toastId });
    } finally {
      setInvestigatingLead(null);
    }
  };

  const isInitialView = !isLoading && !processedCommand;

  return (
    <div className="flex flex-col h-screen">
      <Header title="Dashboard" />
      <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-6">
        <DashboardMetrics stats={stats} loading={statsLoading} />
        
        <RevenueChart data={chartData} loading={chartLoading} />

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
                <PredictiveLeads 
                  leads={leads} 
                  onInvestigate={handleInvestigateLead}
                  investigatingLead={investigatingLead}
                  investigatedLeads={investigatedLeads}
                />
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