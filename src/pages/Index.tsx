import { useState, useEffect, useMemo } from 'react';
import { useSpeech } from '@/hooks/useSpeech';
import { useDialogueManager, Message } from '@/hooks/useDialogueManager';
import { useCanvas } from '@/contexts/CanvasContext';
import { AnimatePresence, motion } from 'framer-motion';

import { AIBrainOrb } from '@/components/voice/AIBrainOrb';
import { AIResponseNarrator } from '@/components/voice/AIResponseNarrator';
import { VoiceCommandInput } from '@/components/voice/VoiceCommandInput';
import { ConversationModeToggle } from '@/components/voice/ConversationModeToggle';
import { DirectiveCard } from '@/components/voice/DirectiveCard';
import { AddAgentDialog } from '@/components/AddAgentDialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

// Dynamically import views
import CommandCenterView from '@/components/views/CommandCenterView';
import CampaignsView from '@/components/views/CampaignsView';
import AgentsView from '@/components/views/AgentsView';
import PlacementsView from '@/components/views/PlacementsView';
import ProposalsView from '@/components/views/ProposalsView';
import AnalyticsView from '@/components/views/AnalyticsView';
import ProfileView from '@/components/views/ProfileView';

const viewMap = {
  opportunities: CommandCenterView,
  campaigns: CampaignsView,
  agents: AgentsView,
  placements: PlacementsView,
  proposals: ProposalsView,
  analytics: AnalyticsView,
  profile: ProfileView,
};

const Index = () => {
  const { isListening, transcript, finalTranscript, clearFinalTranscript, startListening, stopListening, setTranscript, isSpeaking, speak, isModelLoading } = useSpeech();
  const { messages, processUserCommand } = useDialogueManager();
  const { currentView, setCurrentView } = useCanvas();
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [isAddAgentDialogOpen, setAddAgentDialogOpen] = useState(false);

  const lastMessage: Message | undefined = useMemo(() => messages[messages.length - 1], [messages]);
  const lastAIMessage = useMemo(() => [...messages].reverse().find(m => m.speaker === 'ai'), [messages]);

  useEffect(() => { if (finalTranscript) { processUserCommand(finalTranscript); clearFinalTranscript(); } }, [finalTranscript, processUserCommand, clearFinalTranscript]);
  useEffect(() => { if (lastMessage?.speaker === 'ai' && !lastMessage.directive) { speak(lastMessage.text); } }, [lastMessage, speak]);
  useEffect(() => { if (isConversationMode && !isSpeaking && !isListening) { const timer = setTimeout(() => startListening(), 1000); return () => clearTimeout(timer); } }, [isConversationMode, isSpeaking, isListening, startListening]);
  useEffect(() => { if (lastAIMessage?.directive?.type === 'open-dialog' && lastAIMessage.directive.payload === 'add-agent') { setAddAgentDialogOpen(true); } }, [lastAIMessage]);

  const handleSubmit = (command: string) => { processUserCommand(command); setTranscript(''); };

  const ActiveView = currentView ? viewMap[currentView] : null;

  return (
    <div className="dynamic-canvas-bg flex h-screen w-full flex-col items-center justify-between p-4 overflow-hidden">
      <div className="w-full max-w-5xl mx-auto pt-8">
        <AnimatePresence mode="wait">
          {ActiveView ? (
            <motion.div key={currentView} className="relative">
              <ActiveView />
              <Button variant="ghost" size="icon" className="absolute -top-4 -right-4 rounded-full bg-background/50 backdrop-blur-sm" onClick={() => setCurrentView(null)}>
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div key="conversation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center gap-8 text-center h-[calc(100vh-150px)]">
              <AIBrainOrb isListening={isListening} isSpeaking={isSpeaking} />
              {lastAIMessage && !isSpeaking && <AIResponseNarrator key={lastAIMessage.id} text={lastAIMessage.text} />}
              <DirectiveCard directive={lastAIMessage?.directive ?? null} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pb-8 w-full">
        <VoiceCommandInput onSubmit={handleSubmit} disabled={isSpeaking} isListening={isListening} startListening={startListening} stopListening={stopListening} transcript={transcript} setTranscript={setTranscript} isModelLoading={isModelLoading} />
      </div>
      
      <ConversationModeToggle isConversationMode={isConversationMode} onToggle={setIsConversationMode} />
      <AddAgentDialog open={isAddAgentDialogOpen} onOpenChange={setAddAgentDialogOpen} onAgentCreated={() => {}} />
    </div>
  );
};

export default Index;