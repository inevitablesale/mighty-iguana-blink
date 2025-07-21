import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export type Speaker = 'ai' | 'user';
export type Message = {
  id: string;
  speaker: Speaker;
  text: string;
  directive?: Directive | null;
};
export type Directive = {
  type: 'task-list' | 'confirmation' | 'progress' | 'briefing';
  title: string;
  payload: any;
};

const initialGreeting: Message = {
  id: '0',
  speaker: 'ai',
  text: "Good morning. You have two urgent tasks: a buyer is requesting a valuation update, and your 'Fintech Sales' agent hasn't run in 4 days. Which should we handle first?",
  directive: {
    type: 'task-list',
    title: 'Priority Tasks',
    payload: ['Handle buyer valuation', 'Run Fintech agent'],
  },
};

export function useDialogueManager() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...message, id: crypto.randomUUID() }]);
  }, []);

  const processUserCommand = useCallback((command: string) => {
    addMessage({ speaker: 'user', text: command });
    setIsSpeaking(true);

    // Simulated Intent Engine
    setTimeout(() => {
      if (command.toLowerCase().includes('buyer')) {
        addMessage({
          speaker: 'ai',
          text: 'Got it. Pulling the valuation report now.',
          directive: { type: 'progress', title: 'Fetching Report', payload: {} },
        });
        // Simulate completion
        setTimeout(() => {
          addMessage({
            speaker: 'ai',
            text: 'The valuation report is ready and has been sent. What's next?",
            directive: { type: 'confirmation', title: 'Report Sent', payload: {} },
          });
          setIsSpeaking(false);
        }, 2000);
      } else if (command.toLowerCase().includes('agent')) {
        addMessage({
          speaker: 'ai',
          text: "Understood. I'm initiating the playbook for the 'Fintech Sales' agent now.",
          directive: { type: 'progress', title: 'Running Playbook', payload: {} },
        });
        setTimeout(() => {
          addMessage({
            speaker: 'ai',
            text: 'The agent has completed its run and found 3 new opportunities. I have prepared a briefing.',
            directive: null,
          });
          setIsSpeaking(false);
        }, 3000);
      } else if (command.toLowerCase().includes('briefing')) {
        navigate('/briefing'); // Navigate to a dedicated briefing view
      } else {
        addMessage({
          speaker: 'ai',
          text: "I'm not sure how to handle that yet. Please try asking about the 'buyer' or the 'agent'.",
          directive: null,
        });
        setIsSpeaking(false);
      }
    }, 500);
  }, [addMessage, navigate]);

  useEffect(() => {
    // Start the conversation on mount
    setIsSpeaking(true);
    setTimeout(() => {
      setMessages([initialGreeting]);
      setIsSpeaking(false);
    }, 1000);
  }, []);

  return { messages, isSpeaking, processUserCommand };
}