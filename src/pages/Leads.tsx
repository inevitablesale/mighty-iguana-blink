import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { Target, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, Contact, ContactEnrichmentTask } from "@/types/index";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LeadCard } from "@/components/LeadCard";
import { SearchSummary } from "@/components/SearchSummary";

interface SearchParams {
  search_query: string;
  location: string;
  recruiter_specialty: string;
}

const Leads = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contactsByCompany, setContactsByCompany] = useState<Map<string, Contact[]>>(new Map());
  const [tasksByCompany, setTasksByCompany] = useState<Map<string, ContactEnrichmentTask>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generatingCampaignForContactId, setGeneratingCampaignForContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchSummary, setSearchSummary] = useState<{ query: string; params: SearchParams } | null>(null);
  const navigate = useNavigate();

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [oppsRes, contactsRes, tasksRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('contacts').select('*').eq('user_id', user.id),
      supabase.from('contact_enrichment_tasks').select('*').eq('user_id', user.id)
    ]);

    if (oppsRes.error || contactsRes.error || tasksRes.error) {
      toast.error("Failed to load initial data.");
    } else {
      const fetchedOpps = oppsRes.data || [];
      setOpportunities(fetchedOpps);
      
      const allContacts = contactsRes.data as Contact[];
      const groupedByCompany = new Map<string, Contact[]>();
      allContacts.forEach(contact => {
        const companyName = fetchedOpps.find(o => o.id === contact.opportunity_id)?.company_name;
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
    
    const changes = supabase.channel('leads-page-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        fetchInitialData();
      })
      .subscribe()

    return () => {
      supabase.removeChannel(changes);
    }
  }, [fetchInitialData]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchSummary(null);
    const toastId = toast.loading("Searching for new opportunities...");
    try {
      const { data, error } = await supabase.functions.invoke('natural-language-search', {
        body: { query: searchQuery },
      });
      if (error) throw error;
      setOpportunities(data.opportunities || []);
      setSearchSummary({ query: searchQuery, params: data.searchParams });
      toast.success(`Found ${data.opportunities?.length || 0} new opportunities. Contact discovery is running.`, { id: toastId });
      fetchInitialData();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateCampaignForContact = async (contact: Contact) => {
    setGeneratingCampaignForContactId(contact.id);
    const toastId = toast.loading("Generating personalized outreach...");
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId: contact.opportunity_id, contact },
      });
      if (error) throw error;
      toast.success("Outreach draft created!", {
        id: toastId,
        action: { label: "View Campaigns", onClick: () => navigate('/campaigns') },
      });
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setGeneratingCampaignForContactId(null);
    }
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

  const renderContent = () => {
    if (isSearching) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      );
    }

    if (searchSummary && opportunities.length === 0) {
      return (
        <div className="text-center py-16">
          <h3 className="text-xl font-bold tracking-tight">No Leads Found</h3>
          <p className="text-sm text-muted-foreground">
            Try a different search query to discover new opportunities.
          </p>
        </div>
      );
    }

    if (opportunities.length > 0) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {opportunities.map((opportunity) => (
            <LeadCard
              key={opportunity.id}
              opportunity={opportunity}
              allCompanyOpportunities={opportunitiesByCompany.get(opportunity.company_name) || []}
              companyContacts={contactsByCompany.get(opportunity.company_name) || []}
              task={tasksByCompany.get(opportunity.company_name)}
              onGenerateCampaign={handleGenerateCampaignForContact}
              isGeneratingCampaign={!!generatingCampaignForContactId}
              generatingContactId={generatingCampaignForContactId}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="text-center py-16">
        <Target className="h-12 w-12 text-muted-foreground mx-auto" />
        <h3 className="mt-4 text-xl font-bold tracking-tight">Find Your Next Lead</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the search bar above to find new opportunities.
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <Header title="Leads" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-8">
        <div className="max-w-2xl mx-auto w-full">
          <form onSubmit={handleSearch} className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder="e.g., 'Series B fintech companies in London hiring for senior engineers...'"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
              className="h-12 text-base"
            />
            <Button type="submit" disabled={isSearching} size="lg">
              {isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
              Search
            </Button>
          </form>
        </div>
        <div className="mt-4">
          {searchSummary && <SearchSummary userQuery={searchSummary.query} aiResponse={searchSummary.params} />}
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Leads;