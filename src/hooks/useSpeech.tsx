import { useState, useEffect, useRef, useCallback } from 'react';
import { pipeline, env, AutomaticSpeechRecognitionOutput } from '@xenova/transformers';

// Since we're running in the browser, we need to disable local model checking
env.allowLocalModels = false;

// Fix for TS2551: Add webkitAudioContext to the Window interface
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// The pipeline function can return a single object or an array of objects
type Transcriber = (audio: string | Float32Array) => Promise<AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[]>;

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
      
      try {
        transcriberRef.current = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
        console.log("Speech model loaded successfully.");
      } catch (error) {
        console.error("Failed to load speech model:", error);
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

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);

    try {
      // Pass the audio URL directly to the pipeline
      const result = await transcriberRef.current(audioUrl);
      
      const text = Array.isArray(result) ? result[0]?.text : result?.text;

      if (text && typeof text === 'string') {
        const newTranscript = text.trim();
        setTranscript(newTranscript);
        setFinalTranscript(newTranscript);
      } else {
        // This can happen if the audio is silent or couldn't be transcribed
        console.log("Transcription result is empty or invalid.");
        setTranscript(''); // Clear any partial transcript
      }
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      audioChunksRef.current = [];
      URL.revokeObjectURL(audioUrl); // Clean up the URL object to avoid memory leaks
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