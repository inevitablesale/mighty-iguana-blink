import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/types';
import { Link, useParams } from 'react-router-dom';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';

export function ChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { conversationId } = useParams();

  useEffect(() => {
    const fetchConversations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching conversations", error);
      } else {
        setConversations(data || []);
      }
      setLoading(false);
    };

    fetchConversations();

    const channel = supabase
      .channel('public:conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload) => {
        console.log('Change received!', payload)
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2 px-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto">
      <div className="space-y-1 px-3">
        {conversations.map((convo) => (
          <Link
            key={convo.id}
            to={`/c/${convo.id}`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-white/10",
              conversationId === convo.id ? "bg-white/10 text-sidebar-foreground" : "text-sidebar-foreground/80"
            )}
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{convo.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}