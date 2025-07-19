import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle } from "lucide-react";

const Agents = () => {
  const [profile, setProfile] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data, error } = await supabase
          .from("profiles")
          .select("specialty")
          .eq("id", user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
          console.error("Error fetching profile:", error);
          toast.error("Could not load your agent profile.");
        } else if (data) {
          setProfile(data.specialty || "");
        }
      }
      setLoading(false);
    };

    fetchUserAndProfile();
  }, []);

  const handleSave = async () => {
    if (!userId) {
      toast.error("You must be logged in to save your agent.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, specialty: profile });

    if (error) {
      console.error("Error saving agent:", error);
      toast.error("Failed to save your agent profile.");
    } else {
      toast.success("Your default agent has been updated!");
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Agents" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Your Recruiting Agents</h2>
            <Button disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Agent (Coming Soon)
            </Button>
        </div>
        <p className="text-muted-foreground">
            Agents proactively search for opportunities based on your criteria. Here is your default agent.
        </p>
        <Card>
          <CardHeader className="coogi-gradient-bg rounded-t-lg">
            <CardTitle className="text-primary-foreground">Default Agent Profile</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Describe your specialty to help this agent find the most relevant opportunities for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="profile">Agent's Specialty</Label>
              <Textarea
                id="profile"
                placeholder="e.g., 'I specialize in placing Senior Software Engineers in the fintech vertical on the East Coast.'"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                rows={4}
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={loading} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">Save Agent</Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default Agents;