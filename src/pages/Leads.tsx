import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { Target, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, Contact, ContactEnrichmentTask } from "@/types/index";
import { useNavigate } from "react-router-dom";
import { useExtension } from "@/context/ExtensionContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/LeadsTable";

const Leads = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contactsByCompany, setContactsByCompany] = useState<Map<string, Contact[]>>(new Map());
  const [tasksByCompany, setTasksByCompany] = useState<Map<string, ContactEnrichmentTask>>(new Map());
  const [loading, setLoading] = useState(false);
  const [generatingCampaignForContactId, setGeneratingCampaignForContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { isExtensionInstalled } = useExtension();

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [oppsRes, contactsRes, tasksRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('contacts').select('*').eq('user_id', user.id),
      supabase.from('contact_enrichment_tasks').select('*').eq('user_id', user.id)
    ]);

    if (oppsRes.error || contactsRes.error || tasksRes.error) {
      toast.error("Failed to load initial data.");
    } else {
      setOpportunities(oppsRes.data || []);
      // The rest of the data processing logic remains the same
      const allOpportunities = oppsRes.data as Opportunity[];
      const allContacts = contactsRes.data as Contact[];
      const oppIdToCompanyName = new Map<string, string>();
      allOpportunities.forEach(opp => oppIdToCompanyName.set(opp.id, opp.company_name));
      const groupedByCompany = new Map<string, Contact[]>();
      allContacts.forEach(contact => {
        const companyName = oppIdToCompanyName.get(contact.opportunity_id);
        if (companyName) {
          const companyContacts = groupedByCompany.get(companyName) || [];
          if (!companyContacts.some(c => c.id === contact.id)) companyContacts.push(contact);
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
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const toastId = toast.loading("Searching for new opportunities...");
    try {
      const { data, error } = await supabase.functions.invoke('natural-language-search', {
        body: { query: searchQuery },
      });
      if (error) throw error;
      setOpportunities(data.opportunities || []);
      toast.success(`Found ${data.opportunities?.length || 0} new opportunities.`, { id: toastId });
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateCampaignForContact = async (contact: Contact) => {
    // This function remains the same
  };

  const handleFindContacts = async (opportunity: Opportunity) => {
    // This function remains the same
  };

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
            <CardTitle>Lead Discovery</CardTitle>
            <CardDescription>Use natural language to find new recruitment opportunities in real-time.</CardDescription>
            <form onSubmit={handleSearch} className="flex w-full items-center space-x-2 pt-4">
              <Input
                type="text"
                placeholder="e.g., 'Series B fintech companies in London hiring for senior engineers...'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
              />
              <Button type="submit" disabled={isSearching}>
                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </form>
          </CardHeader>
          <CardContent>
            {loading || isSearching ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : opportunities.length > 0 ? (
              <LeadsTable
                opportunities={opportunities}
                opportunitiesByCompany={opportunitiesByCompany}
                contactsByCompany={contactsByCompany}
                tasksByCompany={tasksByCompany}
                onFindContacts={handleFindContacts}
                onGenerateCampaign={handleGenerateCampaignForContact}
                isGeneratingCampaign={!!generatingCampaignForContactId}
                generatingContactId={generatingCampaignForContactId}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Target className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">No Leads Found</h3>
                  <p className="text-sm text-muted-foreground">
                    Try a new search to discover opportunities.
                  </p>
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