import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, PlusCircle } from "lucide-react";
import { AddAgentDialog } from "@/components/AddAgentDialog";
import { AgentCard } from "@/components/AgentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Agent } from "@/types/index";
import { useNavigate } from "react-router-dom";
import { useFeedback } from "@/contexts/FeedbackContext";

const Agents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [isAddAgentDialogOpen, setIsAddAgentDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { showFeedback, hideFeedback } = useFeedback();

  const fetchAgents = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("agents")
      .select("id, name, prompt, last_run_at, autonomy_level, search_lookback_hours, max_results, job_type, is_remote, country")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      showFeedback({ type: 'error', message: "Could not load your agents." });
    } else if (data) {
      setAgents(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteAgent = async (agentId: string) => {
    const { error } = await supabase.from("agents").delete().eq("id", agentId);
    if (error) {
      showFeedback({ type: 'error', message: "Failed to delete agent." });
    } else {
      showFeedback({ type: 'success', message: "Agent deleted." });
      fetchAgents();
    }
  };

  const handleRunDiscovery = async (agentId: string) => {
    setRunningAgentId(agentId);
    showFeedback({ type: 'loading', message: "Agent is running its playbook..." });

    try {
      const { data, error } = await supabase.functions.invoke('run-discovery-and-outreach-playbook', {
        body: { agentId },
      });

      if (error) throw error;

      hideFeedback();
      showFeedback({
        type: 'success',
        message: data.message,
        description: "You can review the results on the relevant pages.",
      });
      fetchAgents(); // Refresh to get new last_run_at time
    } catch (e) {
      const err = e as Error;
      hideFeedback();
      showFeedback({ type: 'error', message: 'Playbook failed', description: err.message });
    } finally {
      setRunningAgentId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 pt-24">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Recruiting Agents</h2>
            <p className="text-muted-foreground">
              Deploy your specialized agents to proactively find and create new opportunities.
            </p>
          </div>
          <Button onClick={() => setIsAddAgentDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Agent
          </Button>
          <AddAgentDialog 
            open={isAddAgentDialogOpen}
            onOpenChange={setIsAddAgentDialogOpen}
            onAgentCreated={fetchAgents} 
          />
        </div>
        
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent><CardFooter className="flex justify-end"><Skeleton className="h-10 w-32" /></CardFooter></Card>)}
          </div>
        ) : agents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onDelete={handleDeleteAgent}
                onRunDiscovery={handleRunDiscovery}
                onAgentUpdated={fetchAgents}
                isRunning={runningAgentId === agent.id}
              />
            ))}
          </div>
        ) : (
           <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-12">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bot className="h-12 w-12 text-primary" />
              <h3 className="text-xl font-bold tracking-tight">No Agents Yet</h3>
              <p className="text-sm text-muted-foreground">Click "New Agent" to create your first automated search agent.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Agents;