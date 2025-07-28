import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Agent } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Bot, MoreVertical, Play, Pencil, Trash2, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EditAgentDialog } from './EditAgentDialog';

export function SidebarAgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

  const handleRunAgent = async (agent: Agent) => {
    setRunningAgentId(agent.id);
    const toastId = toast.loading(`Running agent "${agent.name}"...`);

    try {
      const { data, error } = await supabase.functions.invoke('run-discovery-and-outreach-playbook', {
        body: { agentId: agent.id },
      });
      if (error) throw error;
      toast.success(`Agent "${agent.name}" run complete!`, { id: toastId, description: data.message });
    } catch (err) {
      toast.error(`Agent "${agent.name}" failed.`, { id: toastId, description: (err as Error).message });
    } finally {
      setRunningAgentId(null);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    const agentToDelete = agents.find(a => a.id === agentId);
    if (!agentToDelete) return;

    const toastId = toast.loading(`Deleting agent "${agentToDelete.name}"...`);
    try {
      const { error } = await supabase.from('agents').delete().eq('id', agentId);
      if (error) throw error;
      toast.success(`Agent "${agentToDelete.name}" deleted.`, { id: toastId });
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
    } catch (err)
{
      toast.error(`Failed to delete agent.`, { id: toastId, description: (err as Error).message });
    }
  };

  const handleUpdateAgent = (updatedAgent: Agent) => {
    setAgents(prev => prev.map(agent => agent.id === updatedAgent.id ? updatedAgent : agent));
  };

  if (loading) {
    return (
      <div className="space-y-2 px-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-1 px-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-all hover:bg-white/10"
          >
            <button className="flex items-center gap-3 truncate flex-1" onClick={() => handleRunAgent(agent)}>
              {runningAgentId === agent.id ? (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate">{agent.name}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleRunAgent(agent)}>
                  <Play className="mr-2 h-4 w-4" /> Run Now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditingAgent(agent)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDeleteAgent(agent.id)} className="text-red-500 focus:text-red-400">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
      {editingAgent && (
        <EditAgentDialog
          agent={editingAgent}
          isOpen={!!editingAgent}
          onOpenChange={(isOpen) => !isOpen && setEditingAgent(null)}
          onAgentUpdate={handleUpdateAgent}
        />
      )}
    </div>
  );
}