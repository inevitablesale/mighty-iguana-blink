import { cn } from "@/lib/utils";
import { ChatMessage as ChatMessageType } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SweaterIcon } from "./SweaterIcon";
import { OpportunityCard } from "./OpportunityCard";
import { Loader2, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SaveAgentDialog } from "./SaveAgentDialog";
import { Button } from "./ui/button";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { role, text, opportunities, isLoading, searchParams } = message;
  const isAssistant = role === "assistant";

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        !isAssistant && "justify-end"
      )}
    >
      {isAssistant && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary">
            <SweaterIcon className="h-5 w-5 text-primary-foreground" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-lg p-3 text-white backdrop-blur-sm border border-white/10",
          opportunities && opportunities.length > 0 ? "max-w-3xl" : "max-w-xl",
          isAssistant
            ? "bg-black/20"
            : "bg-white/10"
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        ) : (
          <>
            {text && (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            )}
            {opportunities && opportunities.length > 0 && (
              <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3", text ? "mt-3" : "")}>
                {opportunities.map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </div>
            )}
            {searchParams && opportunities && opportunities.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <SaveAgentDialog searchParams={searchParams}>
                  <Button variant="outline" className="bg-transparent hover:bg-white/10 border-white/20 w-full">
                    <Save className="mr-2 h-4 w-4" />
                    Save this Search as an Agent
                  </Button>
                </SaveAgentDialog>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}