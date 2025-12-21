'use client';

// ============================================================================
// REALTIME VOICE HOOK (OpenAI Realtime API)
// ============================================================================
// Hook do komunikacji głosowej w czasie rzeczywistym z OpenAI
// Zastępuje flow: Whisper → GPT → ElevenLabs

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Character } from '../types';

interface UseRealtimeVoiceOptions {
  character: Character;
  onStateChange?: (state: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking') => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponse?: (text: string) => void;
  onError?: (error: Error) => void;
}

interface UseRealtimeVoiceReturn {
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  startConversation: () => Promise<void>;  // Start continuous conversation
  endConversation: () => void;              // End continuous conversation
  interrupt: () => void;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isConversationActive: boolean;  // True when in continuous conversation mode
  state: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';
  error: Error | null;
}

export function useRealtimeVoice({
  character,
  onStateChange,
  onTranscript,
  onResponse,
  onError,
}: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [state, setState] = useState<'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Ref to track conversation mode (for use in callbacks)
  const isConversationActiveRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);  // For microphone
  const playbackAudioContextRef = useRef<AudioContext | null>(null);   // For speakers
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  // Update state and notify
  const updateState = useCallback((newState: typeof state) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Debug counter for chunks
  const chunkCounterRef = useRef(0);
  const totalChunksReceivedRef = useRef(0);

  // Play audio chunk (PCM16)
  const playAudioChunk = useCallback(async (pcm16Data: Int16Array) => {
    const chunkId = ++chunkCounterRef.current;
    const durationMs = (pcm16Data.length / 24000) * 1000;
    
    console.log(`🎵 [Chunk ${chunkId}] Playing ${pcm16Data.length} samples (${durationMs.toFixed(0)}ms), queue: ${audioQueueRef.current.length}`);
    
    // Use separate AudioContext for playback
    if (!playbackAudioContextRef.current || playbackAudioContextRef.current.state === 'closed') {
      console.log(`🎵 [Chunk ${chunkId}] Creating new AudioContext`);
      playbackAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const audioContext = playbackAudioContextRef.current;
    
    // Check AudioContext state
    if (audioContext.state === 'suspended') {
      console.log(`🎵 [Chunk ${chunkId}] Resuming suspended AudioContext`);
      await audioContext.resume();
    }

    // Convert PCM16 to Float32 for Web Audio API
    const float32Data = new Float32Array(pcm16Data.length);
    for (let i = 0; i < pcm16Data.length; i++) {
      float32Data[i] = pcm16Data[i] / 32768.0;
    }

    // Create audio buffer
    const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    // Create source and play
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    const startTime = Date.now();
    
    return new Promise<void>((resolve) => {
      source.onended = () => {
        const actualDuration = Date.now() - startTime;
        console.log(`🎵 [Chunk ${chunkId}] Finished in ${actualDuration}ms (expected ${durationMs.toFixed(0)}ms), queue: ${audioQueueRef.current.length}`);
        resolve();
      };
      source.start();
    });
  }, []);

  // Track if response is complete
  const responseCompleteRef = useRef(false);
  const finalizationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reference to startListening for use in finalizePlayback
  const startListeningRef = useRef<() => Promise<void>>();

  // Finalize audio playback (called when response is complete and queue is empty)
  const finalizePlayback = useCallback(() => {
    // Clear any pending finalization
    if (finalizationTimeoutRef.current) {
      clearTimeout(finalizationTimeoutRef.current);
      finalizationTimeoutRef.current = null;
    }
    
    // Check if there's still audio to play
    if (audioQueueRef.current.length > 0 || isPlayingRef.current) {
      console.log('🔊 Still playing, delaying finalization...');
      // Retry in 200ms
      finalizationTimeoutRef.current = setTimeout(() => {
        finalizePlayback();
      }, 200);
      return;
    }
    
    console.log('🔊 All audio finished, setting idle');
    setIsSpeaking(false);
    responseCompleteRef.current = false;

    // If in conversation mode, auto-restart listening after a short delay
    if (isConversationActiveRef.current) {
      console.log('🔄 Conversation mode active - auto-starting listening in 300ms');
      setTimeout(() => {
        if (isConversationActiveRef.current && startListeningRef.current) {
          console.log('🎤 Auto-starting listening...');
          startListeningRef.current().catch((err) => {
            console.error('Failed to auto-start listening:', err);
          });
        }
      }, 300);
    } else {
      updateState('idle');
    }
  }, [updateState]);

  // Process audio queue - continuously until empty
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current) {
      console.log(`⏳ processAudioQueue: Already playing, skipping (queue: ${audioQueueRef.current.length})`);
      return;
    }
    
    if (audioQueueRef.current.length === 0) {
      console.log(`⏳ processAudioQueue: Queue empty, skipping`);
      return;
    }

    console.log(`▶️ processAudioQueue: Starting playback loop (queue: ${audioQueueRef.current.length})`);
    isPlayingRef.current = true;
    updateState('speaking');
    setIsSpeaking(true);

    // Keep processing until queue is truly empty
    // This loop will pick up new chunks that arrive during playback
    let consecutiveEmptyChecks = 0;
    const maxEmptyChecks = 5; // Wait for 5 empty checks before stopping (500ms)
    let totalChunksPlayed = 0;
    
    while (consecutiveEmptyChecks < maxEmptyChecks) {
      if (audioQueueRef.current.length > 0) {
        consecutiveEmptyChecks = 0; // Reset counter
        const chunk = audioQueueRef.current.shift();
        if (chunk) {
          totalChunksPlayed++;
          await playAudioChunk(chunk);
        }
      } else {
        // Queue is empty, but wait a bit for more chunks
        consecutiveEmptyChecks++;
        console.log(`⏳ Queue empty check ${consecutiveEmptyChecks}/${maxEmptyChecks}, responseComplete: ${responseCompleteRef.current}`);
        if (consecutiveEmptyChecks < maxEmptyChecks) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        }
      }
    }

