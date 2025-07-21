import { motion, AnimatePresence } from 'framer-motion';
import { Directive } from '@/hooks/useDialogueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader, List } from 'lucide-react';
import { Button } from '../ui/button';

interface DirectiveCardProps {
  directive: Directive | null;
}

export function DirectiveCard({ directive }: DirectiveCardProps) {
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  const renderContent = () => {
    if (!directive) return null;

    switch (directive.type) {
      case 'task-list':
        return (
          <>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <List className="h-5 w-5 text-primary" />
              <CardTitle>{directive.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {directive.payload.map((task: string, index: number) => (
                <div key={index} className="text-muted-foreground">{task}</div>
              ))}
            </CardContent>
          </>
        );
      case 'progress':
        return (
          <CardContent className="flex flex-col items-center justify-center gap-4 p-8">
            <Loader className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">{directive.title}...</p>
          </CardContent>
        );
      case 'confirmation':
        return (
          <CardContent className="flex flex-col items-center justify-center gap-4 p-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-xl font-semibold">{directive.title}</p>
          </CardContent>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {directive && (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          layout
        >
          <Card className="w-full max-w-md bg-background/80 backdrop-blur-sm">
            {renderContent()}
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}