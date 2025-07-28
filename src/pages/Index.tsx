import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FeedCard } from '@/components/FeedCard';

// New component for the input form at the top
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
  const [messages, setMessages] = useState<ChatMessageType[]>([
    // Mock data to show the new UI
    {
      id: uuidv4(),
      role: 'system',
      type: 'agent_run_summary',
      agentName: 'Bay Area Fintech Sales',
      summary: 'Agent run complete. Found 3 new opportunities and queued them for contact discovery.',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    },
    {
      id: uuidv4(),
      role: 'assistant',
      type: 'chat',
      text: "Hello! I'm Coogi, your AI partner. Based on your active agents, I'm keeping an eye out for fintech sales roles. What should we focus on right now?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const submitQuery = async (query: string) => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage: ChatMessageType = {
      id: uuidv4(),
      role: 'user',
      type: 'chat',
      text: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const loadingMessageId = uuidv4();
    const loadingMessage: ChatMessageType = {
      id: loadingMessageId,
      role: 'assistant',
      type: 'chat',
      isLoading: true,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const { data, error } = await supabase.functions.invoke('process-chat-command', {
        body: { query },
      });

      if (error) throw new Error(error.message);

      const finalMessage: ChatMessageType = {
        id: loadingMessageId, // Replace loading message
        role: 'assistant',
        type: 'chat',
        text: data.text,
        opportunities: data.opportunities,
        searchParams: data.searchParams,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => prev.map(msg => msg.id === loadingMessageId ? finalMessage : msg));

    } catch (err) {
      const errorMessage = (err as Error).message;
      toast.error(errorMessage);
      setMessages(prev => prev.filter(msg => !msg.isLoading));
    } finally {
      setIsLoading(false);
    }
  };

  // Sort messages by timestamp before rendering
  const sortedMessages = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      <Composer onSendMessage={submitQuery} isLoading={isLoading} />
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {sortedMessages.map((message) => (
            <FeedCard key={message.id} message={message} />
          ))}
        </div>
      </div>
    </div>
  );
}