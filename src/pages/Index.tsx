import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { supabase } from "@/integrations/supabase/client";
import { SearchParameters } from "@/components/SearchParameters";
import { OpportunityList } from "@/components/OpportunityList";
import { Opportunity } from "@/components/OpportunityCard";
import { Bot, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { v4 as uuidv4 } from 'uuid';

const Index = () => {
  const [searchCriteria, setSearchCriteria] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialView, setIsInitialView] = useState(true);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleProactiveSearch = useCallback(async (profile: string) => {
    setIsLoading(true);
    setIsInitialView(false);
    const toastId = toast.loading("Proactively searching for top opportunities...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { data: functionData, error: functionError } = await supabase.functions.invoke('proactive-search', {
        body: { profile },
      });

      if (functionError) throw new Error(functionError.message);

      const aiResponse = functionData as { opportunities: Omit<Opportunity, 'id'>[] };
      
      if (aiResponse && aiResponse.opportunities && aiResponse.opportunities.length > 0) {
        const opportunitiesWithIds = aiResponse.opportunities.map(opp => ({ ...opp, id: uuidv4() }));
        
        const { error: insertError } = await supabase.from('opportunities').insert(
          opportunitiesWithIds.map(({id, companyName, role, location, potential, hiringUrgency, matchScore, keySignal}) => ({
            id, user_id: user.id, company_name: companyName, role, location, potential, hiring_urgency: hiringUrgency, match_score: matchScore, key_signal: keySignal
          }))
        );

        if (insertError) throw new Error(insertError.message);

        setOpportunities(opportunitiesWithIds);
        toast.success("Here are your top proactive opportunities!", { id: toastId });
      } else {
        setOpportunities([]);
        toast.info("No new opportunities found at the moment.", { id: toastId });
      }
    } catch (e) {
      const error = e as Error;
      console.error("Error in proactive search:", error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSendCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    setIsLoading(true);
    setOpportunities([]);
    setSearchCriteria(null);
    setIsInitialView(false);

    const toastId = toast.loading("Finding new opportunities...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { data: functionData, error: functionError } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (functionError) throw new Error(functionError.message);

      const aiResponse = functionData as { searchCriteria: any; opportunities: Omit<Opportunity, 'id'>[] };
      
      if (aiResponse && aiResponse.opportunities && aiResponse.opportunities.length > 0) {
        const opportunitiesWithIds = aiResponse.opportunities.map(opp => ({ ...opp, id: uuidv4() }));
        
        const { error: insertError } = await supabase.from('opportunities').insert(
          opportunitiesWithIds.map(({id, companyName, role, location, potential, hiringUrgency, matchScore, keySignal}) => ({
            id, user_id: user.id, company_name: companyName, role, location, potential, hiring_urgency: hiringUrgency, match_score: matchScore, key_signal: keySignal
          }))
        );

        if (insertError) throw new Error(insertError.message);

        setSearchCriteria(aiResponse.searchCriteria);
        setOpportunities(opportunitiesWithIds);
        toast.success("Here are your tailored opportunities!", { id: toastId });
      } else {
        setOpportunities([]);
        toast.info("No new opportunities found for that query.", { id: toastId });
      }

    } catch (e) {
      const error = e as Error;
      console.error("Error in handleSendCommand:", error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeDashboard = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('opportunity_id')
        .eq('user_id', user.id);
      
      if (campaignsError) console.error("Error fetching campaigns:", campaignsError);
      else if (campaigns) setApprovedIds(campaigns.map(c => c.opportunity_id));

      const { data: recentOpps, error: oppsError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (oppsError) console.error("Error fetching opportunities:", oppsError);

      if (recentOpps && recentOpps.length > 0) {
        setOpportunities(recentOpps.map(o => ({...o, companyName: o.company_name, hiringUrgency: o.hiring_urgency, matchScore: o.match_score, keySignal: o.key_signal} as Opportunity)));
        setIsInitialView(false);
        setIsLoading(false);
      } else {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('specialty')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Error fetching profile:", profileError);
          setIsLoading(false);
        } else if (profile && profile.specialty) {
          await handleProactiveSearch(profile.specialty);
        } else {
          setIsInitialView(true);
          setIsLoading(false);
        }
      }
    };

    initializeDashboard();
  }, [handleProactiveSearch]);

  const handleApproveOutreach = async (opportunity: Opportunity) => {
    const toastId = toast.loading(`Drafting outreach for ${opportunity.companyName}...`);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { data, error } = await supabase.functions.invoke('generate-outreach', {
        body: { opportunity },
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

  const renderLoadingState = () => (
    <div className="space-y-4 mt-4">
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-4 bg-card">
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex space-x-2 pt-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <Header title="Dashboard" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-hidden">
        <div className="flex-1 overflow-auto pr-2">
          
          {isInitialView && !isLoading && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full">
              <div className="flex flex-col items-center gap-2 text-center">
                <Bot className="h-12 w-12 text-primary" />
                <h2 className="text-2xl font-bold tracking-tight">Welcome to Picture This</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Your AI contract engine. Use the command bar below or{" "}
                  <Link to="/settings" className="underline text-primary">set your profile</Link>
                  {" "}for automated searches.
                </p>
              </div>
            </div>
          )}

          {!isInitialView && (
            <>
              {searchCriteria && <SearchParameters params={searchCriteria} />}
              
              {isLoading ? (
                renderLoadingState()
              ) : opportunities.length > 0 ? (
                <div className="mt-4">
                  <OpportunityList 
                    opportunities={opportunities} 
                    onApproveOutreach={handleApproveOutreach} 
                    approvedIds={approvedIds} 
                  />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full mt-4">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <Search className="h-10 w-10 text-muted-foreground" />
                    <h3 className="text-2xl font-bold tracking-tight">No Opportunities Found</h3>
                    <p className="text-sm text-muted-foreground">
                      Try a different search command or refine your profile in Settings.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
        <div className="mt-auto bg-background pt-4">
          <CommandBar onSendCommand={handleSendCommand} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
};

export default Index;