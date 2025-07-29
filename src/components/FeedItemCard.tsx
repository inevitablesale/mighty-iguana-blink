import { FeedItem, Opportunity } from "@/types";
import { Bot, User, Users, Loader2, LayoutGrid } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { DealCard } from "./DealCard";
import { Button } from "./ui/button";
import { useUserProfile } from "@/hooks/useUserProfile";
import { FeedbackControl } from "./FeedbackControl";
import { AnalysisProgressView } from "./AnalysisProgressView";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface FeedItemCardProps {
  item: FeedItem;
  isTransient?: boolean;
}

const AgentCreatedResponse = ({ item }: { item: FeedItem }) => {
  return (
    <div className="flex items-start gap-4">
      <div className="bg-primary/10 text-primary p-2 rounded-full flex-shrink-0">
        <Bot className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
          <p className="font-semibold text-white">New Agent Created</p>
          <p className="text-sm text-white/80">
            I've automatically created an agent for you called <span className="font-bold text-white">"{item.content.agentName}"</span>. You can view, edit, or run it from the "Agents" section in the sidebar.
          </p>
        </div>
        <div className="p-3 bg-black/20 border border-dashed border-white/10 rounded-lg text-sm text-white/80">
          <p className="font-semibold text-white">💡 What's happening now?</p>
          <p className="mt-1">
            I'm searching for opportunities based on your new agent's criteria. This can take a minute. You can refine your agent's settings in the sidebar at any time to get different results.
          </p>
        </div>
      </div>
    </div>
  );
};

const SystemResponse = ({ item, isTransient }: { item: FeedItem, isTransient?: boolean }) => {
  const { user } = useUserProfile();
  const [isFindingContacts, setIsFindingContacts] = useState(false);

  const handleFindAllContacts = async () => {
    const opportunities = item.content.opportunities;
    if (!opportunities || opportunities.length === 0) return;
    
    setIsFindingContacts(true);
    const toastId = toast.loading("Queueing contact search for all opportunities...");

    try {
      const opportunityIds = opportunities.map((opp: Opportunity) => opp.id);
      const { error } = await supabase.functions.invoke('batch-create-contact-tasks', {
        body: { opportunityIds }
      });

      if (error) throw error;

      toast.success("Contact search has been queued.", {
        id: toastId,
        description: "You'll see contact details appear on each deal card shortly."
      });
    } catch (err) {
      toast.error("Failed to queue contact search.", {
        id: toastId,
        description: (err as Error).message
      });
    } finally {
      setIsFindingContacts(false);
    }
  };

  return (
    <div className="flex items-start gap-4">
      <div className="bg-primary/10 text-primary p-2 rounded-full flex-shrink-0">
        <Bot className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-white">{item.content.agentName || 'Coogi Assistant'}</p>
              <p className="text-white/80 whitespace-pre-wrap">{item.content.summary}</p>
            </div>
            {user && <FeedbackControl contentId={item.id} contentType="feed_item" userId={user.id} />}
          </div>
          <p className="text-xs text-white/50 mt-1">{formatDistanceToNow(new Date(item.created_at))} ago</p>
        </div>

        {item.content.analysisProgress ? (
          <AnalysisProgressView progress={item.content.analysisProgress} />
        ) : item.content.opportunities && item.content.opportunities.length > 0 ? (
          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {item.content.opportunities.slice(0, 4).map((opp) => (
                      <DealCard key={opp.id} opportunity={opp} />
                  ))}
              </div>
              <div className="mt-4 p-3 bg-black/20 border border-white/10 rounded-lg flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-white/90">What's next?</p>
                  <div className="flex items-center gap-2">
                    {item.content.opportunities && item.content.opportunities.length > 4 && (
                      <Button asChild variant="outline">
                        <Link to="/opportunities" state={{ opportunities: item.content.opportunities, searchParams: item.content.searchParams }}>
                          <LayoutGrid className="mr-2 h-4 w-4" />
                          View All {item.content.opportunities.length} Results
                        </Link>
                      </Button>
                    )}
                    <Button variant="secondary" onClick={handleFindAllContacts} disabled={isFindingContacts}>
                      {isFindingContacts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                      Find Contacts for All
                    </Button>
                  </div>
              </div>
          </div>
        ) : (
          !isTransient && item.type === 'agent_run_summary' && !item.content.analysisProgress && (!item.content.opportunities || item.content.opportunities.length === 0) && (
            <div className="mt-4 p-3 bg-black/20 border border-dashed border-white/20 rounded-lg text-sm text-white/80">
              <p className="font-semibold text-white">💡 Tip: How to get better results</p>
              <p className="mt-1">
                If your search didn't yield good results, try refining the agent I created for you in the sidebar. You can make the search broader (e.g., "SaaS sales roles") and then add more specific criteria in the agent's advanced settings.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

const UserQuery = ({ item }: { item: FeedItem }) => (
    <div className="flex items-start gap-4 justify-end">
        <div className="flex-1 max-w-xl">
            <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-br-none">
                <p className="italic">"{item.content.query}"</p>
            </div>
            <p className="text-xs text-white/50 mt-1 text-right">{formatDistanceToNow(new Date(item.created_at))} ago</p>
        </div>
        <div className="bg-muted/50 p-2 rounded-full flex-shrink-0">
            <User className="h-5 w-5 text-muted-foreground" />
        </div>
    </div>
);


export function FeedItemCard({ item, isTransient }: FeedItemCardProps) {
  const renderContent = () => {
    switch (item.type) {
      case 'agent_run_summary':
        return <SystemResponse item={item} isTransient={isTransient} />;
      case 'user_search':
        return <UserQuery item={item} />;
      case 'agent_created':
        return <AgentCreatedResponse item={item} />;
      default:
        // Fallback for any other system message
        if (item.role === 'system') return <SystemResponse item={item} isTransient={isTransient} />;
        return <p>Unknown feed item role: {item.role}</p>;
    }
  };

  return (
    <div>
      {renderContent()}
    </div>
  );
}