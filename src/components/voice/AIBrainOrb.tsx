import { motion, Variants } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';

interface AIBrainOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
}

export function AIBrainOrb({ isListening, isSpeaking }: AIBrainOrbProps) {
  const orbState = isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle';

  const orbVariants: Variants = {
    idle: {
      scale: 1,
      boxShadow: '0 0 30px hsl(var(--primary) / 0.2)',
      transition: { duration: 2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
    },
    listening: {
      scale: [1, 1.05, 1],
      boxShadow: ['0 0 20px hsl(var(--accent) / 0.4)', '0 0 50px hsl(var(--accent) / 0.6)', '0 0 20px hsl(var(--accent) / 0.4)'],
      transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
    },
    speaking: {
      scale: 1,
      boxShadow: '0 0 40px hsl(var(--secondary) / 0.5)',
      transition: { duration: 0.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
    }
  };

  return (
    <motion.div
      className="relative flex h-40 w-40 items-center justify-center rounded-full coogi-gradient-bg"
      variants={orbVariants}
      animate={orbState}
      initial="idle"
    >
      <BrainCircuit className="h-20 w-20 text-primary-foreground/80" />
    </motion.div>
  );
}