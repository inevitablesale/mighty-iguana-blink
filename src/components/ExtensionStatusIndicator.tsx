import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Circle, CheckCircle, Loader, Clock, AlertTriangle, XCircle } from "lucide-react";

interface ExtensionStatusIndicatorProps {
  status: string;
  message: string;
}

const statusConfig: { [key: string]: { icon: React.ElementType, color: string, pulse: boolean } } = {
  'idle': { icon: CheckCircle, color: 'text-green-400', pulse: false },
  'active': { icon: Loader, color: 'text-blue-400', pulse: true },
  'cooldown': { icon: Clock, color: 'text-yellow-400', pulse: false },
  'error': { icon: AlertTriangle, color: 'text-red-400', pulse: false },
  'disconnected': { icon: XCircle, color: 'text-slate-400', pulse: false },
  'connected': { icon: CheckCircle, color: 'text-blue-400', pulse: false },
  'default': { icon: Circle, color: 'text-slate-500', pulse: false },
};

export function ExtensionStatusIndicator({ status, message }: ExtensionStatusIndicatorProps) {
  const { icon: Icon, color, pulse } = statusConfig[status] || statusConfig.default;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-sidebar-foreground/90 backdrop-blur-sm transition-colors hover:bg-white/10">
            <div className="relative flex h-4 w-4 items-center justify-center">
              {status === 'active' && (
                <span className={`absolute inline-flex h-3 w-3 animate-ping rounded-full ${color.replace('text-', 'bg-')} opacity-75`}></span>
              )}
              <Icon className={`relative h-4 w-4 ${color} ${pulse ? 'animate-spin' : ''}`} />
            </div>
            <span className="truncate">{message}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="bg-background text-foreground">
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}