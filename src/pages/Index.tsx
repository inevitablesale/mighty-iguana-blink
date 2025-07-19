import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { supabase } from "@/integrations/supabase/client";
import { SearchParameters } from "@/components/SearchParameters";
import { OpportunityList } from "@/components/OpportunityList";
import { Opportunity } from "@/components/OpportunityCard";
import { Bot, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const [searchCriteria, setSearchCriteria] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialView, setIsInitialView] = useState(true);
  const navigate = useNavigate();

  const handleSendCommand = async (command: string) => {
    setIsLoading(true);
    setIsInitialView(false);
    setOpportunities([]);
    setSearchCriteria(null);

    const toastId = toast.loading("Finding new opportunities...");

    try {
      const { data, error } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (error) {
        throw new Error(error.message);
      }

      const aiResponse = data as { searchCriteria: any; opportunities: Opportunity[] };
      
      if (aiResponse) {
        setSearchCriteria(aiResponse.searchCriteria);
        setOpportunities(aiResponse.opportunities || []);
        toast.success("Here's what I found!", { id: toastId });
      }

    } catch (e) {
      const error = e as Error;
      console.error("Error calling Edge Function:", error);
      toast.error("Failed to get opportunities. Please try again.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveOutreach = async (opportunity: Opportunity) => {
    const toastId = toast.loading(`Drafting outreach for ${opportunity.companyName}...`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-outreach', {
        body: { opportunity },
      });

      if (error) throw new Error(error.message);

      sessionStorage.setItem('latestCampaignDraft', JSON.stringify(data));

      toast.success(`Draft created for ${opportunity.companyName}!`, {
        id: toastId,
        description: "You can now review the draft in the Campaigns tab.",
        action: {
          label: "View Draft",
          onClick: () => navigate('/campaigns'),
        },
      });
    } catch (e) {
      const error = e as Error;
      console.error("Error generating outreach:", error);
      toast.error("Failed to create draft. Please try again.", { id: toastId });
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
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-hidden">
          <div className="flex-1 overflow-auto pr-2">
            
            {isInitialView && (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Bot className="h-12 w-12 text-primary" />
                  <h2 className="text-2xl font-bold tracking-tight">Welcome to Picture This</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Your AI contract engine. Tell me what you're looking for, and I'll find the best opportunities. For example, "Find me 3 nursing contracts in California."
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
                    <OpportunityList opportunities={opportunities} onApproveOutreach={handleApproveOutreach} />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full mt-4">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Search className="h-10 w-10 text-muted-foreground" />
                      <h3 className="text-2xl font-bold tracking-tight">No Opportunities Found</h3>
                      <p className="text-sm text-muted-foreground">
                        Try a different search command to find new contract opportunities.
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
    </div>
  );
};

export default Index;