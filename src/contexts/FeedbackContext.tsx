import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type FeedbackType = 'success' | 'error' | 'info' | 'loading';

interface FeedbackMessage {
  id: string;
  message: string;
  description?: string;
  type: FeedbackType;
}

interface FeedbackContextType {
  feedback: FeedbackMessage | null;
  showFeedback: (feedback: Omit<FeedbackMessage, 'id'>) => void;
  hideFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const hideFeedback = useCallback(() => {
    setFeedback(null);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  const showFeedback = useCallback((feedbackData: Omit<FeedbackMessage, 'id'>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const id = crypto.randomUUID();
    setFeedback({ ...feedbackData, id });

    if (feedbackData.type !== 'loading') {
      const newTimeoutId = setTimeout(() => {
        hideFeedback();
      }, 5000);
      setTimeoutId(newTimeoutId);
    }
  }, [hideFeedback, timeoutId]);

  return (
    <FeedbackContext.Provider value={{ feedback, showFeedback, hideFeedback }}>
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (context === undefined) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};