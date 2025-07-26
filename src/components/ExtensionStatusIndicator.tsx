import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExtensionStatusIndicatorProps {
  status: string;
  message: string;
}

const statusConfig: { [key: string]: { color: string; pulse: boolean } } = {
  'idle': { color: 'bg-green-500', pulse: false },
  'connected': { color: 'bg-green-500', pulse: false },
  'active': { color: 'bg-yellow-500', pulse: true },
  'cooldown': { color: 'bg-yellow-500', pulse: false },
  'error': { color: 'bg-red-500', pulse: false },
  'disconnected': { color: 'bg-red-500', pulse: false },
  'default': { color: 'bg-slate-500', pulse: false },
};

export function ExtensionStatusIndicator({ status, message }: ExtensionStatusIndicatorProps) {
  const { color, pulse } = statusConfig[status] || statusConfig.default;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-sidebar-foreground/90 backdrop-blur-sm transition-colors hover:bg-white/10">
            <span className={`h-2.5 w-2.5 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`}></span>
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