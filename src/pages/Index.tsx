import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { supabase } from "@/integrations/supabase/client";
import { SearchParameters } from "@/components/SearchParameters";
import { OpportunityList } from "@/components/OpportunityList";
import { Opportunity } from "@/components/OpportunityCard";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const initialOpportunities: Opportunity[] = [
  {
    companyName: "InnovateHealth",
    role: "Lead Nurse Practitioner",
    location: "San Diego, CA",
    potential: "High",
    hiringUrgency: "High",
    matchScore: 9,
    keySignal: "Just raised $30M Series B",
  },
  {
    companyName: "QuantumLeap Tech",
    role: "Senior AI Engineer",
    location: "Austin, TX",
    potential: "High",
    hiringUrgency: "Medium",
    matchScore: 8,
    keySignal: "Hiring velocity increased 40%",
  },
  {
    companyName: "GreenScape Solutions",
    role: "Director of Sales",
    location: "Denver, CO",
    potential: "Medium",
    hiringUrgency: "Low",
    matchScore: 7,
    keySignal: "New office opening announced",
  },
];


const Index = () => {
  const [searchCriteria, setSearchCriteria] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
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

      // For now, we'll store the latest draft in session storage.
      // A full implementation would save this to a database.
      sessionStorage.setItem('latestCampaignDraft', JSON.stringify(data));

      toast.success(`Draft created for ${opportunity.companyName}!`, {
        id: toastId,
        description: "Click here to view it in Campaigns.",
        onClick: () => navigate('/campaigns'),
      });
    } catch (e) {
      const error = e as Error;
      console.error("Error generating outreach:", error);
      toast.error("Failed to create draft. Please try again.", { id: toastId });
    }
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-hidden">
          <div className="flex-1 overflow-auto pr-2">
            
            {isInitialView && (
              <div className="flex items-center gap-4 mb-4">
                <Bot className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">Welcome Back!</h2>
                  <p className="text-muted-foreground">Here are the top opportunities I've found for you.</p>
                </div>
              </div>
            )}

            {searchCriteria && <SearchParameters params={searchCriteria} />}

            {isLoading && opportunities.length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full">
                <div className="flex flex-col items-center gap-1 text-center">
                   <h3 className="text-2xl font-bold tracking-tight">Searching...</h3>
                   <p className="text-sm text-muted-foreground">The AI is analyzing the market for new opportunities.</p>
                </div>
              </div>
            )}

            {!isLoading && opportunities.length > 0 && (
              <div className="mt-4">
                <OpportunityList opportunities={opportunities} onApproveOutreach={handleApproveOutreach} />
              </div>
            )}
            
            {!isLoading && !isInitialView && opportunities.length === 0 && (
               <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full">
                <div className="flex flex-col items-center gap-1 text-center">
                  <h3 className="text-2xl font-bold tracking-tight">No Opportunities Found</h3>
                  <p className="text-sm text-muted-foreground">
                    Try a different search command to find new contract opportunities.
                  </p>
                </div>
              </div>
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