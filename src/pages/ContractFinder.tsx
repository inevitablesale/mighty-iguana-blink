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
import { PresetPrompts } from '@/components/PresetPrompts';

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
        const { data, error } = await supabase.from('feed_items').select('*').eq('user_id', user.id).eq('conversation_id', conversationId).order('created_at', { ascending: true });
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

  const executeSearch = async (query: string) => {
    if (!query.trim() || isSearching) return;
    
    setInput('');
    setIsSearching(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user || !session) {
        toast.error("You must be logged in to search.");
        setIsSearching(false);
        return;
    }

    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const { data: newConversation, error } = await supabase.from('conversations').insert({ user_id: user.id, title: query }).select().single();
      if (error) { toast.error("Failed to create new chat.", { description: error.message }); setIsSearching(false); return; }
      currentConversationId = newConversation.id;
      navigate(`/c/${currentConversationId}`, { replace: true });
    }

    const userQueryItem: FeedItem = { id: crypto.randomUUID(), user_id: user.id, type: 'user_search', role: 'user', content: { query }, created_at: new Date().toISOString(), conversation_id: currentConversationId };
    setFeedItems(prev => [...prev, userQueryItem]);
    await supabase.from('feed_items').insert({ ...userQueryItem, id: undefined });

    const systemResponseId = crypto.randomUUID();
    const systemResponseItem: FeedItem = { id: systemResponseId, user_id: user.id, type: 'agent_run_summary', role: 'system', content: { agentName: 'Coogi Assistant', summary: 'AI Search powered by ContractGPT...' }, created_at: new Date().toISOString(), conversation_id: currentConversationId };
    setFeedItems(prev => [...prev, systemResponseItem]);

    try {
      const response = await fetch(`https://dbtdplhlatnlzcvdvptn.supabase.co/functions/v1/process-chat-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ query }),
      });

      if (!response.body) throw new Error("The response body is empty.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalResultSaved = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonString = line.substring(6);
            if (!jsonString) continue;
            const data = JSON.parse(jsonString);

            if (data.type === 'status') {
              setFeedItems(prev => prev.map(item => item.id === systemResponseId ? { ...item, content: { ...item.content, summary: data.message } } : item));
            } else if (data.type === 'result' && !finalResultSaved) {
              const finalContent = { agentName: 'Coogi Assistant', summary: data.payload.text, opportunities: data.payload.opportunities, searchParams: data.payload.searchParams };
              setFeedItems(prev => prev.map(item => item.id === systemResponseId ? { ...item, content: finalContent } : item));
              await supabase.from('feed_items').insert({ user_id: user.id, conversation_id: currentConversationId, type: 'agent_run_summary', role: 'system', content: finalContent });
              finalResultSaved = true;
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }
    } catch (err) {
      setFeedItems(prev => prev.filter(item => item.id !== systemResponseId));
      toast.error("Search failed", { description: (err as Error).message });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(input);
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
              <h3 className="text-xl font-semibold text-foreground">AI Search powered by ContractGPT</h3>
              <p className="mt-2 max-w-md">
                This is your command center. Tell me what kind of deals you're looking for, and I'll get to work.
              </p>
              <div className="mt-8 w-full max-w-2xl">
                <PresetPrompts onPromptSelect={executeSearch} />
              </div>
            </div>
          )}
          <div ref={feedEndRef} />
        </div>
      </main>
      <footer className="p-4 border-t border-white/10 bg-background/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
            <form onSubmit={handleFormSubmit} className="relative">
              <Textarea
                placeholder="Find new deals... e.g., 'Series A fintechs in NY hiring sales leaders'"
                className="min-h-[48px] rounded-2xl resize-none p-4 pr-16 bg-black/30 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-1 focus-visible:ring-primary"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleFormSubmit(e);
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