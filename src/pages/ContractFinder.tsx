import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FeedItem } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Bot } from 'lucide-react';
import { FeedItemCard } from '@/components/FeedItemCard';

export default function ContractFinder() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchFeedItems = async () => {
      setLoading(true);
      setFeedItems([]);
      if (!conversationId) {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('feed_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setFeedItems(data || []);
      } catch (err) {
        toast.error("Failed to fetch chat history.", { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchFeedItems();
  }, [conversationId]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feedItems]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSearching) return;
    
    const query = input;
    setInput('');
    setIsSearching(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        toast.error("You must be logged in to search.");
        setIsSearching(false);
        return;
    }

    let currentConversationId = conversationId;

    if (!currentConversationId) {
      const { data: newConversation, error: newConvoError } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title: query })
        .select()
        .single();
      
      if (newConvoError) {
        toast.error("Failed to create new chat.", { description: newConvoError.message });
        setIsSearching(false);
        return;
      }
      currentConversationId = newConversation.id;
      navigate(`/c/${currentConversationId}`, { replace: true });
    }

    const userQueryItem: FeedItem = {
      id: crypto.randomUUID(),
      user_id: user.id,
      type: 'user_search',
      role: 'user',
      content: { query },
      created_at: new Date().toISOString(),
      conversation_id: currentConversationId,
    };
    setFeedItems(prev => [...prev, userQueryItem]);
    await supabase.from('feed_items').insert({ ...userQueryItem, id: undefined, conversation_id: currentConversationId });

    const thinkingId = crypto.randomUUID();
    const thinkingItem: FeedItem = {
        id: thinkingId,
        user_id: user.id,
        type: 'agent_run_summary',
        role: 'system',
        content: { agentName: 'Coogi Assistant', summary: 'Thinking...' },
        created_at: new Date().toISOString(),
        conversation_id: currentConversationId,
    };
    setFeedItems(prev => [...prev, thinkingItem]);

    try {
      const { data, error } = await supabase.functions.invoke('process-chat-command', {
        body: { query },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      const systemResponse: FeedItem = {
        id: crypto.randomUUID(),
        user_id: user.id,
        type: 'agent_run_summary',
        role: 'system',
        content: { 
          agentName: 'Coogi Assistant', 
          summary: data.text,
          opportunities: data.opportunities,
          searchParams: data.searchParams,
        },
        created_at: new Date().toISOString(),
        conversation_id: currentConversationId,
      };
      
      setFeedItems(prev => [...prev.filter(item => item.id !== thinkingId), systemResponse]);
      await supabase.from('feed_items').insert({ ...systemResponse, id: undefined });

    } catch (err) {
      setFeedItems(prev => prev.filter(item => item.id !== thinkingId));
      toast.error("Search failed", { description: (err as Error).message });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {loading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full bg-white/10" />)
          ) : feedItems.length > 0 ? (
            feedItems.map(item => 
              <FeedItemCard key={item.id} item={item} />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-24">
              <Bot className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">Welcome to your Contract Finder</h3>
              <p className="mt-2 max-w-md">
                This is your command center. Tell me what kind of deals you're looking for, and I'll get to work. For example, try: "Find me senior sales roles at B2B SaaS companies in New York."
              </p>
            </div>
          )}
          <div ref={feedEndRef} />
        </div>
      </main>
      <footer className="p-4 border-t border-white/10 bg-background/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSearch} className="relative">
              <Textarea
                placeholder="Find new deals... e.g., 'Series A fintechs in NY hiring sales leaders'"
                className="min-h-[48px] rounded-2xl resize-none p-4 pr-16 bg-black/30 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-1 focus-visible:ring-primary"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch(e);
                  }
                }}
                disabled={isSearching}
              />
              <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex items-center">
                <Button type="submit" size="icon" variant="ghost" disabled={isSearching || !input.trim()}>
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  <span className="sr-only">Search</span>
                </Button>
              </div>
            </form>
        </div>
      </footer>
    </div>
  );
}