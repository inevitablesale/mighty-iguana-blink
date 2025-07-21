import { Progress } from "@/components/ui/progress";
import { Bot } from "lucide-react";

interface ModelLoadingToastProps {
  progress: number;
  status: string;
  file: string;
}

export function ModelLoadingToast({ progress, status, file }: ModelLoadingToastProps) {
  let message = "Initializing speech model...";
  if (status === 'progress') {
    message = `Downloading: ${file}`;
  } else if (status === 'done') {
    message = `Processing: ${file}`;
  }

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0">
        <Bot className="h-6 w-6" />
      </div>
      <div className="flex-grow">
        <p className="font-semibold">Loading Speech Model</p>
        <p className="text-sm text-muted-foreground truncate">{message}</p>
        <Progress value={progress} className="w-full mt-2 h-2" />
      </div>
    </div>
  );
}