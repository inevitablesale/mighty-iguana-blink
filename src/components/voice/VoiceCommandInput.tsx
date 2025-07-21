import { useState } from 'react';
import { Mic, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

interface VoiceCommandInputProps {
  onSubmit: (command: string) => void;
  disabled: boolean;
}

export function VoiceCommandInput({ onSubmit, disabled }: VoiceCommandInputProps) {
  const [command, setCommand] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onSubmit(command.trim());
      setCommand('');
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="w-full max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="relative">
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Speak or type your command..."
          className="h-14 pl-14 pr-28 text-lg rounded-full bg-background/80 backdrop-blur-sm"
          disabled={disabled}
        />
        <Button
          type="button"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full coogi-gradient-bg text-primary-foreground"
          disabled={disabled}
        >
          <Mic className="h-5 w-5" />
        </Button>
        <Button
          type="submit"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
          disabled={disabled || !command.trim()}
        >
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </form>
      <p className="text-center text-xs text-muted-foreground mt-2">
        Voice input is simulated. Type your command to interact with the AI.
      </p>
    </motion.div>
  );
}