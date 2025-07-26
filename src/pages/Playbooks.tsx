import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Bot } from "lucide-react";
import { AddPlaybookDialog } from "@/components/AddPlaybookDialog";
import { PlaybookCard } from "@/components/PlaybookCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Playbook } from "@/types/index";
import { useNavigate } from "react-router-dom";

const Playbooks = () => {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningPlaybookId, setRunningPlaybookId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchPlaybooks = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("agents") // The table is still 'agents' in the DB
      .select("id, name, prompt, last_run_at, autonomy_level, search_lookback_hours, max_results, job_type, is_remote, country")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Could not load your playbooks.");
    } else if (data) {
      setPlaybooks(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const handleDeletePlaybook = async (playbookId: string) => {
    const { error } = await supabase.from("agents").delete().eq("id", playbookId);
    if (error) {
      toast.error("Failed to delete playbook.");
    } else {
      toast.success("Playbook deleted.");
      fetchPlaybooks();
    }
  };

  const handleRunDiscovery = async (playbookId: string) => {
    setRunningPlaybookId(playbookId);
    const toastId = toast.loading("Playbook is running...");

    try {
      const { data, error } = await supabase.functions.invoke('run-discovery-and-outreach-playbook', {
        body: { agentId: playbookId }, // The function expects 'agentId'
      });

      if (error) throw error;

      toast.success(data.message, {
        id: toastId,
        description: "You can review the results on the relevant pages.",
        action: {
          label: "View Campaigns",
          onClick: () => navigate('/campaigns'),
        },
      });
      fetchPlaybooks(); // Refresh to get new last_run_at time
    } catch (e) {
      const err = e as Error;
      toast.error(`Playbook failed: ${err.message}`, { id: toastId });
    } finally {
      setRunningPlaybookId(null);
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Playbooks" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Recruiting Playbooks</h2>
            <p className="text-muted-foreground">
              Configure and deploy automated playbooks to find and create new opportunities.
            </p>
          </div>
          <AddPlaybookDialog onPlaybookCreated={fetchPlaybooks} />
        </div>
        
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent><CardFooter className="flex justify-end"><Skeleton className="h-10 w-32" /></CardFooter></Card>)}
          </div>
        ) : playbooks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {playbooks.map((playbook) => (
              <PlaybookCard
                key={playbook.id}
                playbook={playbook}
                onDelete={handleDeletePlaybook}
                onRunDiscovery={handleRunDiscovery}
                onPlaybookUpdated={fetchPlaybooks}
                isRunning={runningPlaybookId === playbook.id}
              />
            ))}
          </div>
        ) : (
           <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-12">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bot className="h-12 w-12 text-primary" />
              <h3 className="text-xl font-bold tracking-tight">No Playbooks Yet</h3>
              <p className="text-sm text-muted-foreground">Click "New Playbook" to create your first automated workflow.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Playbooks;