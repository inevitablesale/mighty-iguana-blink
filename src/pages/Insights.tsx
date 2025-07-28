import { useState } from "react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TalentPoolProfile } from "@/types";
import { TalentProfileCard } from "@/components/TalentProfileCard";
import { Skeleton } from "@/components/ui/skeleton";

const Insights = () => {
  const [companyName, setCompanyName] = useState("");
  const [profiles, setProfiles] = useState<TalentPoolProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setProfiles([]);
    const toastId = toast.loading(`Analyzing talent pool for ${companyName}...`);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-talent-pool', {
        body: { companyName },
      });

      if (error) throw new Error(error.message);

      setProfiles(data.profiles);
      toast.success(`Found ${data.profiles.length} sample profiles.`, { id: toastId });
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Insights" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Talent Pool Analysis</CardTitle>
            <CardDescription>
              Enter a company name to find sample employee profiles and understand their talent landscape.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex w-full max-w-lg items-center space-x-2">
              <Input
                type="text"
                placeholder="e.g., 'Google', 'Stripe', 'OpenAI'"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Analyze
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        )}

        {!loading && hasSearched && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Sample Profiles for {companyName}
            </h2>
            {profiles.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {profiles.map((profile, index) => (
                  <TalentProfileCard key={index} profile={profile} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 rounded-lg border border-dashed">
                <h3 className="text-lg font-bold tracking-tight">No Profiles Found</h3>
                <p className="text-sm text-muted-foreground">
                  Could not find any public profiles for this company. Try another one.
                </p>
              </div>
            )}
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="text-center py-16 rounded-lg border border-dashed">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="mt-4 text-lg font-bold tracking-tight">Unlock Market Insights</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter a company name above to begin your analysis.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Insights;