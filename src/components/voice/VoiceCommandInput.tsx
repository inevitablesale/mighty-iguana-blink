import { Mic, Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

interface VoiceCommandInputProps {
  onSubmit: (command: string) => void;
  disabled: boolean;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
  setTranscript: (value: string) => void;
}

export function VoiceCommandInput({
  onSubmit,
  disabled,
  isListening,
  startListening,
  stopListening,
  transcript,
  setTranscript,
}: VoiceCommandInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim()) {
      onSubmit(transcript.trim());
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
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
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Speak or type your command..."
          className="h-14 pl-14 pr-28 text-lg rounded-full bg-background/80 backdrop-blur-sm"
          disabled={disabled}
        />
        <Button
          type="button"
          size="icon"
          onClick={handleMicClick}
          className={`absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full coogi-gradient-bg text-primary-foreground transition-transform ${isListening ? 'animate-pulse scale-110' : ''}`}
        >
          {isListening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          type="submit"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
          disabled={disabled || !transcript.trim()}
        >
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </form>
      <p className="text-center text-xs text-muted-foreground mt-2">
        Click the microphone to speak. The AI will respond when you stop.
      </p>
    </motion.div>
  );
}