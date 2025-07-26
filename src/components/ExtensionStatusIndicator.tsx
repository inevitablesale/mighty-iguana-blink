import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Circle, CheckCircle, Loader, Clock, AlertTriangle, XCircle } from "lucide-react";

interface ExtensionStatusIndicatorProps {
  status: string;
  message: string;
}

const statusConfig: { [key: string]: { icon: React.ElementType, color: string } } = {
  'idle': { icon: CheckCircle, color: 'text-green-500' },
  'active': { icon: Loader, color: 'text-blue-500' },
  'cooldown': { icon: Clock, color: 'text-yellow-500' },
  'error': { icon: AlertTriangle, color: 'text-red-500' },
  'disconnected': { icon: XCircle, color: 'text-muted-foreground' },
  'connected': { icon: CheckCircle, color: 'text-blue-500' },
  'default': { icon: Circle, color: 'text-muted-foreground' },
};

export function ExtensionStatusIndicator({ status, message }: ExtensionStatusIndicatorProps) {
  const { icon: Icon, color } = statusConfig[status] || statusConfig.default;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-sm">
            <Icon className={`h-4 w-4 ${color} ${status === 'active' ? 'animate-spin' : ''}`} />
            <span className="truncate max-w-[200px]">{message}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}