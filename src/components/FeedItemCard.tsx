import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedItem } from "@/types";
import { Bot, User } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface FeedItemCardProps {
  item: FeedItem;
}

const AgentRunSummary = ({ item }: { item: FeedItem }) => (
  <div className="flex items-start gap-4">
    <div className="bg-primary/10 text-primary p-2 rounded-full">
      <Bot className="h-5 w-5" />
    </div>
    <div className="flex-1">
      <p className="font-semibold text-white">Agent Run Complete: {item.content.agentName}</p>
      <p className="text-white/80">{item.content.summary}</p>
      <p className="text-xs text-white/50 mt-1">{formatDistanceToNow(new Date(item.created_at))} ago</p>
    </div>
  </div>
);

const UserSearch = ({ item }: { item: FeedItem }) => (
    <div className="flex items-start gap-4">
        <div className="bg-muted/50 p-2 rounded-full">
            <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
            <p className="font-semibold text-white/80">You searched for:</p>
            <p className="text-white/80 italic">"{item.content.query}"</p>
            <p className="text-xs text-white/50 mt-1">{formatDistanceToNow(new Date(item.created_at))} ago</p>
        </div>
    </div>
);


export function FeedItemCard({ item }: FeedItemCardProps) {
  const renderContent = () => {
    switch (item.type) {
      case 'agent_run_summary':
        return <AgentRunSummary item={item} />;
      case 'user_search':
        return <UserSearch item={item} />;
      default:
        return <p>Unknown feed item type: {item.type}</p>;
    }
  };

  return (
    <Card className="w-full bg-black/20 border-white/10 text-white backdrop-blur-sm">
      <CardContent className="p-4">
        {renderContent()}
      </CardContent>
    </Card>
  );
}