    console.log(`⏹️ Queue consistently empty after ${totalChunksPlayed} chunks, stopping playback`);
    console.log(`⏹️ Total received: ${totalChunksReceivedRef.current}, played: ${chunkCounterRef.current}`);
    isPlayingRef.current = false;
    
    // Check if response is complete
    if (responseCompleteRef.current) {
      console.log('✅ Response complete - finalizing...');
      finalizePlayback();
    } else {
      console.log('⏳ Waiting for more audio or response.done...');
      // Don't set idle yet - more chunks might come
    }
  }, [playAudioChunk, updateState, finalizePlayback]);

  // Connect to OpenAI Realtime API via relay server
  const connect = useCallback(async () => {
    try {
      updateState('connecting');
      setError(null);

      // Get session configuration from backend
      const response = await fetch('/api/realtime-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: character.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get session config');
      }

      const config = await response.json();
      console.log('Realtime API config:', config);

      // Encode session config for URL (UTF-8 safe base64)
      // btoa() doesn't support Unicode, so we use TextEncoder
      const sessionConfigJson = JSON.stringify(config.sessionConfig);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(sessionConfigJson);
      const sessionConfigBase64 = btoa(String.fromCharCode(...bytes));
      
      // Connect to relay server (which proxies to OpenAI)
      // This bypasses browser WebSocket header limitations
      // WebSocket relay runs on separate port (3001) to avoid HMR conflicts
      const wsPort = 3001;
      const wsUrl = `ws://${window.location.hostname}:${wsPort}?characterId=${character.id}&sessionConfig=${encodeURIComponent(sessionConfigBase64)}`;
      
      console.log('🔌 Connecting to relay server:', wsUrl.substring(0, 100) + '...');
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      const connectionId = Date.now().toString(36);
      console.log(`[${connectionId}] WebSocket created, readyState:`, ws.readyState);

      // WebSocket event handlers
      ws.onopen = () => {
        console.log(`[${connectionId}] ✅ WebSocket connected to relay server`);
        console.log(`[${connectionId}] wsRef.current === ws:`, wsRef.current === ws);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`[${connectionId}] 📨 Received:`, message.type);
          console.log(`[${connectionId}] wsRef.current === ws:`, wsRef.current === ws);

          // Only process if this is still the active connection
          if (wsRef.current !== ws) {
            console.log(`[${connectionId}] ⚠️ Ignoring message from stale connection`);
            return;
          }

          switch (message.type) {
            case 'relay.connected':
              console.log(`[${connectionId}] 🔗 Relay server connected to OpenAI`);
              break;

            case 'session.created':
            case 'session.updated':
              console.log(`[${connectionId}] ✅ Session ready - setting isConnected=true`);
              setIsConnected(true);
              updateState('idle');
              break;

            case 'input_audio_buffer.speech_started':
              console.log('Speech detected');
              updateState('listening');
              break;

            case 'input_audio_buffer.speech_stopped':
              console.log('Speech stopped');
              updateState('thinking');
              break;

            case 'conversation.item.input_audio_transcription.completed':
              console.log(`🎤 Transcription completed: "${message.transcript}" (while isSpeaking: ${isSpeaking}, isPlaying: ${isPlayingRef.current})`);
              if (message.transcript) {
                onTranscript?.(message.transcript, true);
              }
              break;

            case 'response.created':
              console.log(`🚀 NEW RESPONSE CREATED - isSpeaking: ${isSpeaking}, isPlaying: ${isPlayingRef.current}, queue: ${audioQueueRef.current.length}`);
              break;

            case 'response.cancelled':
              console.log(`🛑 RESPONSE CANCELLED - something interrupted it!`);
              break;

            case 'response.audio.delta':
              // Received audio chunk from OpenAI
              if (message.delta) {
                totalChunksReceivedRef.current++;
                const chunkNum = totalChunksReceivedRef.current;
                
                // Decode base64 PCM16 audio
                const audioData = atob(message.delta);
                const pcm16 = new Int16Array(audioData.length / 2);
                for (let i = 0; i < pcm16.length; i++) {
                  pcm16[i] = (audioData.charCodeAt(i * 2 + 1) << 8) | audioData.charCodeAt(i * 2);
                }
                
                const durationMs = (pcm16.length / 24000) * 1000;
                console.log(`📥 [Received ${chunkNum}] ${pcm16.length} samples (${durationMs.toFixed(0)}ms), queue before: ${audioQueueRef.current.length}, isPlaying: ${isPlayingRef.current}`);
                
                audioQueueRef.current.push(pcm16);
                processAudioQueue();
              }
              break;

            case 'response.audio.done':
              console.log(`🔊 Audio stream complete from OpenAI - received ${totalChunksReceivedRef.current} chunks total`);
              console.log(`🔊 Queue size: ${audioQueueRef.current.length}, isPlaying: ${isPlayingRef.current}`);
              // Mark response as complete - finalization will happen after queue is empty
              responseCompleteRef.current = true;
              break;

            case 'response.done':
              console.log(`📝 Response complete - queue: ${audioQueueRef.current.length}, isPlaying: ${isPlayingRef.current}`);
              // Response is fully done
              responseCompleteRef.current = true;
              // DON'T trigger finalization here - let processAudioQueue handle it
              // The loop will exit when queue is empty for 500ms
              break;

            case 'response.text.delta':
              if (message.delta) {
                onTranscript?.(message.delta, false);
              }
              break;

            case 'response.text.done':
              if (message.text) {
                onResponse?.(message.text);
              }
              break;

            case 'error':
              console.error('❌ Realtime API error:', message.error);
              console.error('❌ Error details:', JSON.stringify(message.error, null, 2));
              // Don't set error state for non-critical errors
              if (message.error?.type !== 'invalid_request_error') {
                const err = new Error(message.error?.message || 'Realtime API error');
                setError(err);
                onError?.(err);
              }
              break;

            default:
              // Ignore other events
              break;
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error(`[${connectionId}] ❌ WebSocket error:`, event);
        console.log(`[${connectionId}] wsRef.current === ws:`, wsRef.current === ws);
        // Only update state if this is the current active connection
        if (wsRef.current === ws) {
          const err = new Error('WebSocket connection error');
          setError(err);
          onError?.(err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[${connectionId}] 🔌 WebSocket disconnected, code:`, event.code, 'reason:', event.reason);
        console.log(`[${connectionId}] wsRef.current === ws:`, wsRef.current === ws);
        // Only update state if this is the current active connection
        // (React StrictMode can cause multiple connections)
        if (wsRef.current === ws) {
          console.log(`[${connectionId}] Resetting connection state`);
          setIsConnected(false);
          setIsListening(false);
          setIsSpeaking(false);
          updateState('idle');
          wsRef.current = null;
        } else {
          console.log(`[${connectionId}] Ignoring close from stale connection`);
        }
      };

    } catch (err) {
      const error = err as Error;
      console.error('Failed to connect to Realtime API:', err);
      setError(error);
      onError?.(error);
      updateState('idle');
    }
  }, [character, updateState, onTranscript, onResponse, onError, processAudioQueue]);

  // Disconnect from Realtime API
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting from Realtime API');
    
    // Clear finalization timeout
    if (finalizationTimeoutRef.current) {
      clearTimeout(finalizationTimeoutRef.current);
      finalizationTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (recordingAudioContextRef.current) {
      recordingAudioContextRef.current.close();
      recordingAudioContextRef.current = null;
    }

    if (playbackAudioContextRef.current) {
      playbackAudioContextRef.current.close();
      playbackAudioContextRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    responseCompleteRef.current = false;
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    updateState('idle');
  }, [updateState]);

  // Start listening (capture microphone and stream to OpenAI)
  const startListening = useCallback(async () => {
    if (!isConnected || !wsRef.current) {
      throw new Error('Not connected to Realtime API');
    }

    // Don't start listening if we're already listening or speaking
    if (isListening || isSpeaking || isPlayingRef.current) {
      console.log('⏭️ Skipping startListening - already listening or speaking');
      return;
    }

    try {
      console.log('🎤 Starting listening...');
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        },
      });

      mediaStreamRef.current = stream;

      // Setup audio context for capturing (separate from playback)
      if (!recordingAudioContextRef.current || recordingAudioContextRef.current.state === 'closed') {
        recordingAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      const audioContext = recordingAudioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);

      // Create AudioWorklet for PCM16 conversion and streaming
      // For now, use ScriptProcessor (deprecated but widely supported)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        // Block audio when model is speaking (prevents echo feedback)
        if (isPlayingRef.current) {
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32 to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64 and send to OpenAI
        const base64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pcm16.buffer))));
        
        wsRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64,
        }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      audioWorkletNodeRef.current = processor as any;

      setIsListening(true);
      updateState('listening');

      console.log('✅ Listening started');

    } catch (err) {
      const error = err as Error;
      console.error('Failed to start listening:', err);
      setError(error);
      onError?.(error);
    }
  }, [isConnected, isListening, isSpeaking, updateState, onError]);

  // Store startListening in ref for finalizePlayback
  startListeningRef.current = startListening;

  // Start continuous conversation mode
  const startConversation = useCallback(async () => {
    console.log('🎭 Starting continuous conversation mode');
    isConversationActiveRef.current = true;
    setIsConversationActive(true);
    await startListening();
  }, [startListening]);

  // End continuous conversation mode
  const endConversation = useCallback(() => {
    console.log('🎭 Ending continuous conversation mode');
    isConversationActiveRef.current = false;
    setIsConversationActive(false);
    
    // Stop any current listening
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    
    // If speaking, let it finish, otherwise go to idle
    if (!isSpeaking && !isPlayingRef.current) {
      updateState('idle');
    }
  }, [isSpeaking, updateState]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Commit audio buffer to trigger response
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'input_audio_buffer.commit',
      }));

      wsRef.current.send(JSON.stringify({
        type: 'response.create',
      }));
    }

    setIsListening(false);
    updateState('thinking');

    console.log('Listening stopped');
  }, [updateState]);

  // Interrupt current response
  const interrupt = useCallback(() => {
    console.log('🛑 Interrupting response');
    
    // Clear finalization timeout
    if (finalizationTimeoutRef.current) {
      clearTimeout(finalizationTimeoutRef.current);
      finalizationTimeoutRef.current = null;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'response.cancel',
      }));
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    responseCompleteRef.current = false;
    
    // Close playback audio context to stop current audio
    if (playbackAudioContextRef.current) {
      playbackAudioContextRef.current.close();
      playbackAudioContextRef.current = null;
    }

    setIsSpeaking(false);
    updateState('idle');
  }, [updateState]);

  // Store disconnect in ref to avoid dependency issues
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  // Cleanup on unmount (only runs once on actual unmount)
  useEffect(() => {
    return () => {
      console.log('🧹 Hook cleanup - disconnecting');
      disconnectRef.current();
    };
  }, []); // Empty deps - only runs on mount/unmount

  return {
    connect,
    disconnect,
    startListening,
    stopListening,
    startConversation,
    endConversation,
    interrupt,
    isConnected,
    isListening,
    isSpeaking,
    isConversationActive,
    state,
    error,
  };
}

