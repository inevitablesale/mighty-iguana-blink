import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface ExamplePromptsProps {
  onPromptClick: (prompt: string) => void;
}

const prompts = [
  {
    title: "Find Fintech Startups",
    description: "in New York that just raised a Series B",
    fullPrompt: "Find me fintech startups in New York that just raised a Series B",
  },
  {
    title: "Search for Remote Sales Roles",
    description: "at B2B SaaS companies for senior account executives",
    fullPrompt: "Show me B2B SaaS companies hiring for remote senior account executives",
  },
  {
    title: "Look for Gaming Jobs",
    description: "in London for a Lead Producer position",
    fullPrompt: "Are there any gaming companies in London looking for a Lead Producer?",
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