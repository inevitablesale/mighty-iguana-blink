import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Agent } from '@/types';
import { toast } from 'sonner';
import { AgentCard } from '@/components/AgentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Radar } from "lucide-react";

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScannerRunning, setIsScannerRunning] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgents(data);
    } catch (err) {
      toast.error("Failed to fetch agents", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);
  
  const handleDeleteAgent = (agentId: string) => {
    setAgents(prev => prev.filter(agent => agent.id !== agentId));
  };

  const handleRunScanner = async () => {
    setIsScannerRunning(true);
    const toastId = toast.loading("Running Market Scanner...", {
      description: "This will scan the market for new opportunities. It may take a minute.",
    });

    try {
      const { data, error } = await supabase.functions.invoke('market-scanner-playbook');

      if (error) throw new Error(error.message);

      toast.success("Market Scanner complete!", {
        id: toastId,
        description: data.message || "The scan finished successfully.",
      });
    } catch (err) {
      toast.error("Market Scanner failed.", {
        id: toastId,
        description: (err as Error).message,
      });
    } finally {
      setIsScannerRunning(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white">My Agents</h1>
          <p className="text-white/80 mt-1">
            Manage your automated playbooks. These agents run in the background to find new opportunities for you.
          </p>
        </header>

        <Card className="mb-8 bg-primary/10 border-primary/20 text-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Radar className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-lg text-white">Market Scanner Playbook</CardTitle>
                <CardDescription className="text-white/60">
                  Manually trigger a broad market scan for high-value opportunities.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/80">
              This playbook performs a wide search for recently posted, high-paying jobs across the entire market. The results are then scored and matched to the best-fit recruiter profile in the system.
            </p>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleRunScanner} disabled={isScannerRunning}>
              {isScannerRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run Scanner Now
            </Button>
          </CardFooter>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : agents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onDelete={handleDeleteAgent} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-white/20 rounded-lg">
            <h3 className="text-xl font-semibold text-white">No Agents Found</h3>
            <p className="text-white/70 mt-2">
              Create your first agent by making a search in the main chat window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}