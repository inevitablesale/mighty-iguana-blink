import { LogEntry } from "@/context/ExtensionContext";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Info, AlertTriangle, XCircle } from "lucide-react";

interface ExtensionLogViewerProps {
  logs: LogEntry[];
}

const logConfig = {
  log: { icon: <Terminal size={14} className="text-gray-500" />, color: "text-gray-400" },
  info: { icon: <Info size={14} className="text-blue-500" />, color: "text-blue-400" },
  warn: { icon: <AlertTriangle size={14} className="text-yellow-500" />, color: "text-yellow-400" },
  error: { icon: <XCircle size={14} className="text-red-500" />, color: "text-red-400" },
};

export function ExtensionLogViewer({ logs }: ExtensionLogViewerProps) {
  const formatArgs = (args: any[]) => {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return '[Unserializable Object]';
        }
      }
      return String(arg);
    }).join(' ');
  };

  return (
    <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/50 p-2 font-mono text-xs">
      {logs.length > 0 ? (
        logs.map((log, index) => {
          const config = logConfig[log.type] || logConfig.log;
          return (
            <div key={index} className={`flex items-start gap-2 p-1.5 border-b border-muted ${config.color}`}>
              <div className="flex-shrink-0 pt-0.5">{config.icon}</div>
              <div className="flex-shrink-0">{format(new Date(log.timestamp), "HH:mm:ss")}</div>
              <div className="flex-grow whitespace-pre-wrap break-words">{formatArgs(log.args)}</div>
            </div>
          );
        })
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      )}
    </ScrollArea>
  );
}