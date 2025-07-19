import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Bot } from "lucide-react";
import { AddAgentDialog } from "@/components/AddAgentDialog";
import { AgentCard } from "@/components/AgentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Agent } from "@/types/index";

const Agents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("agents")
      .select("id, name, prompt")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching agents:", error);
      toast.error("Could not load your agents.");
    } else if (data) {
      setAgents(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDeleteAgent = async (agentId: string) => {
    const { error } = await supabase.from("agents").delete().eq("id", agentId);
    if (error) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent.");
    } else {
      toast.success("Agent deleted.");
      fetchAgents(); // Refresh the list
    }
  };

  const renderLoadingState = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
          <CardFooter className="flex justify-end">
            <Skeleton className="h-10 w-10 rounded-md" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col">
      <Header title="Agents" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Your Recruiting Agents</h2>
            <p className="text-muted-foreground">
              Create and manage specialized agents to proactively find opportunities for you.
            </p>
          </div>
          <AddAgentDialog onAgentCreated={fetchAgents} />
        </div>

        {loading ? (
          renderLoadingState()
        ) : agents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onDelete={handleDeleteAgent} />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bot className="h-12 w-12 text-primary" />
              <h3 className="text-xl font-bold tracking-tight">No Agents Yet</h3>
              <p className="text-sm text-muted-foreground">
                Click "New Agent" to create your first automated search agent.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Agents;