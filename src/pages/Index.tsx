import { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SearchParameters } from "@/components/SearchParameters";

interface Message {
  id: number;
  sender: "user" | "ai";
  content: React.ReactNode;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: "ai",
      content: (
        <div>
          <h2 className="text-xl font-semibold mb-2">Welcome to your AI Recruiting Assistant.</h2>
          <p className="text-muted-foreground">
            You can start by telling me what kind of opportunities you're looking for. For example:
            <br />
            <em className="text-foreground">"Find 50 tech companies hiring developers in Texas."</em>
          </p>
        </div>
      ),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendCommand = async (command: string) => {
    setIsLoading(true);
    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      content: <p>{command}</p>,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const { data, error } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (error) {
        throw new Error(error.message);
      }

      const aiResponse = data;
      let aiContent: React.ReactNode;

      if (aiResponse && (aiResponse.role || aiResponse.location || aiResponse.vertical || (aiResponse.keywords && aiResponse.keywords.length > 0))) {
        aiContent = (
          <div>
            <p className="mb-2">Great! I've parsed your request. Here are the search criteria I'll use:</p>
            <SearchParameters params={aiResponse} />
            <p className="mt-4 text-sm text-muted-foreground">
              This is the first step towards full automation. Soon, I'll be able to use this to find and contact candidates for you.
            </p>
          </div>
        );
      } else {
        aiContent = <p>I'm sorry, I couldn't understand that as a search command. Please try again with more specific details about the role, location, or keywords.</p>;
      }

      const aiMessage: Message = {
        id: Date.now() + 1,
        sender: "ai",
        content: aiContent,
      };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (e) {
      const error = e as Error;
      console.error("Error calling Edge Function:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          content: <p className="text-destructive">Error: {error.message}. Please check the function logs and try again.</p>,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex-1 overflow-auto pr-4">
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-4 ${
                    message.sender === "user" ? "justify-end" : ""
                  }`}
                >
                  {message.sender === "ai" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback><Bot size={20} /></AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-2xl rounded-lg p-3 ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.sender === "user" && (
                     <Avatar className="h-8 w-8">
                      <AvatarFallback><User size={20} /></AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="mt-auto bg-background pb-4">
            <CommandBar onSendCommand={handleSendCommand} isLoading={isLoading} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;