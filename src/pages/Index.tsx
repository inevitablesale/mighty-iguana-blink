import { useState } from "react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Opportunity } from "@/types";
import { SearchResultsTable } from "@/components/SearchResultsTable";
import { Skeleton } from "@/components/ui/skeleton";

export default function Index() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Opportunity[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.info("Please enter a search query.");
      return;
    }
    setIsLoading(true);
    setResults([]);
    const toastId = toast.loading("Searching for talent...");

    try {
      const { data, error } = await supabase.functions.invoke('natural-language-search', {
        body: { query },
      });

      if (error) throw new Error(error.message);

      const sortedOpportunities = (data.opportunities || []).sort((a: Opportunity, b: Opportunity) => (b.match_score || 0) - (a.match_score || 0));
      setResults(sortedOpportunities);
      
      if (sortedOpportunities.length > 0) {
        toast.success(`Found ${sortedOpportunities.length} potential leads.`, { id: toastId });
      } else {
        toast.info("No matching opportunities found for your query.", { id: toastId });
      }

    } catch (err) {
      const error = err as Error;
      console.error("Search failed:", error);
      toast.error(`Search failed: ${error.message}`, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="Dashboard" />
      <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight">Find Your Next Placement</h1>
            <p className="text-muted-foreground mt-2">Describe the talent you're looking for in plain English. Our AI will do the rest.</p>
          </div>
          
          <form onSubmit={handleSearch} className="flex gap-2 mb-8">
            <Input
              type="search"
              placeholder="e.g., 'Senior engineers with search infrastructure experience at high-growth B2B companies'"
              className="h-12 text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
            />
            <Button type="submit" size="lg" disabled={isLoading}>
              <Search className="mr-2 h-5 w-5" />
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </form>

          {isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <SearchResultsTable opportunities={results} />
          )}

          {!isLoading && results.length === 0 && (
             <div className="text-center py-16 px-4 border border-dashed rounded-lg">
                <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">Ready to find talent?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter a description above to start your first AI-powered search.
                </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}