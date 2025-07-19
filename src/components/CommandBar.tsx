import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CornerDownLeft } from "lucide-react";

interface CommandBarProps {
  onSendCommand: (command: string) => void;
  isLoading: boolean;
}

export function CommandBar({ onSendCommand, isLoading }: CommandBarProps) {
  const [command, setCommand] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && !isLoading) {
      onSendCommand(command);
      setCommand("");
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <Input
          placeholder="e.g., Find contracts for nurses in New York"
          value={command}
          onChange={(e) => setCommand((e.target as HTMLInputElement).value)}
          className="pr-16"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" disabled={isLoading}>
          <CornerDownLeft className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}