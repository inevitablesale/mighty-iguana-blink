import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Agent } from "@/types";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Loader2, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AgentCardProps {
  agent: Agent;
  onDelete: (agentId: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  const [isRunning, setIsRunning] = useState(false);

  const handleRunAgent = async () => {
    setIsRunning(true);
    const toastId = toast.loading(`Running agent "${agent.name}"...`, {
      description: "This may take a minute. We'll let you know when it's done.",
    });

    try {
      const { data, error } = await supabase.functions.invoke('run-discovery-and-outreach-playbook', {
        body: { agentId: agent.id },
      });

      if (error) throw new Error(error.message);

      toast.success(`Agent "${agent.name}" run complete!`, {
        id: toastId,
        description: data.message,
      });
    } catch (err) {
      toast.error(`Agent "${agent.name}" failed.`, {
        id: toastId,
        description: (err as Error).message,
      });
    } finally {
      setIsRunning(false);
    }
  };
  
  const handleDelete = async () => {
    const toastId = toast.loading(`Deleting agent "${agent.name}"...`);
    try {
      const { error } = await supabase.from('agents').delete().eq('id', agent.id);
      if (error) throw error;
      toast.success(`Agent "${agent.name}" deleted.`, { id: toastId });
      onDelete(agent.id);

      // Trigger intent profile update in the background
      supabase.functions.invoke('update-user-intent-profile', {
        body: { userId: agent.user_id },
      }).then(({ error: funcError }) => {
        if (funcError) console.error("Failed to update intent profile after deletion:", funcError.message);
        else console.log("User intent profile update triggered after deletion.");
      });

    } catch (err) {
      toast.error(`Failed to delete agent.`, { id: toastId, description: (err as Error).message });
    }
  };

  return (
    <Card className="w-full bg-black/20 border border-white/10 text-white">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg text-white">{agent.name}</CardTitle>
            <CardDescription className="text-white/60 text-xs mt-1">
              Last run: {agent.last_run_at ? `${formatDistanceToNow(new Date(agent.last_run_at))} ago` : 'Never'}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDelete} className="text-red-500">Delete Agent</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-white/80 bg-white/5 p-3 rounded-md border border-white/10">
          {agent.prompt}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleRunAgent} disabled={isRunning}>
          {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Run Now
        </Button>
      </CardFooter>
    </Card>
  );
}