import { motion } from 'framer-motion';

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
      className="max-w-2xl"
    >
      <div className="text-xl md:text-2xl font-medium pt-1.5 text-foreground/90">
        {text}
      </div>
    </motion.div>
  );
}