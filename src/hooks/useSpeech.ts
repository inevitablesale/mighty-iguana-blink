import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

// Define a minimal interface for the SpeechRecognition instance to provide the type.
interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: any) => void;
  onend: () => void;
  onerror: (event: any) => void;
  start: () => void;
  stop: () => void;
}

// Define the type for the constructor.
type SpeechRecognitionConstructor = new () => SpeechRecognition;

// Extend the window object with the correct constructor type.
interface IWindow extends Window {
  SpeechRecognition: SpeechRecognitionConstructor;
  webkitSpeechRecognition: SpeechRecognitionConstructor;
}

const SpeechRecognition = (window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition;

export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // --- Speech Synthesis (Text-to-Speech) ---
  const cancelSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // --- Speech Recognition (Speech-to-Text) ---
  useEffect(() => {
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      let interimTranscript = '';
      let currentFinalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      let full_transcript_for_display = "";
      for (const res of event.results) {
          full_transcript_for_display += res[0].transcript;
      }
      setTranscript(full_transcript_for_display);

      if (currentFinalTranscript.trim()) {
        setFinalTranscript(currentFinalTranscript.trim());
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'not-allowed') {
        console.warn(`Speech recognition error (ignoring): ${event.error}`);
        setIsListening(false);
        return;
      }
      console.error('Speech recognition error', event.error);
      toast.error(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        setTranscript('');
        setFinalTranscript('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn('Speech recognition already started. Ignoring redundant call.');
        } else {
          console.error('Failed to start speech recognition:', error);
          toast.error('Could not start microphone.');
          setIsListening(false);
        }
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      // Let the `onend` event handle setting `isListening` to false to avoid race conditions.
    }
  }, [isListening]);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      console.warn("Speech synthesis is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      if (event.error === 'interrupted') {
        console.log('Speech synthesis was interrupted.');
      } else {
        console.error('Speech synthesis error', event.error);
        toast.error(`Speech synthesis error: ${event.error}`);
      }
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        // Clean up handlers to prevent memory leaks
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
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
    isSupported: !!SpeechRecognition && !!window.speechSynthesis,
  };
}