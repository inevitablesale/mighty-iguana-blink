import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCanvas, CanvasView } from '@/contexts/CanvasContext';

export type Speaker = 'ai' | 'user';
export type Message = {
  id: string;
  speaker: Speaker;
  text: string;
  directive?: Directive | null;
};
export type Directive = {
  type: 'task-list' | 'confirmation' | 'progress' | 'briefing' | 'open-dialog';
  title: string;
  payload: any;
};

const initialGreeting: Message = {
  id: '0',
  speaker: 'ai',
  text: "Welcome to Coogi. What would you like to see first?",
  directive: null,
};

export function useDialogueManager() {
  const { setCurrentView } = useCanvas();
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    const newMessage = { ...message, id: crypto.randomUUID() };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const processUserCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    addMessage({ speaker: 'user', text: command });

    try {
      const { data: intentData, error: intentError } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (intentError) throw intentError;

      const aiResponseText = intentData.responseText || "Sorry, I'm not sure how to respond to that.";
      addMessage({ speaker: 'ai', text: aiResponseText });

      switch (intentData.intent) {
        case 'CREATE_AGENT':
          addMessage({
            speaker: 'ai',
            text: aiResponseText,
            directive: { type: 'open-dialog', title: 'Create Agent', payload: 'add-agent' },
          });
          break;
        
        case 'NAVIGATE': {
          const view = intentData.entities?.view as CanvasView;
          if (view) {
            setCurrentView(view);
          }
          break;
        }

        case 'CLOSE_VIEW':
          setCurrentView(null);
          break;

        // Other intents like RUN_AGENT can be handled here in the future
        default:
          break;
      }
    } catch (e) {
      const err = e as Error;
      console.error("Error processing command:", err);
      addMessage({ speaker: 'ai', text: "Sorry, I'm having trouble understanding right now. Please try again." });
    }
  }, [addMessage, setCurrentView]);

  useEffect(() => {
    setTimeout(() => {
      addMessage(initialGreeting);
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { messages, processUserCommand };
}