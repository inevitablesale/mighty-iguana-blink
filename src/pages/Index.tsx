import { useState, useEffect, useCallback } from 'react';
import { useDialogueManager } from '@/hooks/useDialogueManager';
import { useSpeech } from '@/hooks/useSpeech';
import { AIResponseNarrator } from '@/components/voice/AIResponseNarrator';
import { DirectiveCard } from '@/components/voice/DirectiveCard';
import { VoiceCommandInput } from '@/components/voice/VoiceCommandInput';
import { AddAgentDialog } from '@/components/AddAgentDialog';
import { ConversationModeToggle } from '@/components/voice/ConversationModeToggle';
import { AIBrainOrb } from '@/components/voice/AIBrainOrb';
import { AnimatePresence, motion } from 'framer-motion';

export default function Index() {
  const { messages, processUserCommand } = useDialogueManager();
  const {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    isSupported,
    isSpeaking: isAiSpeaking,
    speak,
    cancelSpeech,
    finalTranscript,
    clearFinalTranscript,
    isModelLoading,
  } = useSpeech();

  const [isAddAgentDialogOpen, setIsAddAgentDialogOpen] = useState(false);
  const [isConversationModeActive, setIsConversationModeActive] = useState(false);

  const lastMessage = messages[messages.length - 1];
  const lastAiMessage = messages.slice().reverse().find(m => m.speaker === 'ai');

  useEffect(() => {
    if (lastMessage?.speaker === 'ai' && isConversationModeActive) {
      stopListening();
      speak(lastMessage.text);
    }
  }, [lastMessage, isConversationModeActive, speak, stopListening]);

  const handleCommandSubmit = useCallback((command: string) => {
    if (!command.trim()) return;
    // Close any open dialogs when a new command is issued.
    setIsAddAgentDialogOpen(false);
    cancelSpeech();
    processUserCommand(command);
    setTranscript('');
  }, [cancelSpeech, processUserCommand, setTranscript]);

  useEffect(() => {
    if (finalTranscript) {
      handleCommandSubmit(finalTranscript);
      clearFinalTranscript();
    }
  }, [finalTranscript, handleCommandSubmit, clearFinalTranscript]);

  // Manage the continuous listening loop for Conversation Mode
  useEffect(() => {
    if (isConversationModeActive && !isListening && !isAiSpeaking && !isModelLoading) {
      startListening();
    } else if (!isConversationModeActive && isListening) {
      stopListening();
    }
  }, [isConversationModeActive, isListening, isAiSpeaking, isModelLoading, startListening, stopListening]);

  // Listen for directives from the AI to open dialogs
  useEffect(() => {
    if (lastAiMessage?.directive?.type === 'open-dialog' && lastAiMessage.directive.payload === 'add-agent') {
      setIsAddAgentDialogOpen(true);
    }
  }, [lastAiMessage]);

  return (
    <>
      <ConversationModeToggle
        isConversationMode={isConversationModeActive}
        onToggle={(checked) => {
          setIsConversationModeActive(checked);
          if (!checked) {
            cancelSpeech();
          }
        }}
      />
      <div className="dynamic-canvas-bg flex flex-col h-screen items-center justify-center p-4 md:p-8 pb-32 relative overflow-hidden">
        
        <div className="flex flex-col items-center gap-8 text-center">
          <AIBrainOrb isListening={isListening} isSpeaking={isAiSpeaking} />
          
          <div className="h-24"> {/* Placeholder to stabilize layout */}
            <AnimatePresence mode="wait">
              {lastMessage && lastMessage.speaker === 'ai' && (
                <motion.div
                  key={lastMessage.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <AIResponseNarrator text={lastMessage.text} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <DirectiveCard directive={lastAiMessage?.directive || null} />
        </div>

        <div className="fixed bottom-10 w-full flex justify-center px-4">
          {isSupported ? (
            <VoiceCommandInput
              onSubmit={handleCommandSubmit}
              disabled={isListening || isModelLoading}
              isListening={isListening}
              startListening={startListening}
              stopListening={stopListening}
              transcript={transcript}
              setTranscript={setTranscript}
              isModelLoading={isModelLoading}
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