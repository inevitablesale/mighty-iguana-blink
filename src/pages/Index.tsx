import { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { OpportunityList } from "@/components/OpportunityList";
import { Opportunity } from "@/components/OpportunityCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";

interface Message {
  id: number;
  sender: "user" | "ai";
  content: React.ReactNode;
}

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

  const handleSendCommand = (command: string) => {
    setIsLoading(true);
    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      content: <p>{command}</p>,
    };
    setMessages((prev) => [...prev, userMessage]);

    setTimeout(() => {
      const thinkingMessage: Message = {
        id: Date.now() + 1,
        sender: "ai",
        content: <p>On it. I'm searching for tech companies hiring developers in Texas...</p>,
      };
      setMessages((prev) => [...prev, thinkingMessage]);

      setTimeout(() => {
        const resultsMessage: Message = {
          id: Date.now() + 2,
          sender: "ai",
          content: <OpportunityList opportunities={mockOpportunities} />,
        };
        setMessages((prev) => [...prev, resultsMessage]);
        setIsLoading(false);
      }, 2000);
    }, 1000);
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