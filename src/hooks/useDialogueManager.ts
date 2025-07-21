import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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

        case 'RUN_AGENT':
          // This would trigger the actual agent run
          // For now, we just show progress and confirmation
           addMessage({
            speaker: 'ai',
            text: "I'm on it.",
            directive: { type: 'progress', title: 'Running Playbook', payload: {} },
          });
          break;

        case 'SEND_CAMPAIGN': {
          const companyName = intentData.entities?.company_name;
          if (!companyName) {
            addMessage({ speaker: 'ai', text: "Which company's campaign should I send?" });
            break;
          }
          addMessage({
            speaker: 'ai',
            text: `Okay, I'll send the campaign for ${companyName}.`,
            directive: { type: 'progress', title: 'Sending Campaign', payload: { companyName } },
          });

          const { data: campaigns, error: campaignError } = await supabase
            .from('campaigns')
            .select('id')
            .ilike('company_name', `%${companyName}%`)
            .eq('status', 'draft')
            .limit(1);

          if (campaignError || !campaigns || campaigns.length === 0) {
            addMessage({ speaker: 'ai', text: `I couldn't find a draft campaign for ${companyName}.` });
            break;
          }

          const { error: updateError } = await supabase.from('campaigns').update({ status: 'sent' }).eq('id', campaigns[0].id);
          
          if (updateError) {
             addMessage({ speaker: 'ai', text: `I ran into an issue sending the campaign for ${companyName}. Please check the console for details.` });
          } else {
            addMessage({
              speaker: 'ai',
              text: `The campaign for ${companyName} has been sent.`,
              directive: { type: 'confirmation', title: 'Campaign Sent', payload: {} },
            });
          }
          break;
        }
        
        case 'NAVIGATE': {
          const page = intentData.entities?.page?.toLowerCase() || '';
          if (page === 'home') {
            navigate('/');
          } else if (['campaigns', 'agents', 'placements', 'proposals', 'analytics'].includes(page)) {
            navigate(`/${page}`);
          }
          break;
        }

        default: // UNKNOWN
          // The initial AI response is already added above.
          break;
      }
    } catch (e) {
      const err = e as Error;
      console.error("Error processing command:", err);
      addMessage({ speaker: 'ai', text: "Sorry, I'm having trouble understanding right now. Please try again." });
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