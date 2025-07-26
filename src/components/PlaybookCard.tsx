import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Play, Clock, Edit, MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Playbook } from "@/types/index";
import { formatDistanceToNow } from 'date-fns';
import { EditPlaybookDialog } from "./EditPlaybookDialog";

interface PlaybookCardProps {
  playbook: Playbook;
  onDelete: (playbookId: string) => void;
  onRunDiscovery: (playbookId: string) => void;
  onPlaybookUpdated: () => void;
  isRunning: boolean;
}

export function PlaybookCard({ playbook, onDelete, onRunDiscovery, onPlaybookUpdated, isRunning }: PlaybookCardProps) {
  const getAutonomyLabel = (level: string) => {
    switch (level) {
      case 'manual': return 'Manual';
      case 'semi-automatic': return 'Semi-Automatic';
      case 'automatic': return 'Automatic';
      default: return 'Unknown';
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="coogi-gradient-bg p-6">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-bold text-primary-foreground">{playbook.name}</CardTitle>
          <Badge variant="default" className="bg-white/20 text-primary-foreground border-none text-xs font-medium backdrop-blur-sm">
            {getAutonomyLabel(playbook.autonomy_level)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <p className="text-sm text-muted-foreground h-12">{playbook.prompt}</p>
      </CardContent>
      <CardFooter className="bg-muted/50 p-4 flex justify-between items-center">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock size={14} />
          {playbook.last_run_at ? (
            <span className="truncate">Last run: {formatDistanceToNow(new Date(playbook.last_run_at), { addSuffix: true })}</span>
          ) : (
            <span>Never run</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onRunDiscovery(playbook.id)} disabled={isRunning} size="sm" className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
            <Play className="mr-2 h-4 w-4" />
            {isRunning ? 'Running...' : 'Run'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <EditPlaybookDialog playbook={playbook} onPlaybookUpdated={onPlaybookUpdated}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              </EditPlaybookDialog>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the "{playbook.name}" playbook. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(playbook.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
}