import { useState, useEffect } from 'react';
import { useDialogueManager } from '@/hooks/useDialogueManager';
import { useSpeech } from '@/hooks/useSpeech';
import { AIResponseNarrator } from '@/components/voice/AIResponseNarrator';
import { DirectiveCard } from '@/components/voice/DirectiveCard';
import { VoiceCommandInput } from '@/components/voice/VoiceCommandInput';
import { AddAgentDialog } from '@/components/AddAgentDialog';
import { AnimatePresence, motion } from 'framer-motion';

export default function Index() {
  const { messages, isSpeaking: isAiSpeaking, processUserCommand } = useDialogueManager();
  const {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    isSupported,
  } = useSpeech();

  const [isAddAgentDialogOpen, setIsAddAgentDialogOpen] = useState(false);

  const lastMessage = messages[messages.length - 1];
  const lastAiMessage = messages.slice().reverse().find(m => m.speaker === 'ai');

  // When the user stops speaking, process the command.
  useEffect(() => {
    if (!isListening && transcript) {
      processUserCommand(transcript);
      setTranscript(''); // Clear transcript after processing
    }
  }, [isListening, transcript, processUserCommand, setTranscript]);

  // Listen for directives from the AI
  useEffect(() => {
    if (lastAiMessage?.directive?.type === 'open-dialog' && lastAiMessage.directive.payload === 'add-agent') {
      setIsAddAgentDialogOpen(true);
    }
  }, [lastAiMessage]);

  return (
    <>
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
          {isSupported ? (
            <VoiceCommandInput
              onSubmit={processUserCommand}
              disabled={isAiSpeaking}
              isListening={isListening}
              startListening={startListening}
              stopListening={stopListening}
              transcript={transcript}
              setTranscript={setTranscript}
            />
          ) : (
            <p className="text-red-500 font-semibold text-center">
              Sorry, the Web Speech API is not supported in your browser. Please use Chrome or Edge.
            </p>
          )}
        </div>
      </div>
      <AddAgentDialog
        open={isAddAgentDialogOpen}
        onOpenChange={setIsAddAgentDialogOpen}
        onAgentCreated={() => {
          // We could add a follow-up message here if needed
        }}
      />
    </>
  );
}