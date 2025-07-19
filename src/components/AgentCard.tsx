import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Play, Clock, Edit } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Agent } from "@/types/index";
import { formatDistanceToNow } from 'date-fns';
import { EditAgentDialog } from "./EditAgentDialog";

interface AgentCardProps {
  agent: Agent;
  onDelete: (agentId: string) => void;
  onRunDiscovery: (agentId: string) => void;
  onAgentUpdated: () => void;
  isRunning: boolean;
}

export function AgentCard({ agent, onDelete, onRunDiscovery, onAgentUpdated, isRunning }: AgentCardProps) {
  const getAutonomyLabel = (level: string) => {
    switch (level) {
      case 'manual': return 'Manual';
      case 'semi-automatic': return 'Semi-Automatic';
      case 'automatic': return 'Automatic';
      default: return 'Unknown';
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="coogi-gradient-bg rounded-t-lg">
        <div className="flex justify-between items-start">
          <CardTitle className="text-primary-foreground">{agent.name}</CardTitle>
          <Badge variant="secondary" className="text-xs">{getAutonomyLabel(agent.autonomy_level)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-grow">
        <p className="text-sm text-muted-foreground">{agent.prompt}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {agent.last_run_at ? (
            <>
              <Clock size={12} />
              <span>Last run: {formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true })}</span>
            </>
          ) : (
            <span>Never run</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onRunDiscovery(agent.id)} disabled={isRunning} size="sm">
            <Play className="mr-2 h-4 w-4" />
            {isRunning ? 'Running...' : 'Run Playbook'}
          </Button>
          <EditAgentDialog agent={agent} onAgentUpdated={onAgentUpdated}>
            <Button variant="outline" size="icon">
              <Edit className="h-4 w-4" />
              <span className="sr-only">Edit Agent</span>
            </Button>
          </EditAgentDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete Agent</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the "{agent.name}" agent. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(agent.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardFooter>
    </Card>
  );
}