import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

interface AIResponseNarratorProps {
  text: string;
}

export function AIResponseNarrator({ text }: AIResponseNarratorProps) {
  const variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      className="flex items-start gap-4 max-w-2xl"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0">
        <Bot className="h-6 w-6" />
      </div>
      <div className="text-lg md:text-xl pt-1.5 text-foreground/90">
        {text}
      </div>
    </motion.div>
  );
}