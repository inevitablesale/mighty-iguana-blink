import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, Contact } from "@/types/index";
import { useNavigate } from "react-router-dom";
import { useExtension } from "@/context/ExtensionContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CompanyLeadGroup } from "@/components/CompanyLeadGroup";

const Leads = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contactsByCompany, setContactsByCompany] = useState<Map<string, Contact[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generatingCampaignForContactId, setGeneratingCampaignForContactId] = useState<string | null>(null);
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

    const [oppsRes, contactsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('user_id', user.id)
    ]);

    if (oppsRes.error || contactsRes.error) {
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

      const handleNewContact = (payload: any) => {
        const newContact = payload.new as Contact;
        const opportunity = opportunities.find(opp => opp.id === newContact.opportunity_id);
        if (opportunity) {
          toast.success(`New contact found for ${opportunity.company_name}.`);
          setContactsByCompany(prevMap => {
            const newMap = new Map(prevMap);
            const companyName = opportunity.company_name;
            const existingContacts = newMap.get(companyName) || [];
            if (!existingContacts.some(c => c.id === newContact.id)) {
              newMap.set(companyName, [...existingContacts, newContact]);
            }
            return newMap;
          });
        }
      };

      channel = supabase
        .channel('contacts-insert-channel')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'contacts',
            filter: `user_id=eq.${user.id}`
        }, handleNewContact)
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [opportunities]);

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

    const { data: existingTasks, error: taskError } = await supabase
      .from('contact_enrichment_tasks')
      .select('id, status')
      .eq('company_name', opportunity.company_name)
      .in('status', ['pending', 'processing', 'complete']);

    if (taskError) {
      toast.error("Could not check for existing tasks.");
      return;
    }

    if (existingTasks && existingTasks.length > 0) {
      toast.info(`A contact search for ${opportunity.company_name} has already been run or is in progress.`);
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

  const groupedOpportunities = useMemo(() => {
    const filtered = filter
      ? opportunities.filter(opp =>
          opp.company_name.toLowerCase().includes(filter.toLowerCase()) ||
          opp.role.toLowerCase().includes(filter.toLowerCase())
        )
      : opportunities;

    const companyMap = new Map<string, Opportunity[]>();
    filtered.forEach(opp => {
      const companyOpps = companyMap.get(opp.company_name) || [];
      companyOpps.push(opp);
      companyMap.set(opp.company_name, companyOpps);
    });

    return Array.from(companyMap.entries()).map(([companyName, opportunities]) => ({
      companyName,
      opportunities,
    })).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [opportunities, filter]);

  return (
    <div className="flex flex-col">
      <Header title="Leads" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>All Leads</CardTitle>
                <CardDescription>All potential opportunities found by your agents, grouped by company.</CardDescription>
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
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
              </div>
            ) : groupedOpportunities.length > 0 ? (
              <div className="space-y-4">
                {groupedOpportunities.map((group) => (
                  <CompanyLeadGroup
                    key={group.companyName}
                    companyName={group.companyName}
                    opportunities={group.opportunities}
                    companyContacts={contactsByCompany.get(group.companyName) || []}
                    onFindContacts={handleFindContacts}
                    onGenerateCampaign={handleGenerateCampaignForContact}
                    isGeneratingCampaign={!!generatingCampaignForContactId}
                    generatingContactId={generatingCampaignForContactId}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Target className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">No Leads Found Yet</h3>
                  <p className="text-sm text-muted-foreground">Run an agent from the Agents page to find your first lead.</p>
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