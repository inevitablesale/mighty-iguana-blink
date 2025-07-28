import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";

interface PresetPromptsProps {
  onPromptSelect: (prompt: string) => void;
}

const prompts = [
  "Show me B2B SaaS companies in New York hiring for senior sales roles right now — I want to pitch recruitment support.",
  "Find remote fintech startups currently hiring software engineers — especially those with no talent acquisition team.",
  "Which companies in London are hiring for Marketing Director roles? Prioritize ones with urgent or reposted listings.",
  "I’m looking for Series A companies posting product manager roles — flag ones with high salaries or growth signals for outreach.",
];

export function PresetPrompts({ onPromptSelect }: PresetPromptsProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <Lightbulb className="h-4 w-4" />
        Try one of these prompts:
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {prompts.map((prompt, index) => (
          <Button
            key={index}
            variant="outline"
            className="text-left h-auto whitespace-normal justify-start bg-black/20 border-white/10 hover:bg-white/20"
            onClick={() => onPromptSelect(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}