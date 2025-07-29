import { AnalysisProgress } from "@/types";
import { Loader2, CheckCircle, Star, XCircle } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";

interface AnalysisProgressViewProps {
  progress: AnalysisProgress;
}

export function AnalysisProgressView({ progress }: AnalysisProgressViewProps) {
  const analyzedCount = progress.jobs.filter(j => j.status === 'analyzed' || j.status === 'error').length;

  return (
    <div className="mt-2 p-3 bg-black/20 border border-white/10 rounded-lg">
      <h4 className="text-sm font-semibold mb-2 text-white/90">
        Analysis Progress ({analyzedCount} / {progress.jobs.length})
      </h4>
      <ScrollArea className="h-48">
        <div className="space-y-2 pr-4">
          {progress.jobs.map((job, index) => {
            let icon;
            switch (job.status) {
              case 'analyzing':
              case 'pending':
                icon = <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />;
                break;
              case 'analyzed':
                icon = <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
                break;
              case 'error':
                icon = <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
                break;
              default:
                icon = <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />;
            }

            return (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 truncate">
                  {icon}
                  <div className="truncate">
                    <p className="text-white/90 truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.company}</p>
                  </div>
                </div>
                {job.status === 'analyzed' && job.match_score && (
                  <div className="flex items-center gap-1 text-xs font-bold text-yellow-400 flex-shrink-0 ml-2">
                    <Star className="h-3 w-3" />
                    <span>{job.match_score}/10</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}