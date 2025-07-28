import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface ExamplePromptsProps {
  onPromptClick: (prompt: string) => void;
}

const prompts = [
  {
    title: "Find Recently Funded Startups",
    description: "in SF that are hiring for sales leaders",
    fullPrompt: "Find me recently funded startups in San Francisco that are hiring for sales leaders.",
  },
  {
    title: "Identify Remote-First Companies",
    description: "hiring for senior software engineers",
    fullPrompt: "Show me remote-first B2B SaaS companies hiring for senior software engineers.",
  },
  {
    title: "Discover Biotech Opportunities",
    description: "in Boston looking for research scientists",
    fullPrompt: "Which biotech firms in Boston are looking for research scientists?",
  },
];

export function ExamplePrompts({ onPromptClick }: ExamplePromptsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {prompts.map((prompt) => (
        <Card
          key={prompt.title}
          onClick={() => onPromptClick(prompt.fullPrompt)}
          className="cursor-pointer group hover:border-white/50 transition-colors bg-black/20 border border-white/10 text-white p-4 flex flex-col justify-between"
        >
          <div>
            <p className="font-semibold text-white">{prompt.title}</p>
            <p className="text-sm text-white/80 mt-1">{prompt.description}</p>
          </div>
          <div className="flex justify-end mt-4">
            <ArrowRight className="h-5 w-5 text-white/50 group-hover:text-white transition-colors" />
          </div>
        </Card>
      ))}
    </div>
  );
}