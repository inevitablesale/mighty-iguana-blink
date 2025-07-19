import { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { supabase } from "@/integrations/supabase/client";
import { SearchParameters } from "@/components/SearchParameters";
import { OpportunityList } from "@/components/OpportunityList";
import { Opportunity } from "@/components/OpportunityCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot } from "lucide-react";

const Index = () => {
  const [searchCriteria, setSearchCriteria] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialWelcome, setInitialWelcome] = useState(true);

  const handleSendCommand = async (command: string) => {
    setIsLoading(true);
    setInitialWelcome(false);
    setOpportunities([]);
    setSearchCriteria(null);

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
      }

    } catch (e) {
      const error = e as Error;
      console.error("Error calling Edge Function:", error);
      // You could show a toast notification here for the error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex-1 overflow-auto pr-4">
            {initialWelcome && (
              <Card className="bg-muted/50">
                <CardHeader className="flex-row items-center gap-4">
                  <Bot className="h-8 w-8" />
                  <CardTitle className="text-xl font-semibold">Welcome to your Contract Engine</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Tell me what kind of recruiting contracts you're looking for. For example:
                    <br />
                    <em className="text-foreground">"Find me new contracts for veterinary technicians in California."</em>
                  </p>
                </CardContent>
              </Card>
            )}

            {searchCriteria && <SearchParameters params={searchCriteria} />}

            {isLoading && (
              <div className="mt-4 text-center">
                <p>Searching for opportunities...</p>
              </div>
            )}

            {!isLoading && opportunities.length > 0 && (
              <div className="mt-4">
                <OpportunityList opportunities={opportunities} />
              </div>
            )}
            
            {!isLoading && !initialWelcome && opportunities.length === 0 && (
               <div className="mt-4 text-center text-muted-foreground">
                <p>No opportunities found for this search. Try another command.</p>
              </div>
            )}

          </div>
          <div className="mt-auto bg-background pb-4 sticky bottom-0">
            <CommandBar onSendCommand={handleSendCommand} isLoading={isLoading} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;