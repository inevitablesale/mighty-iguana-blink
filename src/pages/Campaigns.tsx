import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Copy } from "lucide-react";
import { toast } from "sonner";

interface Draft {
  subject: string;
  body: string;
}

interface Campaign {
  companyName: string;
  role: string;
  draft: Draft;
}

const Campaigns = () => {
  const [latestCampaign, setLatestCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    const storedDraft = sessionStorage.getItem('latestCampaignDraft');
    if (storedDraft) {
      setLatestCampaign(JSON.parse(storedDraft));
    }
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold md:text-2xl">Campaigns</h1>
          </div>
          
          {latestCampaign ? (
            <Card>
              <CardHeader>
                <CardTitle>To: {latestCampaign.companyName}</CardTitle>
                <CardDescription>Re: {latestCampaign.role}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-semibold">Subject</h4>
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(latestCampaign.draft.subject)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm p-3 bg-muted rounded-md">{latestCampaign.draft.subject}</p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-semibold">Body</h4>
                     <Button variant="ghost" size="icon" onClick={() => handleCopy(latestCampaign.draft.body)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm p-3 bg-muted rounded-md whitespace-pre-wrap">{latestCampaign.draft.body}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
              <div className="flex flex-col items-center gap-1 text-center">
                <Bell className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-2xl font-bold tracking-tight">
                  No Campaign Drafts Yet
                </h3>
                <p className="text-sm text-muted-foreground">
                  Approve an outreach from the dashboard to generate your first draft.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Campaigns;