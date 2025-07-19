import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
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
          toast.error("Could not load your profile.");
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
      toast.error("You must be logged in to save your profile.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, specialty: profile });

    if (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save your profile.");
    } else {
      toast.success("Your profile has been saved!");
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Settings" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Card>
          <CardHeader className="coogi-gradient-bg rounded-t-lg">
            <CardTitle className="text-primary-foreground">Your Recruiter Profile</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Describe your specialty to help the AI find the most relevant opportunities for you. This will be used to automatically search for leads when you visit the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="profile">Your Specialty</Label>
              <Textarea
                id="profile"
                placeholder="e.g., 'I specialize in placing Senior Software Engineers in the fintech vertical on the East Coast.'"
                value={profile}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProfile(e.target.value)}
                rows={4}
                disabled={loading}
              />
            </div>
            <Button onClick={handleSave} disabled={loading} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">Save Profile</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;