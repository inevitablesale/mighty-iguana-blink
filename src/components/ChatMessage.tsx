import { cn } from "@/lib/utils";
import { ChatMessage as ChatMessageType } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SweaterIcon } from "./SweaterIcon";
import { OpportunityCard } from "./OpportunityCard";
import { Loader2, Save, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SaveAgentDialog } from "./SaveAgentDialog";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { role, text, opportunities, isLoading, searchParams } = message;
  const isAssistant = role === "assistant";
  const opportunitiesToShow = opportunities?.slice(0, 2) || [];
  const totalOpportunities = opportunities?.length || 0;
  const hasOpportunities = totalOpportunities > 0;

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        !isAssistant && "justify-end"
      )}
    >
      {isAssistant && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <SweaterIcon className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-lg p-3",
          hasOpportunities ? "w-full max-w-3xl" : "max-w-xl",
          isAssistant ? "bg-card border" : "bg-primary text-primary-foreground"
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        ) : (
          <>
            {text && (
              <div className="prose prose-sm prose-invert max-w-none dark:prose-invert">
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            )}
            {hasOpportunities && (
              <div className="mt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {opportunitiesToShow.map((opp) => (
                    <OpportunityCard key={opp.id} opportunity={opp} />
                  ))}
                </div>
                <div className="border-t pt-3 flex flex-col sm:flex-row gap-2">
                  {searchParams && (
                    <SaveAgentDialog searchParams={searchParams}>
                      <Button variant="outline" className="w-full justify-center">
                        <Save className="mr-2 h-4 w-4" />
                        Automate this Search
                      </Button>
                    </SaveAgentDialog>
                  )}
                  <Button asChild variant="secondary" className="w-full justify-center">
                    <Link to="/opportunities" state={{ opportunities, searchParams }}>
                      View All ({totalOpportunities}) & Filter
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}