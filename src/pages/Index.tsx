import { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { OpportunityList } from "@/components/OpportunityList";
import { Opportunity } from "@/components/OpportunityCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client"; // Import Supabase client

interface Message {
  id: number;
  sender: "user" | "ai";
  content: React.ReactNode;
}

// Mock opportunities are still here for display purposes,
// but the AI response will come from the Edge Function.
const mockOpportunities: Opportunity[] = [
  {
    companyName: "InnovateTech",
    role: "Senior Frontend Developer",
    location: "Austin, TX",
    potential: "High",
    hiringUrgency: "High",
  },
  {
    companyName: "DataSolutions",
    role: "Backend Engineer",
    location: "Dallas, TX",
    potential: "Medium",
    hiringUrgency: "High",
  },
  {
    companyName: "CloudNet",
    role: "DevOps Specialist",
    location: "Houston, TX",
    potential: "High",
    hiringUrgency: "Medium",
  },
];

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
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (error) {
        console.error("Error invoking Edge Function:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "ai",
            content: <p className="text-destructive">Error: {error.message}. Please try again.</p>,
          },
        ]);
      } else {
        // Assuming the Edge Function returns { response: "AI's text" }
        const aiResponseText = data.response;

        // For demonstration, if the AI response indicates a search, show mock opportunities
        let aiContent: React.ReactNode = <p>{aiResponseText}</p>;
        if (aiResponseText.toLowerCase().includes("searching for tech companies")) {
          aiContent = (
            <>
              <p className="mb-4">{aiResponseText}</p>
              <OpportunityList opportunities={mockOpportunities} />
            </>
          );
        }

        const aiMessage: Message = {
          id: Date.now() + 1,
          sender: "ai",
          content: aiContent,
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (networkError) {
      console.error("Network error calling Edge Function:", networkError);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          content: <p className="text-destructive">Network error. Please check your connection.</p>,
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