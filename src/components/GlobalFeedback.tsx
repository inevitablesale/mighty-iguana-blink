import { useFeedback } from '@/contexts/FeedbackContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, Loader, X } from 'lucide-react';
import { Button } from './ui/button';

const icons = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  loading: <Loader className="h-5 w-5 animate-spin" />,
};

export const GlobalFeedback = () => {
  const { feedback, hideFeedback } = useFeedback();

  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-4 rounded-full border bg-background/80 p-3 pl-5 pr-3 shadow-lg backdrop-blur-md max-w-md">
            {icons[feedback.type]}
            <div className="flex-grow">
              <p className="font-semibold">{feedback.message}</p>
              {feedback.description && (
                <p className="text-sm text-muted-foreground">{feedback.description}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={hideFeedback}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};