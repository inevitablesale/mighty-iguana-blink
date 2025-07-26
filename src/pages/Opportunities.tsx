import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, Agent, Contact } from "@/types/index";
import { OpportunityList } from "@/components/OpportunityList";
import { useNavigate } from "react-router-dom";
import { useExtension } from "@/context/ExtensionContext";

const Opportunities = () => {
  const [opportunitiesByAgent, setOpportunitiesByAgent] = useState<Map<string, Opportunity[]>>(new Map());
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contactsByOppId, setContactsByOppId] = useState<Map<string, Contact[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generatingCampaignForContactId, setGeneratingCampaignForContactId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isExtensionInstalled, extensionId } = useExtension();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [oppsRes, agentsRes, contactsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('agents').select('*').eq('user_id', user.id),
      supabase.from('contacts').select('*').eq('user_id', user.id)
    ]);

    if (oppsRes.error || agentsRes.error || contactsRes.error) {
      toast.error("Failed to load data.");
    } else {
      const groupedOpps = new Map<string, Opportunity[]>();
      (oppsRes.data as Opportunity[]).forEach(opp => {
        if (opp.agent_id) {
          const agentOpps = groupedOpps.get(opp.agent_id) || [];
          agentOpps.push(opp);
          agentOpps.sort((a, b) => b.match_score - a.match_score);
          groupedOpps.set(opp.agent_id, agentOpps);
        }
      });
      
      setAgents(agentsRes.data || []);
      setOpportunitiesByAgent(groupedOpps);

      const groupedContacts = new Map<string, Contact[]>();
      (contactsRes.data as Contact[]).forEach(contact => {
        const oppContacts = groupedContacts.get(contact.opportunity_id) || [];
        oppContacts.push(contact);
        groupedContacts.set(contact.opportunity_id, oppContacts);
      });
      setContactsByOppId(groupedContacts);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateCampaignForContact = async (opportunity: Opportunity, contact: Contact) => {
    setGeneratingCampaignForContactId(contact.id);
    const toastId = toast.loading(`Drafting email for ${contact.name}...`);
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId: opportunity.id, contact },
      });
      if (error) throw error;
      toast.success("Draft created!", {
        id: toastId,
        description: "You can now view it in Campaigns.",
        action: { label: "View Campaigns", onClick: () => navigate('/campaigns') },
      });
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setGeneratingCampaignForContactId(null);
    }
  };

  const handleEnrichCompany = (opportunity: Opportunity) => {
    if (!isExtensionInstalled || !extensionId) {
      toast.info("Please install and connect the Coogi Chrome Extension to enrich company data.");
      return;
    }
    toast.loading("Sending enrichment task to extension...");
    chrome.runtime.sendMessage(extensionId, {
      type: "SCRAPE_COMPANY_PAGE",
      opportunityId: opportunity.id,
    }, (response) => {
      if (chrome.runtime.lastError) {
        toast.error("Could not communicate with the extension. Please reload the page.");
      } else if (response?.error) {
        toast.error(response.error);
      } else {
        toast.success("Enrichment process started by extension.");
      }
    });
  };

  const handleFindContacts = async (opportunity: Opportunity) => {
    if (!isExtensionInstalled) {
      toast.info("Please install the Coogi Chrome Extension to find contacts.");
      return;
    }

    const toastId = toast.loading(`Queuing contact search for ${opportunity.company_name}...`);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in.");

      const { error } = await supabase
        .from('contact_enrichment_tasks')
        .insert({
          user_id: user.id,
          opportunity_id: opportunity.id,
          company_name: opportunity.company_name,
          status: 'pending'
        });

      if (error) throw error;

      toast.success("Task created! The extension will now search for contacts in the background.", {
        id: toastId,
        description: "You can monitor its progress via the extension icon.",
      });
    } catch (e) {
      const err = e as Error;
      console.error("Error creating contact task:", err);
      toast.error(`Failed to create task: ${err.message}`, { id: toastId });
    }
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
              contactsByOppId={contactsByOppId}
              onGenerateCampaignForContact={handleGenerateCampaignForContact}
              onEnrichCompany={handleEnrichCompany}
              onFindContacts={handleFindContacts}
              generatingCampaignForContactId={generatingCampaignForContactId}
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