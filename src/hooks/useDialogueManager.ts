import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpeech } from './useSpeech';

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
  const { isSpeaking, speak, cancelSpeech } = useSpeech();

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    const newMessage = { ...message, id: crypto.randomUUID() };
    setMessages(prev => [...prev, newMessage]);
    if (newMessage.speaker === 'ai') {
      speak(newMessage.text);
    }
  }, [speak]);

  const processUserCommand = useCallback((command: string) => {
    if (!command.trim()) return;
    cancelSpeech();
    const lowerCaseCommand = command.toLowerCase();
    addMessage({ speaker: 'user', text: command });

    // Simulated Intent Engine
    setTimeout(() => {
      if (lowerCaseCommand.includes('buyer')) {
        addMessage({
          speaker: 'ai',
          text: 'Got it. Pulling the valuation report now.',
          directive: { type: 'progress', title: 'Fetching Report', payload: {} },
        });
        setTimeout(() => {
          addMessage({
            speaker: 'ai',
            text: "The valuation report is ready and has been sent. What's next?",
            directive: { type: 'confirmation', title: 'Report Sent', payload: {} },
          });
        }, 2000);
      } else if (lowerCaseCommand.includes('build an agent') || lowerCaseCommand.includes('create an agent') || lowerCaseCommand.includes('new agent')) {
        addMessage({
          speaker: 'ai',
          text: "Of course. Let's build a new agent. I'll take you there now.",
          directive: null,
        });
        setTimeout(() => navigate('/agents?action=new'), 500);
      } else if (lowerCaseCommand.includes('agent')) {
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
        }, 3000);
      } else if (lowerCaseCommand.includes('briefing')) {
        addMessage({
            speaker: 'ai',
            text: "Of course. Navigating to the briefing view now.",
            directive: null,
        });
        setTimeout(() => navigate('/briefing'), 500);
      } else {
        addMessage({
          speaker: 'ai',
          text: "I'm not sure how to handle that yet. Please try asking about the 'buyer' or the 'agent'.",
          directive: null,
        });
      }
    }, 500);
  }, [addMessage, navigate, cancelSpeech]);

  useEffect(() => {
    // Start the conversation on mount
    setTimeout(() => {
      addMessage(initialGreeting);
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { messages, isSpeaking, processUserCommand };
}