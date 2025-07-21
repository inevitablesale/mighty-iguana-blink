import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { pipeline, env, AutomaticSpeechRecognitionOutput } from '@xenova/transformers';
import { ModelLoadingToast } from '@/components/voice/ModelLoadingToast';

// Since we're running in the browser, we need to disable local model checking
env.allowLocalModels = false;

// Fix for TS2551: Add webkitAudioContext to the Window interface
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// Fix for TS2322: Update Transcriber type to match the pipeline's output
type Transcriber = (audio: Float32Array) => Promise<AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[]>;

export function useSpeech() {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const transcriberRef = useRef<Transcriber | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- Model Initialization ---
  useEffect(() => {
    const loadModel = async () => {
      if (transcriberRef.current) return;
      setIsModelLoading(true);
      
      const toastId = toast(
        <ModelLoadingToast progress={0} status="initiate" file="" />
      );

      const progress_callback = (data: { status: string; file: string; progress: number }) => {
        toast(
          <ModelLoadingToast
            progress={data.progress || 0}
            status={data.status}
            file={data.file || ''}
          />,
          { id: toastId }
        );
      };

      try {
        transcriberRef.current = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
          progress_callback,
        });
        toast.success("Speech model loaded successfully.", { id: toastId });
      } catch (error) {
        console.error("Failed to load speech model:", error);
        toast.error("Could not load the speech recognition model.", { id: toastId });
      } finally {
        setIsModelLoading(false);
      }
    };
    loadModel();
  }, []);

  // --- Speech Synthesis (Text-to-Speech) ---
  const cancelSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // --- Speech Recognition (Speech-to-Text) ---
  const transcribeAudio = async () => {
    if (audioChunksRef.current.length === 0 || !transcriberRef.current) return;

    const toastId = toast.loading("Transcribing audio...");
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);

      const targetSampleRate = 16000;
      const offlineContext = new OfflineAudioContext(decodedAudio.numberOfChannels, decodedAudio.duration * targetSampleRate, targetSampleRate);
      const bufferSource = offlineContext.createBufferSource();
      bufferSource.buffer = decodedAudio;
      bufferSource.connect(offlineContext.destination);
      bufferSource.start();
      const resampledAudio = await offlineContext.startRendering();
      
      const audioData = resampledAudio.getChannelData(0);
      
      const result = await transcriberRef.current(audioData);
      
      const text = Array.isArray(result) ? result[0]?.text : result?.text;

      if (text && typeof text === 'string') {
        const newTranscript = text.trim();
        setTranscript(newTranscript);
        setFinalTranscript(newTranscript);
        toast.success("Transcription complete.", { id: toastId });
      } else {
        throw new Error("Invalid transcription result.");
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe audio.", { id: toastId });
    } finally {
      audioChunksRef.current = [];
    }
  };

  const startListening = useCallback(async () => {
    if (isListening || isModelLoading) return;

    setTranscript('');
    setFinalTranscript('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = transcribeAudio;
      
      mediaRecorderRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error("Failed to start listening:", error);
      toast.error("Microphone access denied or failed.");
    }
  }, [isListening, isModelLoading]);

  const stopListening = useCallback(() => {
    if (!isListening || !mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    setIsListening(false);
  }, [isListening]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      cancelSpeech();
    };
  }, [cancelSpeech]);

  return {
    isListening,
    transcript,
    finalTranscript,
    clearFinalTranscript: () => setFinalTranscript(''),
    startListening,
    stopListening,
    setTranscript,
    isSpeaking,
    speak,
    cancelSpeech,
    isSupported: !!(navigator.mediaDevices && (window.AudioContext || window.webkitAudioContext)),
    isModelLoading,
  };
}