import { useState, useEffect, useMemo } from 'react';
import { useSpeech } from '@/hooks/useSpeech';
import { useDialogueManager, Message } from '@/hooks/useDialogueManager';
import { AIBrainOrb } from '@/components/voice/AIBrainOrb';
import { AIResponseNarrator } from '@/components/voice/AIResponseNarrator';
import { VoiceCommandInput } from '@/components/voice/VoiceCommandInput';
import { ConversationModeToggle } from '@/components/voice/ConversationModeToggle';
import { DirectiveCard } from '@/components/voice/DirectiveCard';
import { AddAgentDialog } from '@/components/AddAgentDialog';

const Index = () => {
  const {
    isListening,
    transcript,
    finalTranscript,
    clearFinalTranscript,
    startListening,
    stopListening,
    setTranscript,
    isSpeaking,
    speak,
    isModelLoading,
  } = useSpeech();

  const { messages, processUserCommand } = useDialogueManager();
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [isAddAgentDialogOpen, setAddAgentDialogOpen] = useState(false);

  const lastMessage: Message | undefined = useMemo(() => messages[messages.length - 1], [messages]);
  const lastAIMessage = useMemo(() => [...messages].reverse().find(m => m.speaker === 'ai'), [messages]);

  // Effect to process the final transcript from speech recognition
  useEffect(() => {
    if (finalTranscript) {
      processUserCommand(finalTranscript);
      clearFinalTranscript();
    }
  }, [finalTranscript, processUserCommand, clearFinalTranscript]);

  // Effect to speak the AI's response
  useEffect(() => {
    if (lastMessage?.speaker === 'ai' && !lastMessage.directive) {
      speak(lastMessage.text);
    }
  }, [lastMessage, speak]);

  // Effect for hands-free conversation mode
  useEffect(() => {
    if (isConversationMode && !isSpeaking && !isListening) {
      const timer = setTimeout(() => {
        startListening();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConversationMode, isSpeaking, isListening, startListening]);
  
  // Effect to handle directives
  useEffect(() => {
    if (lastAIMessage?.directive?.type === 'open-dialog' && lastAIMessage.directive.payload === 'add-agent') {
      setAddAgentDialogOpen(true);
    }
  }, [lastAIMessage]);

  const handleSubmit = (command: string) => {
    processUserCommand(command);
    setTranscript('');
  };

  return (
    <div className="dynamic-canvas-bg flex h-screen w-full flex-col items-center justify-center p-4">
      <ConversationModeToggle isConversationMode={isConversationMode} onToggle={setIsConversationMode} />
      
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <AIBrainOrb isListening={isListening} isSpeaking={isSpeaking} />
        
        {lastAIMessage && !isSpeaking && (
          <AIResponseNarrator key={lastAIMessage.id} text={lastAIMessage.text} />
        )}

        <DirectiveCard directive={lastAIMessage?.directive ?? null} />
      </div>

      <div className="pb-8">
        <VoiceCommandInput
          onSubmit={handleSubmit}
          disabled={isSpeaking}
          isListening={isListening}
          startListening={startListening}
          stopListening={stopListening}
          transcript={transcript}
          setTranscript={setTranscript}
          isModelLoading={isModelLoading}
        />
      </div>
      
      <AddAgentDialog 
        open={isAddAgentDialogOpen}
        onOpenChange={setAddAgentDialogOpen}
        onAgentCreated={() => { /* Can add feedback here */ }}
      />
    </div>
  );
};

export default Index;