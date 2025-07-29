import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/types';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { MessageSquare, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

export function ChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const fetchConversations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching conversations", error);
      toast.error("Could not load chat history.");
    } else {
      setConversations(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('sidebar-chat-history-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  const handleDelete = async (e: React.MouseEvent, convoToDeleteId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      return;
    }

    const toastId = toast.loading("Deleting chat...");

    try {
      // First, delete all associated feed items
      const { error: feedError } = await supabase
        .from('feed_items')
        .delete()
        .eq('conversation_id', convoToDeleteId);

      if (feedError) throw feedError;

      // Then, delete the conversation
      const { error: convoError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', convoToDeleteId);

      if (convoError) throw convoError;

      toast.success("Chat deleted successfully.", { id: toastId });

      // If the active chat was deleted, navigate to home
      if (conversationId === convoToDeleteId) {
        navigate('/');
      }
      // The real-time subscription will handle the UI update

    } catch (error) {
      toast.error("Failed to delete chat.", { id: toastId, description: (error as Error).message });
    }
  };

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
    <div>
      <div className="space-y-1 px-3">
        {conversations.map((convo) => (
          <Link
            key={convo.id}
            to={`/c/${convo.id}`}
            className={cn(
              "group flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-white/10",
              conversationId === convo.id ? "bg-white/10 text-sidebar-foreground" : "text-sidebar-foreground/80"
            )}
          >
            <div className="flex items-center gap-3 truncate">
              <MessageSquare className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{convo.title}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400"
              onClick={(e) => handleDelete(e, convo.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}