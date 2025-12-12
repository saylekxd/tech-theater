'use client';

// ============================================================================
// VOICE CONTROLS COMPONENT
// ============================================================================
// Interfejs do kontrolowania nagrywania głosu użytkownika

import { useAppStore } from '@/lib/store';
import { useVoiceRecording } from '@/lib/audio/useVoiceRecording';
import { useAudioPlayback } from '@/lib/audio/useAudioPlayback';
import { useCallback } from 'react';

// Ikony SVG
const MicrophoneIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill="currentColor"/>
    <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10H3V12C3 16.42 6.28 20.11 10.5 20.86V24H13.5V20.86C17.72 20.11 21 16.42 21 12V10H19Z" fill="currentColor"/>
  </svg>
);

const StopIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
  </svg>
);

export function VoiceControls() {
  const state = useAppStore((s) => s.state);
  const processingSubState = useAppStore((s) => s.processingSubState);
  const setState = useAppStore((s) => s.setState);
  const setProcessingSubState = useAppStore((s) => s.setProcessingSubState);
  const addMessage = useAppStore((s) => s.addMessage);
  const messages = useAppStore((s) => s.messages);
  const currentCharacter = useAppStore((s) => s.currentCharacter);

  // Audio playback hook
  const {
    playAudio,
    stopAudio,
    isPlaying: isAudioPlaying,
    error: audioError,
  } = useAudioPlayback({
    onPlayStart: () => {
      setState('responding');
      console.log('Audio playback started');
    },
    onPlayEnd: () => {
      setState('waiting');
      setProcessingSubState(null);
      console.log('Audio playback ended');
    },
    onError: (error) => {
      console.error('Audio playback error:', error);
      alert(`Błąd odtwarzania audio: ${error.message}`);
      setState('waiting');
      setProcessingSubState(null);
    },
  });

  // Handle recording complete - musi być useCallback
  const handleRecordingComplete = useCallback(async (recordedAudio: Blob) => {
    console.log('Recording complete, size:', recordedAudio.size);
    
    // Update state to processing
    setState('processing');
    setProcessingSubState('transcribing');

    try {
      // Send to Whisper API
      const formData = new FormData();
      
      // Determine file extension based on type
      const fileExtension = recordedAudio.type.includes('webm') ? 'webm' 
        : recordedAudio.type.includes('mp4') ? 'mp4'
        : recordedAudio.type.includes('mpeg') ? 'mp3'
        : 'webm';
      
      console.log('Sending audio to Whisper:', {
        type: recordedAudio.type,
        size: recordedAudio.size,
        filename: `recording.${fileExtension}`,
      });
      
      formData.append('audio', recordedAudio, `recording.${fileExtension}`);

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      const data = await response.json();
      console.log('Transcription:', data.text);

      // Add user message
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: data.text,
        timestamp: Date.now(),
      };
      addMessage(userMessage);

      // === FAZA 4: Wysłać do LLM ===
      if (!currentCharacter) {
        throw new Error('No character selected');
      }

      setProcessingSubState('thinking');

      // Prepare messages for LLM (last N messages for context)
      const MAX_CONTEXT_MESSAGES = 10;
      const contextMessages = [...messages, userMessage]
        .slice(-MAX_CONTEXT_MESSAGES)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      // Call LLM API
      const llmResponse = await fetch('/api/llm-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: contextMessages,
          characterId: currentCharacter.id,
        }),
      });

      if (!llmResponse.ok) {
        const error = await llmResponse.json();
        throw new Error(error.error || 'LLM request failed');
      }

      const llmData = await llmResponse.json();
      console.log('LLM response:', llmData.text);

      // Add assistant message
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: llmData.text,
        timestamp: Date.now(),
      };
      addMessage(assistantMessage);

      // === FAZA 7: Wysłać do ElevenLabs TTS ===
      setProcessingSubState('synthesizing');

      // Call TTS API
      const ttsResponse = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: llmData.text,
          voiceId: currentCharacter.voiceId,
          voiceSettings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      });

      if (!ttsResponse.ok) {
        const error = await ttsResponse.json();
        throw new Error(error.error || 'TTS generation failed');
      }

      // Get audio blob
      const ttsAudioBlob = await ttsResponse.blob();
      console.log('TTS audio received:', {
        size: ttsAudioBlob.size,
        type: ttsAudioBlob.type,
        contentType: ttsResponse.headers.get('content-type'),
      });

      // Validate audio blob
      if (ttsAudioBlob.size === 0) {
        throw new Error('TTS returned empty audio');
      }

      if (ttsAudioBlob.size < 1000) {
        console.warn('TTS audio very small, might be error:', ttsAudioBlob.size);
      }

      // Play audio (this will trigger 'responding' state)
      console.log('Attempting to play audio...');
      await playAudio(ttsAudioBlob);
      console.log('Audio playback initiated successfully');

    } catch (error) {
      console.error('Transcription error:', error);
      alert(`Błąd transkrypcji: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setState('waiting');
      setProcessingSubState(null);
    }
  }, [setState, setProcessingSubState, addMessage, messages, currentCharacter, playAudio]);

  // Handle recording error - musi być useCallback
  const handleRecordingError = useCallback((error: Error) => {
    console.error('Recording error:', error);
    
    let errorMessage = 'Błąd nagrywania';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Brak dostępu do mikrofonu. Proszę zezwolić na dostęp w ustawieniach przeglądarki.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'Nie znaleziono mikrofonu. Sprawdź czy mikrofon jest podłączony.';
    } else {
      errorMessage = `Błąd: ${error.message}`;
    }
    
    alert(errorMessage);
    setState('waiting');
  }, [setState]);

  // Voice recording hook (musi być PO callbackach)
  const {
    startRecording,
    stopRecording,
    isRecording,
    error: recordingError,
  } = useVoiceRecording({
    onRecordingComplete: handleRecordingComplete,
    onError: handleRecordingError,
    maxDuration: 60, // 60 seconds max
    silenceThreshold: 20,
    silenceDuration: 2000, // 2 seconds of silence
    autoStopOnSilence: true,
  });

  // Start recording handler
  const handleStartRecording = useCallback(async () => {
    setState('listening');
    await startRecording();
  }, [startRecording, setState]);

  // Stop recording handler
  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  // Interrupt handler
  const handleInterrupt = useCallback(() => {
    // Stop audio if playing
    if (isAudioPlaying) {
      stopAudio();
    }
    
    setState('waiting');
    setProcessingSubState(null);
  }, [isAudioPlaying, stopAudio, setState, setProcessingSubState]);

  // Status text
  const getStatusText = () => {
    if (state === 'waiting') return 'Naciśnij aby mówić';
    if (state === 'listening') return 'Słucham...';
    if (state === 'processing') {
      if (processingSubState === 'transcribing') return 'Rozpoznaję mowę...';
      if (processingSubState === 'thinking') return 'Myślę...';
      if (processingSubState === 'synthesizing') return 'Przygotowuję odpowiedź...';
      return 'Przetwarzam...';
    }
    if (state === 'responding') return 'Odpowiadam...';
    return '';
  };

  // Show error if any
  if (recordingError || audioError) {
    const error = recordingError || audioError;
    return (
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="text-red-500 text-center">
          <p className="text-xl font-semibold">
            {recordingError ? 'Błąd nagrywania' : 'Błąd odtwarzania audio'}
          </p>
          <p className="text-sm mt-2">{error?.message}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
        >
          Odśwież stronę
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Status Text */}
      <div className="text-center">
        <p className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          {getStatusText()}
        </p>
        {state === 'processing' && (
          <p className="text-sm text-gray-500 mt-2">
            Proszę czekać...
          </p>
        )}
      </div>

      {/* Main Button */}
      <div className="relative">
        {state === 'waiting' && (
          <button
            onClick={handleStartRecording}
            className="
              w-24 h-24 rounded-full 
              bg-blue-500 hover:bg-blue-600 
              text-white
              flex items-center justify-center
              transition-all duration-200
              shadow-lg hover:shadow-xl
              focus:outline-none focus:ring-4 focus:ring-blue-300
            "
            aria-label="Naciśnij aby mówić"
          >
            <MicrophoneIcon />
          </button>
        )}

        {state === 'listening' && (
          <button
            onClick={handleStopRecording}
            className="
              w-24 h-24 rounded-full 
              bg-red-500 hover:bg-red-600 
              text-white
              flex items-center justify-center
              transition-all duration-200
              shadow-lg hover:shadow-xl
              animate-pulse
              focus:outline-none focus:ring-4 focus:ring-red-300
            "
            aria-label="Stop nagrywania"
          >
            <StopIcon />
          </button>
        )}

        {state === 'processing' && (
          <div className="
            w-24 h-24 rounded-full 
            bg-gray-400 
            text-white
            flex items-center justify-center
            shadow-lg
            cursor-not-allowed
          ">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          </div>
        )}

        {state === 'responding' && (
          <button
            onClick={handleInterrupt}
            className="
              w-24 h-24 rounded-full 
              bg-orange-500 hover:bg-orange-600 
              text-white
              flex items-center justify-center
              transition-all duration-200
              shadow-lg hover:shadow-xl
              focus:outline-none focus:ring-4 focus:ring-orange-300
            "
            aria-label="Przerwij odpowiedź"
          >
            <StopIcon />
          </button>
        )}
      </div>

    </div>
  );
}
