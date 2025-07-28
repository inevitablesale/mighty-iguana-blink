import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, CornerDownLeft } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export default function Index() {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: uuidv4(),
      role: 'assistant',
      text: "Hello! I'm Coogi, your AI recruiting assistant. How can I help you find and close deals today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !isLoading) return;

    const userMessage: ChatMessageType = {
      id: uuidv4(),
      role: 'user',
      text: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // TODO: Replace with actual API call to the new chat edge function
    setTimeout(() => {
      const assistantMessage: ChatMessageType = {
        id: uuidv4(),
        role: 'assistant',
        text: `This is a placeholder response for: "${userMessage.text}"`,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Placeholder for Chat Messages */}
          {messages.map((message) => (
            <div key={message.id}>
              <p><strong>{message.role}:</strong> {message.text}</p>
            </div>
          ))}
           {isLoading && (
            <div>
              <p><strong>assistant:</strong> Thinking...</p>
            </div>
          )}
        </div>
      </div>
      <div className="border-t bg-background px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSendMessage} className="relative">
            <Textarea
              placeholder="e.g., Find me Series A companies in SF hiring for a Head of Sales..."
              className="min-h-[48px] rounded-2xl resize-none p-4 pr-24"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  handleSendMessage(e);
                }
              }}
              disabled={isLoading}
            />
            <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex items-center gap-2">
              <Button type="button" size="icon" variant="ghost" disabled={isLoading}>
                <Mic className="h-5 w-5" />
                <span className="sr-only">Use Microphone</span>
              </Button>
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-5 w-5" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Press <CornerDownLeft className="h-3 w-3 inline-block" /> to send, Shift + <CornerDownLeft className="h-3 w-3 inline-block" /> for a new line.
          </p>
        </div>
      </div>
    </div>
  );
}