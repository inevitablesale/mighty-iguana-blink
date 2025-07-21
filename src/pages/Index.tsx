import { useDialogueManager } from '@/hooks/useDialogueManager';
import { AIResponseNarrator } from '@/components/voice/AIResponseNarrator';
import { DirectiveCard } from '@/components/voice/DirectiveCard';
import { VoiceCommandInput } from '@/components/voice/VoiceCommandInput';
import { AnimatePresence, motion } from 'framer-motion';

export default function Index() {
  const { messages, isSpeaking, processUserCommand } = useDialogueManager();

  const lastMessage = messages[messages.length - 1];
  const lastAiMessage = messages.slice().reverse().find(m => m.speaker === 'ai');

  return (
    <div className="flex flex-col h-screen items-center justify-end p-4 md:p-8 pb-10">
      <div className="flex flex-col items-center justify-end w-full h-full gap-8">
        <AnimatePresence>
          {lastMessage && lastMessage.speaker === 'ai' && (
            <motion.div
              key={lastMessage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <AIResponseNarrator text={lastMessage.text} />
            </motion.div>
          )}
        </AnimatePresence>
        
        <DirectiveCard directive={lastAiMessage?.directive || null} />
      </div>

      <div className="fixed bottom-10 w-full flex justify-center px-4">
        <VoiceCommandInput onSubmit={processUserCommand} disabled={isSpeaking} />
      </div>
    </div>
  );
}