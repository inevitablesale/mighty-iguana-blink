import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Agent } from '@/types';
import { toast } from 'sonner';
import { AgentCard } from '@/components/AgentCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleUpdateAgent = (updatedAgent: Agent) => {
    setAgents(prev => prev.map(agent => agent.id === updatedAgent.id ? updatedAgent : agent));
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white">My Agents</h1>
          <p className="text-white/80 mt-1">
            These are your personalized agents that define your recruiting specialty. They work in the background to find and score opportunities for your pipeline.
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
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onDelete={handleDeleteAgent}
                onUpdate={handleUpdateAgent}
              />
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