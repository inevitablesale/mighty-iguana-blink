import { Bot } from "lucide-react";

interface AgentMessageProps {
  children: React.ReactNode;
}

export function AgentMessage({ children }: AgentMessageProps) {
  return (
    <div className="flex items-start gap-4 rounded-lg bg-muted p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0">
        <Bot className="h-6 w-6" />
      </div>
      <div className="text-sm pt-1">{children}</div>
    </div>
  );
}