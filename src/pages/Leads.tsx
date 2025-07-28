import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, Contact, ContactEnrichmentTask } from "@/types/index";
import { useNavigate } from "react-router-dom";
import { useExtension } from "@/context/ExtensionContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LeadsTable } from "@/components/LeadsTable";

const Leads = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contactsByCompany, setContactsByCompany] = useState<Map<string, Contact[]>>(new Map());
  const [tasksByCompany, setTasksByCompany] = useState<Map<string, ContactEnrichmentTask>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generatingCampaignForContactId, setGeneratingCampaignForContactId] = useState<string | null>(null);
  const [enrichingContactId, setEnrichingContactId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();
  const { isExtensionInstalled } = useExtension();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [oppsRes, contactsRes, tasksRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('user_id', user.id),
      supabase.from('contact_enrichment_tasks').select('*').eq('user_id', user.id)
    ]);

    if (oppsRes.error || contactsRes.error || tasksRes.error) {
      toast.error("Failed to load data.");
    } else {
      const allOpportunities = oppsRes.data as Opportunity[];
      const allContacts = contactsRes.data as Contact[];
      setOpportunities(allOpportunities);

      const oppIdToCompanyName = new Map<string, string>();
      allOpportunities.forEach(opp => {
        oppIdToCompanyName.set(opp.id, opp.company_name);
      });

      const groupedByCompany = new Map<string, Contact[]>();
      allContacts.forEach(contact => {
        const companyName = oppIdToCompanyName.get(contact.opportunity_id);
        if (companyName) {
          const companyContacts = groupedByCompany.get(companyName) || [];
          if (!companyContacts.some(c => c.id === contact.id)) {
            companyContacts.push(contact);
          }
          groupedByCompany.set(companyName, companyContacts);
        }
      });
      setContactsByCompany(groupedByCompany);

      const allTasks = tasksRes.data as ContactEnrichmentTask[];
      const groupedTasks = new Map<string, ContactEnrichmentTask>();
      allTasks.forEach(task => {
        const existingTask = groupedTasks.get(task.company_name);
        if (!existingTask || new Date(task.created_at) > new Date(existingTask.created_at)) {
          groupedTasks.set(task.company_name, task);
        }
      });
      setTasksByCompany(groupedTasks);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let channel: any;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const handleDataChange = () => {
        fetchData();
      };

      channel = supabase
        .channel('leads-page-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `user_id=eq.${user.id}`}, handleDataChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_enrichment_tasks', filter: `user_id=eq.${user.id}`}, handleDataChange)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to contacts and tasks changes.');
          }
        });
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchData]);

  const handleEnrichContact = async (contact: Contact) => {
    setEnrichingContactId(contact.id);
    const toastId = toast.loading(`Searching for ${contact.name}'s email...`);

    try {
      const { data: responseData, error } = await supabase.functions.invoke('enrich-contact-with-apollo', {
        body: { contact_id: contact.id },
      });

      if (error) throw new Error(error.message);

      if (responseData.status === 'not_found') {
        toast.info(`Could not find a verified email for ${contact.name}.`, { id: toastId });
      } else if (responseData.status === 'success' && responseData.data.email) {
        toast.success(`Found email for ${responseData.data.name}!`, { id: toastId });
      } else {
        toast.error('An unexpected response was received from the enrichment service.', { id: toastId });
      }
      fetchData();
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setEnrichingContactId(null);
    }
  };

  const handleGenerateCampaignForContact = async (contact: Contact) => {
    setGeneratingCampaignForContactId(contact.id);
    const toastId = toast.loading(`Drafting email for ${contact.name}...`);
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId: contact.opportunity_id, contact },
      });
      if (error) throw error;
      toast.success("Draft created!", {
        id: toastId,
        description: "You can now view it in the Campaigns page.",
        action: { label: "View Campaigns", onClick: () => navigate('/campaigns') },
      });
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setGeneratingCampaignForContactId(null);
    }
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
      const { error } = await supabase.from('contact_enrichment_tasks').insert({
        user_id: user.id,
        opportunity_id: opportunity.id,
        company_name: opportunity.company_name,
        status: 'pending'
      });
      if (error) throw error;
      toast.success("Task created! The extension will now search for contacts.", { id: toastId });
    } catch (e) {
      toast.error(`Failed to create task: ${(e as Error).message}`, { id: toastId });
    }
  };

  const sortedAndFilteredOpportunities = useMemo(() => {
    const filtered = filter
      ? opportunities.filter(opp =>
          opp.company_name.toLowerCase().includes(filter.toLowerCase()) ||
          opp.role.toLowerCase().includes(filter.toLowerCase())
        )
      : opportunities;
    
    return filtered.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  }, [opportunities, filter]);

  const opportunitiesByCompany = useMemo(() => {
    const companyMap = new Map<string, Opportunity[]>();
    opportunities.forEach(opp => {
      const companyOpps = companyMap.get(opp.company_name) || [];
      companyOpps.push(opp);
      companyMap.set(opp.company_name, companyOpps);
    });
    return companyMap;
  }, [opportunities]);

  return (
    <div className="flex flex-col">
      <Header title="Leads" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>All Leads</CardTitle>
                <CardDescription>Your best leads, sorted by match score. Found by your playbooks.</CardDescription>
              </div>
              <div className="w-full max-w-sm">
                <Input 
                  placeholder="Filter by company or role..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : sortedAndFilteredOpportunities.length > 0 ? (
              <LeadsTable
                opportunities={sortedAndFilteredOpportunities}
                opportunitiesByCompany={opportunitiesByCompany}
                contactsByCompany={contactsByCompany}
                tasksByCompany={tasksByCompany}
                onFindContacts={handleFindContacts}
                onGenerateCampaign={handleGenerateCampaignForContact}
                isGeneratingCampaign={!!generatingCampaignForContactId}
                generatingContactId={generatingCampaignForContactId}
                onEnrichContact={handleEnrichContact}
                enrichingContactId={enrichingContactId}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Target className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">No Leads Found Yet</h3>
                  <p className="text-sm text-muted-foreground">Run a playbook to find your first lead.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Leads;