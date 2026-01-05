'use client';

// ============================================================================
// VOICE CONTROLS COMPONENT (Realtime API)
// ============================================================================
// Interfejs do kontrolowania komunikacji głosowej przez OpenAI Realtime API

import { useAppStore } from '@/lib/store';
import { useRealtimeVoice } from '@/lib/audio/useRealtimeVoice';
import { useEffect, useCallback, useRef } from 'react';

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

const ConnectIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5V19M16 5V19M12 3L12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export function VoiceControlsRealtime() {
  const state = useAppStore((s) => s.state);
  const setState = useAppStore((s) => s.setState);
  const addMessage = useAppStore((s) => s.addMessage);
  const currentCharacter = useAppStore((s) => s.currentCharacter);

  // Realtime voice hook
  const {
    connect,
    startConversation,
    endConversation,
    interrupt,
    isConnected,
    isListening,
    isSpeaking,
    isConversationActive,
    state: realtimeState,
    error: realtimeError,
  } = useRealtimeVoice({
    character: currentCharacter!,
    onStateChange: (newState) => {
      // Map Realtime states to app states
      if (newState === 'listening') {
        setState('listening');
      } else if (newState === 'thinking') {
        setState('processing');
      } else if (newState === 'speaking') {
        setState('responding');
      } else if (newState === 'idle') {
        setState('waiting');
      }
    },
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        // Add user message when transcription is complete
        const userMessage = {
          id: Date.now().toString(),
          role: 'user' as const,
          content: text,
          timestamp: Date.now(),
        };
        addMessage(userMessage);
      }
    },
    onResponse: (text) => {
      // Add assistant message when response is complete
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: text,
        timestamp: Date.now(),
      };
      addMessage(assistantMessage);
    },
    onError: (error) => {
      console.error('Realtime API error:', error);
      alert(`Błąd Realtime API: ${error.message}`);
      setState('waiting');
    },
  });

  // Store connect function in ref to avoid dependency issues
  const connectRef = useRef(connect);
  connectRef.current = connect;

  // Track if we've already initiated connection
  const hasInitiatedConnection = useRef(false);
  const isMounted = useRef(true);

  // Auto-connect on mount if character is available
  useEffect(() => {
    const effectId = Date.now().toString(36);
    console.log(`[Effect ${effectId}] useEffect running`);
    
    isMounted.current = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (currentCharacter) {
      console.log(`[Effect ${effectId}] Scheduling connect in 300ms`);
      
      // Use timeout to avoid React StrictMode issues
      // Don't set hasInitiatedConnection until inside the timeout
      timeoutId = setTimeout(() => {
        console.log(`[Effect ${effectId}] Timeout fired, isMounted:`, isMounted.current, 'hasInitiated:', hasInitiatedConnection.current);
        
        // Check both conditions inside timeout
        if (isMounted.current && !hasInitiatedConnection.current) {
          hasInitiatedConnection.current = true;
          console.log(`[Effect ${effectId}] ✅ Calling connect()`);
          
          connectRef.current().catch((err) => {
            console.error(`[Effect ${effectId}] Failed to auto-connect:`, err);
            hasInitiatedConnection.current = false;
          });
        } else {
          console.log(`[Effect ${effectId}] Skipping connect - isMounted:`, isMounted.current, 'hasInitiated:', hasInitiatedConnection.current);
        }
      }, 300);
    }

    return () => {
      console.log(`[Effect ${effectId}] Cleanup called`);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      isMounted.current = false;
    };
  }, [currentCharacter]);

  // Start conversation handler - starts continuous listening mode
  const handleStartConversation = useCallback(async () => {
    if (!isConnected) {
      alert('Nie połączono z Realtime API. Spróbuj odświeżyć stronę.');
      return;
    }

    try {
      await startConversation();
    } catch (err) {
      console.error('Failed to start conversation:', err);
      alert(`Błąd: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isConnected, startConversation]);

  // End conversation handler
  const handleEndConversation = useCallback(() => {
    endConversation();
  }, [endConversation]);

  // Interrupt handler (for when model is speaking)
  const handleInterrupt = useCallback(() => {
    interrupt();
  }, [interrupt]);

  // Determine current display state
  const displayState = (() => {
    if (!isConnected) return 'connecting';
    if (!isConversationActive) return 'idle';
    if (isListening) return 'listening';
    if (isSpeaking) return 'speaking';
    if (realtimeState === 'thinking') return 'thinking';
    return 'conversing'; // Active conversation but between turns
  })();

  // Show error if any
  if (realtimeError) {
    return (
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="text-red-500 text-center">
          <p className="text-xl font-semibold">Błąd Realtime API</p>
          <p className="text-sm mt-2">{realtimeError.message}</p>
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

  // Show connecting state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="w-24 h-24 rounded-full bg-gray-400 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Main Button */}
      <div className="relative">
        {/* Start conversation button - only shown when not in conversation */}
        {displayState === 'idle' && (
          <button
            onClick={handleStartConversation}
            className="
              w-24 h-24 rounded-full 
              bg-green-500 hover:bg-green-600 
              text-white
              flex items-center justify-center
              transition-all duration-200
              shadow-lg hover:shadow-xl
              focus:outline-none focus:ring-4 focus:ring-green-300
            "
            aria-label="Rozpocznij rozmowę"
          >
            <MicrophoneIcon />
          </button>
        )}

        {/* Listening indicator - shows when actively listening */}
        {displayState === 'listening' && (
          <button
            onClick={handleEndConversation}
            className="
              w-24 h-24 rounded-full 
              bg-blue-500 hover:bg-blue-600 
              text-white
              flex items-center justify-center
              transition-all duration-200
              shadow-lg hover:shadow-xl
              animate-pulse
              focus:outline-none focus:ring-4 focus:ring-blue-300
            "
            aria-label="Zakończ rozmowę"
          >
            <MicrophoneIcon />
          </button>
        )}

        {/* Thinking indicator */}
        {displayState === 'thinking' && (
          <button
            onClick={handleEndConversation}
            className="
              w-24 h-24 rounded-full 
              bg-yellow-500 hover:bg-yellow-600
              text-white
              flex items-center justify-center
              shadow-lg hover:shadow-xl
              focus:outline-none focus:ring-4 focus:ring-yellow-300
            "
            aria-label="Zakończ rozmowę"
          >
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          </button>
        )}

        {/* Speaking - can interrupt or end conversation */}
        {displayState === 'speaking' && (
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

        {/* Conversing (between turns) - waiting for auto-listen to kick in */}
        {displayState === 'conversing' && (
          <button
            onClick={handleEndConversation}
            className="
              w-24 h-24 rounded-full 
              bg-purple-500 hover:bg-purple-600 
              text-white
              flex items-center justify-center
              transition-all duration-200
              shadow-lg hover:shadow-xl
              focus:outline-none focus:ring-4 focus:ring-purple-300
            "
            aria-label="Zakończ rozmowę"
          >
            <MicrophoneIcon />
          </button>
        )}
      </div>
    </div>
  );
}

