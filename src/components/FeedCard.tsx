import { ChatMessage as ChatMessageType } from "@/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SweaterIcon } from "./SweaterIcon";
import { OpportunityCard } from "./OpportunityCard";
import { Loader2, Save, ArrowRight, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SaveAgentDialog } from "./SaveAgentDialog";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

// Component for the standard chat bubble
const ChatBubble = ({ message }: { message: ChatMessageType }) => {
  const { role, content, isLoading } = message;
  const { text, opportunities, searchParams } = content;
  const isAssistant = role === "assistant";
  const opportunitiesToShow = opportunities?.slice(0, 4) || [];
  const totalOpportunities = opportunities?.length || 0;
  const hasOpportunities = totalOpportunities > 0;

  return (
    <div className={cn("flex items-start gap-3", !isAssistant && "justify-end")}>
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
          isAssistant ? "bg-black/20 border border-white/10 backdrop-blur-sm" : "bg-primary text-primary-foreground"
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
              <div className="prose prose-sm prose-invert max-w-none dark:prose-invert text-white">
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
                <div className="border-t border-white/20 pt-3 flex flex-col sm:flex-row gap-2">
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
};

// Component for agent run summaries
const AgentRunCard = ({ message }: { message: ChatMessageType }) => {
  const { agentName, summary } = message.content;
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-secondary text-secondary-foreground">
          <Bot className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>
      <div className="w-full max-w-3xl rounded-lg border border-white/10 bg-black/20 p-3 backdrop-blur-sm">
        <p className="text-sm font-semibold text-foreground">
          Agent Run: <span className="text-primary">{agentName}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      </div>
    </div>
  );
};

// Main dispatcher component
export function FeedCard({ message }: { message: ChatMessageType }) {
  switch (message.type) {
    case 'agent_run_summary':
      return <AgentRunCard message={message} />;
    case 'chat':
    default:
      return <ChatBubble message={message} />;
  }
}