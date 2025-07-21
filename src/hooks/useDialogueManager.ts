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
  text: "Good morning. What can I help you with today? You can ask me to run an agent, send a campaign, or navigate to a page.",
  directive: null,
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
      const { data: intentData, error: intentError } = await supabase.functions.invoke('process-command', {
        body: { command },
      });

      if (intentError) throw intentError;

      switch (intentData.intent) {
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
            text: `Understood. I'm initiating the playbook for the '${agentName}' agent now. This may take a moment.`,
            directive: { type: 'progress', title: 'Running Playbook', payload: {} },
          });
          // In a real app, we would trigger the agent run here and wait for a result.
          setTimeout(() => {
            addMessage({
              speaker: 'ai',
              text: 'The agent has completed its run and found 3 new opportunities.',
              directive: { type: 'confirmation', title: 'Playbook Complete', payload: {} },
            });
          }, 5000);
          break;

        case 'SEND_CAMPAIGN':
          const companyName = intentData.entities?.company_name;
          if (!companyName) {
            addMessage({ speaker: 'ai', text: "Which company's campaign should I send?" });
            break;
          }
          addMessage({
            speaker: 'ai',
            text: `Okay, looking for a draft campaign for ${companyName}...`,
            directive: { type: 'progress', title: 'Sending Campaign', payload: {} },
          });

          const { data: campaigns, error: campaignError } = await supabase
            .from('campaigns')
            .select('id')
            .ilike('company_name', `%${companyName}%`)
            .eq('status', 'draft')
            .limit(1);

          if (campaignError || !campaigns || campaigns.length === 0) {
            addMessage({
              speaker: 'ai',
              text: `I couldn't find a draft campaign for ${companyName}. You can create one from the opportunities page.`,
              directive: null,
            });
            break;
          }

          const { error: updateError } = await supabase
            .from('campaigns')
            .update({ status: 'sent' })
            .eq('id', campaigns[0].id);

          if (updateError) throw updateError;

          addMessage({
            speaker: 'ai',
            text: `The campaign for ${companyName} has been sent.`,
            directive: { type: 'confirmation', title: 'Campaign Sent', payload: {} },
          });
          break;
        
        case 'NAVIGATE':
          const page = intentData.entities?.page || '';
          if (page && ['campaigns', 'agents', 'placements', 'proposals', 'analytics'].includes(page.toLowerCase())) {
            addMessage({ speaker: 'ai', text: `Navigating to ${page}.` });
            navigate(`/${page.toLowerCase()}`);
          } else {
             addMessage({ speaker: 'ai', text: "I'm not sure which page you want to go to. You can say 'go to campaigns' for example." });
          }
          break;

        default: // UNKNOWN
          addMessage({
            speaker: 'ai',
            text: "I'm not sure how to handle that. Please try asking me to 'run an agent' or 'send a campaign'.",
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