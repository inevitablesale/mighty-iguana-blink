import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    const newMessage = { ...message, id: crypto.randomUUID() };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const processUserCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    addMessage({ speaker: 'user', text: command });

    try {
      const { data: intentData, error } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (error) throw error;

      switch (intentData.intent) {
        case 'HANDLE_VALUATION':
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
          break;

        case 'CREATE_AGENT':
          addMessage({
            speaker: 'ai',
            text: "Of course. I'll open the new agent form for you.",
            directive: { type: 'open-dialog', title: 'Create Agent', payload: 'add-agent' },
          });
          break;

        case 'RUN_AGENT':
          const agentName = intentData.entities?.agent_name || 'the agent';
          addMessage({
            speaker: 'ai',
            text: `Understood. I'm initiating the playbook for the '${agentName}' agent now.`,
            directive: { type: 'progress', title: 'Running Playbook', payload: {} },
          });
          setTimeout(() => {
            addMessage({
              speaker: 'ai',
              text: 'The agent has completed its run and found 3 new opportunities. I have prepared a briefing.',
              directive: null,
            });
          }, 3000);
          break;

        case 'VIEW_BRIEFING':
          addMessage({
            speaker: 'ai',
            text: "Of course. Navigating to the briefing view now.",
            directive: null,
          });
          setTimeout(() => navigate('/'), 500); // Navigate to command center for now
          break;
        
        case 'NAVIGATE':
          const page = intentData.entities?.page || '';
          if (page) {
            addMessage({ speaker: 'ai', text: `Navigating to ${page}.` });
            navigate(`/${page.toLowerCase()}`);
          } else {
             addMessage({ speaker: 'ai', text: "I'm not sure which page you want to go to." });
          }
          break;

        default: // UNKNOWN
          addMessage({
            speaker: 'ai',
            text: "I'm not sure how to handle that yet. Please try asking about creating an agent or running a playbook.",
            directive: null,
          });
      }
    } catch (e) {
      const err = e as Error;
      console.error("Error processing command:", err);
      toast.error("There was an issue understanding your command.");
      addMessage({ speaker: 'ai', text: "Sorry, I'm having trouble understanding right now." });
    }
  }, [addMessage, navigate]);

  useEffect(() => {
    setTimeout(() => {
      addMessage(initialGreeting);
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { messages, processUserCommand };
}