import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { ChatMessage as ChatMessageType, Opportunity } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FeedCard } from '@/components/FeedCard';
import { Skeleton } from '@/components/ui/skeleton';

const Composer = ({ onSendMessage, isLoading }: { onSendMessage: (query: string) => void, isLoading: boolean }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="bg-background/80 backdrop-blur-sm border-b px-4 py-3 sticky top-0 z-10">
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            placeholder="What kind of roles are we targeting today?"
            className="min-h-[48px] rounded-2xl resize-none p-4 pr-16 bg-muted border-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                handleSubmit(e);
              }
            }}
            disabled={isLoading}
          />
          <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex items-center">
            <Button type="submit" size="icon" variant="ghost" disabled={isLoading || !input.trim()}>
              <Send className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Index() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchHistoryAndFeatured = useCallback(async () => {
    setIsHistoryLoading(true);
    
    // Fetch chat history
    const { data: historyData, error: historyError } = await supabase
      .from('feed_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (historyError) {
      toast.error("Failed to load chat history.");
      setIsHistoryLoading(false);
      return;
    }

    let allMessages: ChatMessageType[] = historyData || [];

    // Fetch featured opportunities
    try {
      const { data: featuredData, error: featuredError } = await supabase.functions.invoke('get-featured-opportunities');
      if (featuredError) throw featuredError;

      if (featuredData.opportunities && featuredData.opportunities.length > 0) {
        const featuredMessages: ChatMessageType[] = featuredData.opportunities.map((opp: Opportunity) => ({
          id: opp.id || uuidv4(),
          role: 'system',
          type: 'featured_opportunity',
          created_at: new Date().toISOString(),
          content: {
            summary: "Here's a high-value opportunity from today's market scan you might be interested in.",
            opportunity: opp,
          }
        }));
        allMessages = [...allMessages, ...featuredMessages];
      }
    } catch (err) {
      console.warn("Could not fetch featured opportunities:", (err as Error).message);
    }

    if (allMessages.length === 0) {
      allMessages.push({
        id: uuidv4(),
        role: 'assistant',
        type: 'chat',
        created_at: new Date().toISOString(),
        content: {
          text: "Hello! I'm Coogi, your AI partner. What should we focus on right now?",
        }
      });
    }
    
    // Sort all messages by date before setting state
    allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setMessages(allMessages);
    setIsHistoryLoading(false);
  }, []);

  useEffect(() => {
    fetchHistoryAndFeatured();

    const channel = supabase
      .channel('feed-items-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_items' },
        (payload) => {
          setMessages((prevMessages) => [...prevMessages, payload.new as ChatMessageType]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHistoryAndFeatured]);

  const submitQuery = async (query: string) => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    const userMessageContent = { text: query };
    
    const userMessageForUI: ChatMessageType = {
      id: uuidv4(),
      role: 'user',
      type: 'chat',
      created_at: new Date().toISOString(),
      content: userMessageContent,
    };
    setMessages(prev => [...prev, userMessageForUI]);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('feed_items').insert({
        user_id: user.id,
        role: 'user',
        type: 'chat',
        content: userMessageContent
      });
    }

    const loadingMessageId = uuidv4();
    const loadingMessage: ChatMessageType = {
      id: loadingMessageId,
      role: 'assistant',
      type: 'chat',
      created_at: new Date().toISOString(),
      content: {},
      isLoading: true,
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const { data: functionData, error } = await supabase.functions.invoke('process-chat-command', {
        body: { query },
      });

      if (error) throw new Error(error.message);

      const assistantMessageContent = {
        text: functionData.text,
        opportunities: functionData.opportunities,
        searchParams: functionData.searchParams,
      };

      if (user) {
        await supabase.from('feed_items').insert({
          user_id: user.id,
          role: 'assistant',
          type: 'chat',
          content: assistantMessageContent,
        });
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

    } catch (err) {
      const errorMessage = (err as Error).message;
      toast.error("An error occurred", { description: errorMessage });
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      <Composer onSendMessage={submitQuery} isLoading={isLoading} />
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {isHistoryLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="h-16 w-3/4 ml-auto" />
              <Skeleton className="h-16 w-3/4" />
            </div>
          ) : (
            messages.map((message) => (
              <FeedCard key={message.id} message={message} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}