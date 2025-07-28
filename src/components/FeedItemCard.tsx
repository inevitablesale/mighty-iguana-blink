import { FeedItem } from "@/types";
import { Bot, User } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface FeedItemCardProps {
  item: FeedItem;
}

const SystemResponse = ({ item }: { item: FeedItem }) => (
  <div className="flex items-start gap-4">
    <div className="bg-primary/10 text-primary p-2 rounded-full flex-shrink-0">
      <Bot className="h-5 w-5" />
    </div>
    <div className="flex-1">
      <p className="font-semibold text-white">{item.content.agentName || 'Coogi Assistant'}</p>
      <p className="text-white/80">{item.content.summary}</p>
      <p className="text-xs text-white/50 mt-1">{formatDistanceToNow(new Date(item.created_at))} ago</p>
    </div>
  </div>
);

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


export function FeedItemCard({ item }: FeedItemCardProps) {
  const renderContent = () => {
    switch (item.role) {
      case 'system':
        return <SystemResponse item={item} />;
      case 'user':
        return <UserQuery item={item} />;
      default:
        return <p>Unknown feed item role: {item.role}</p>;
    }
  };

  return (
    <div>
      {renderContent()}
    </div>
  );
}