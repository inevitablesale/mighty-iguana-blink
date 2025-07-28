import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FeedItem } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { FeedItemCard } from '@/components/FeedItemCard';

export default function DealStream() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeedItems = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('feed_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setFeedItems(data);
      } catch (err) {
        toast.error("Failed to fetch your activity feed.", { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchFeedItems();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSearching) return;
    
    setIsSearching(true);
    const toastId = toast.loading("Finding and analyzing deals...", {
      description: "This can take up to a minute. Please wait."
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // Add user's search to the feed optimistically
      const newFeedItem: FeedItem = {
        id: crypto.randomUUID(),
        user_id: user.id,
        type: 'user_search',
        role: 'user',
        content: { query: input },
        created_at: new Date().toISOString(),
      };
      setFeedItems(prev => [newFeedItem, ...prev]);
      await supabase.from('feed_items').insert({ ...newFeedItem, id: undefined });

      const { data, error } = await supabase.functions.invoke('process-chat-command', {
        body: { query: input },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      if (data.opportunities && data.opportunities.length > 0) {
        toast.success(`Found ${data.opportunities.length} new deals!`, { id: toastId });
        navigate('/opportunities', { state: { opportunities: data.opportunities, searchParams: data.searchParams } });
      } else {
        toast.info("No new deals found.", { id: toastId, description: data.text || "Try broadening your search." });
      }
      setInput('');
    } catch (err) {
      toast.error("Search failed", { id: toastId, description: (err as Error).message });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-white/10 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSearch} className="relative">
              <Textarea
                placeholder="Find new deals... e.g., 'Series A fintechs in NY hiring sales leaders'"
                className="min-h-[48px] rounded-2xl resize-none p-4 pr-16 bg-black/30 border-white/20 text-white placeholder:text-white/60"
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
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {loading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full bg-white/10" />)
          ) : feedItems.length > 0 ? (
            feedItems.map(item => 
              <FeedItemCard key={item.id} item={item} />
            )
          ) : (
            <div className="text-center py-16 bg-black/20 border border-dashed border-white/10 rounded-lg backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white">Your Feed is Empty</h3>
              <p className="text-white/70 mt-2">Run an agent or perform a search to get started.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}