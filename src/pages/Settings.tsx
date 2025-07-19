import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Settings = () => {
  const [profile, setProfile] = useState("");

  useEffect(() => {
    const savedProfile = localStorage.getItem("recruiterProfile");
    if (savedProfile) {
      setProfile(savedProfile);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("recruiterProfile", profile);
    toast.success("Your profile has been saved!");
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Your Recruiter Profile</CardTitle>
              <CardDescription>
                Describe your specialty to help the AI find the most relevant opportunities for you. This will be used to automatically search for leads when you visit the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="profile">Your Specialty</Label>
                <Textarea
                  id="profile"
                  placeholder="e.g., 'I specialize in placing Senior Software Engineers in the fintech vertical on the East Coast.'"
                  value={profile}
                  onChange={(e) => setProfile(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={handleSave}>Save Profile</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Settings;