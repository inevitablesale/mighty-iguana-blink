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

const formatStatusTitle = (status: string): string => {
  if (!status) return 'Unknown';
  // Special case for more user-friendly title
  if (status === 'cooldown') return 'On Cooldown';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export function ExtensionStatusIndicator({ status, message }: ExtensionStatusIndicatorProps) {
  const { color, pulse } = statusConfig[status] || statusConfig.default;
  const title = formatStatusTitle(status);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex w-full items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-sidebar-foreground/90 backdrop-blur-sm transition-colors hover:bg-white/10">
            <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`}></span>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sidebar-foreground">{title}</span>
              <span className="text-xs text-sidebar-foreground/80" title={message}>
                {message}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="bg-background text-foreground max-w-xs">
          <p className="font-bold">{title}</p>
          <p className="whitespace-pre-wrap">{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}