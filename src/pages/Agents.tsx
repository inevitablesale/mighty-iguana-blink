import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Agent } from '@/types';
import { toast } from 'sonner';
import { AgentCard } from '@/components/AgentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Radar, BrainCircuit } from "lucide-react";

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [isScoringRunning, setIsScoringRunning] = useState(false);

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

  const handleRunScoring = async () => {
    setIsScoringRunning(true);
    const toastId = toast.loading("Scoring new opportunities...", {
      description: "Matching market jobs against your agent profiles. This may take a moment.",
    });

    try {
      const { data, error } = await supabase.functions.invoke('score-proactive-opportunities');

      if (error) throw new Error(error.message);

      toast.success("Scoring complete!", {
        id: toastId,
        description: data.message || "Check your pipeline for new matched opportunities.",
      });
    } catch (err) {
      toast.error("Scoring run failed.", {
        id: toastId,
        description: (err as Error).message,
      });
    } finally {
      setIsScoringRunning(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white">System Playbooks</h1>
          <p className="text-white/80 mt-1">
            Use these system-wide playbooks to discover and qualify new opportunities.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <Card className="bg-primary/10 border-primary/20 text-white backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Radar className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-lg text-white">1. Market Scanner</CardTitle>
                  <CardDescription className="text-white/60">Find new raw opportunities.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/80">
                This playbook performs a wide search for recently posted, high-paying jobs across the entire market.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleRunScanner} disabled={isScannerRunning}>
                {isScannerRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run Scanner
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-purple-500/10 border-purple-500/20 text-white backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <BrainCircuit className="h-6 w-6 text-purple-400" />
                <div>
                  <CardTitle className="text-lg text-white">2. Score Opportunities</CardTitle>
                  <CardDescription className="text-white/60">Match jobs to your profile.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/80">
                This analyzes raw opportunities and scores them against your custom agents to find the best fits for you.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleRunScoring} disabled={isScoringRunning} variant="secondary" className="bg-purple-500/20 hover:bg-purple-500/30">
                {isScoringRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run Scoring
              </Button>
            </CardFooter>
          </Card>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white">Your Custom Agents</h1>
          <p className="text-white/80 mt-1">
            These are your personalized agents that define your recruiting specialty.
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-56 w-full bg-white/10" />
            <Skeleton className="h-56 w-full bg-white/10" />
          </div>
        ) : agents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onDelete={handleDeleteAgent} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-white/20 rounded-lg bg-black/20 backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white">No Agents Found</h3>
            <p className="text-white/70 mt-2">
              Create your first agent by making a search in the main chat window and saving it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}