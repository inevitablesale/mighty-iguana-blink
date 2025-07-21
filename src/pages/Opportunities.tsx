import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Target, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, Agent } from "@/types/index";
import { OpportunityList } from "@/components/OpportunityList";
import { useNavigate } from "react-router-dom";
import { useExtension } from "@/context/ExtensionContext";

const Opportunities = () => {
  const [opportunitiesByAgent, setOpportunitiesByAgent] = useState<Map<string, Opportunity[]>>(new Map());
  const [agents, setAgents] = useState<Agent[]>([]);
  const [processedOppIds, setProcessedOppIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isExtensionInstalled, extensionId } = useExtension();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [oppsRes, campaignsRes, agentsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('campaigns').select('opportunity_id').eq('user_id', user.id),
      supabase.from('agents').select('*').eq('user_id', user.id)
    ]);

    if (oppsRes.error || agentsRes.error) {
      toast.error("Failed to load data.");
    } else {
      const formattedOpps = oppsRes.data.map((o: any) => ({
        id: o.id,
        agent_id: o.agent_id,
        companyName: o.company_name,
        role: o.role,
        location: o.location || 'N/A',
        matchScore: o.match_score || 0,
        company_overview: o.company_overview || 'N/A',
        contract_value_assessment: o.contract_value_assessment || 'N/A',
        hiring_urgency: o.hiring_urgency || 'N/A',
        pain_points: o.pain_points || 'N/A',
        recruiter_angle: o.recruiter_angle || 'N/A',
        key_signal_for_outreach: o.key_signal_for_outreach || 'N/A',
        linkedin_url_slug: o.linkedin_url_slug,
      }));

      const groupedOpps = new Map<string, Opportunity[]>();
      formattedOpps.forEach(opp => {
        if (opp.agent_id) {
          const agentOpps = groupedOpps.get(opp.agent_id) || [];
          agentOpps.push(opp);
          agentOpps.sort((a, b) => b.matchScore - a.matchScore);
          groupedOpps.set(opp.agent_id, agentOpps);
        }
      });
      
      setAgents(agentsRes.data || []);
      setOpportunitiesByAgent(groupedOpps);
    }

    if (campaignsRes.data) {
      setProcessedOppIds(new Set(campaignsRes.data.map(c => c.opportunity_id).filter(id => id)));
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (opportunity: Opportunity) => {
    setApprovingId(opportunity.id);
    const toastId = toast.loading("Generating outreach draft...");
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId: opportunity.id },
      });
      if (error) throw error;
      toast.success("Draft created!", {
        id: toastId,
        description: "You can now view it in Campaigns.",
        action: { label: "View Campaigns", onClick: () => navigate('/campaigns') },
      });
      fetchData();
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setApprovingId(null);
    }
  };

  const handleFindContacts = async (opportunity: Opportunity) => {
    if (!isExtensionInstalled) {
      toast.info("Please install the Coogi Chrome Extension to find contacts.", {
        description: "The extension works in the background to find contacts for you.",
      });
      return;
    }

    const { data: existingTask, error: checkError } = await supabase
      .from('contact_enrichment_tasks')
      .select('id')
      .eq('opportunity_id', opportunity.id)
      .maybeSingle();

    if (checkError) {
      toast.error("Could not check for existing tasks.");
      return;
    }

    if (existingTask) {
      toast.info("A contact search for this opportunity is already running.", {
        action: { label: "View Progress", onClick: () => navigate('/contacts') },
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('contact_enrichment_tasks').insert({
      opportunity_id: opportunity.id,
      company_name: opportunity.companyName,
      user_id: user.id,
      status: 'pending',
    });

    if (error) {
      toast.error("Failed to start contact search.");
    } else {
      toast.success("Contact search started!", {
        description: "The Coogi extension will now search for contacts.",
        action: { label: "View Progress", onClick: () => navigate('/contacts') },
      });
    }
  };

  const handleEnrichCompany = (opportunity: Opportunity) => {
    if (!isExtensionInstalled || !extensionId) {
      toast.info("Please install and connect the Coogi Chrome Extension to enrich company data.");
      return;
    }
    toast.loading("Starting company enrichment via extension...");
    chrome.runtime.sendMessage(extensionId, {
      type: "SCRAPE_COMPANY_PAGE",
      opportunityId: opportunity.id,
    }, (response) => {
      if (chrome.runtime.lastError) {
        toast.error("Could not communicate with the extension.");
        console.error(chrome.runtime.lastError.message);
      } else if (response?.error) {
        toast.error(response.error);
      } else {
        toast.success("Company enrichment process started.");
      }
    });
  };

  const agentsWithOpps = agents.filter(agent => opportunitiesByAgent.has(agent.id));

  return (
    <div className="flex flex-col">
      <Header title="Opportunities" />
      <main className="flex flex-1 flex-col gap-8 p-4 lg:p-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : agentsWithOpps.length > 0 ? (
          agentsWithOpps.map(agent => (
            <OpportunityList
              key={agent.id}
              agent={agent}
              opportunities={opportunitiesByAgent.get(agent.id) || []}
              onApproveOutreach={handleApprove}
              onFindContacts={handleFindContacts}
              onEnrichCompany={handleEnrichCompany}
              processedOppIds={processedOppIds}
              approvingId={approvingId}
            />
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full min-h-[60vh]">
            <div className="flex flex-col items-center gap-1 text-center">
              <Target className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-2xl font-bold tracking-tight">No Opportunities Found Yet</h3>
              <p className="text-sm text-muted-foreground">Run an agent from the Agents page to find your first opportunity.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Opportunities;