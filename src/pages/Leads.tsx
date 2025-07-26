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
import { LeadCard } from "@/components/LeadCard";

const Leads = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contactsByOppId, setContactsByOppId] = useState<Map<string, Contact[]>>(new Map());
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
      setOpportunities(oppsRes.data as Opportunity[]);
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

  useEffect(() => {
    let channel: any;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const handleNewContact = (payload: any) => {
        const newContact = payload.new as Contact;
        const opportunity = opportunities.find(opp => opp.id === newContact.opportunity_id);
        toast.success(`New contact found for ${opportunity?.company_name || 'an opportunity'}.`);
        
        setContactsByOppId(prevMap => {
          const newMap = new Map(prevMap);
          const existingContacts = newMap.get(newContact.opportunity_id) || [];
          if (!existingContacts.some(c => c.id === newContact.id)) {
            newMap.set(newContact.opportunity_id, [...existingContacts, newContact]);
          }
          return newMap;
        });
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
        description: "You can now view it in the Pipeline.",
        action: { label: "View Pipeline", onClick: () => navigate('/pipeline') },
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

  const filteredOpportunities = useMemo(() => {
    if (!filter) return opportunities;
    return opportunities.filter(opp => 
      opp.company_name.toLowerCase().includes(filter.toLowerCase()) ||
      opp.role.toLowerCase().includes(filter.toLowerCase())
    );
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
                <CardDescription>All potential opportunities found by your agents.</CardDescription>
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
              </div>
            ) : filteredOpportunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredOpportunities.map((opp) => {
                  const contacts = contactsByOppId.get(opp.id) || [];
                  return (
                    <LeadCard
                      key={opp.id}
                      opportunity={opp}
                      contacts={contacts}
                      onFindContacts={handleFindContacts}
                      onGenerateCampaign={handleGenerateCampaignForContact}
                      isGeneratingCampaign={!!generatingCampaignForContactId}
                      generatingContactId={generatingCampaignForContactId}
                    />
                  );
                })}
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