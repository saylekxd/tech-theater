'use client';

// ============================================================================
// VOICE RECORDING HOOK
// ============================================================================
// Hook do nagrywania audio z mikrofonu z auto-stop detection

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceRecordingOptions {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onError?: (error: Error) => void;
  maxDuration?: number; // w sekundach (default: 60s)
  silenceThreshold?: number; // 0-255 (default: 20)
  silenceDuration?: number; // w ms (default: 2000ms = 2s)
  autoStopOnSilence?: boolean; // default: true
}

interface UseVoiceRecordingReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number; // w sekundach
  audioLevel: number; // 0-100
  error: Error | null;
  audioStream: MediaStream | null;
}

export function useVoiceRecording({
  onRecordingComplete,
  onError,
  maxDuration = 60,
  silenceThreshold = 20,
  silenceDuration = 2000,
  autoStopOnSilence = true,
}: UseVoiceRecordingOptions = {}): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }

    analyserRef.current = null;
    silenceStartRef.current = null;
  }, [audioStream]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      setAudioStream(stream);

      // Setup MediaRecorder with Safari fallback
      let mimeType = 'audio/webm;codecs=opus';
      
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'; // Safari fallback
      } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
        mimeType = 'audio/mpeg'; // Another Safari option
      } else {
        // Let browser choose default
        mimeType = '';
      }

      console.log('Using mimeType:', mimeType || 'browser default');

      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream); // No mimeType for Safari
        
      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle stop
      mediaRecorder.onstop = () => {
        // Use actual mimeType from recorder or fallback
        const blobType = mimeType || 'audio/mp4'; // Safari fallback
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        
        console.log('Recording stopped, blob:', {
          size: audioBlob.size,
          type: audioBlob.type,
        });
        
        cleanup();
        setIsRecording(false);
        setRecordingTime(0);
        
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob);
        }
      };

      // Setup audio analysis for volume level and silence detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();

      // Monitor audio level and silence
      const monitorAudio = () => {
        if (!analyserRef.current || !isRecording) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average audio level
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setAudioLevel(Math.min(100, (average / 255) * 100));

        // Update recording time
        if (recordingStartTimeRef.current) {
          const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
          setRecordingTime(elapsed);

          // Auto-stop if max duration reached
          if (elapsed >= maxDuration) {
            stopRecording();
            return;
          }
        }

        // Silence detection
        if (autoStopOnSilence) {
          if (average < silenceThreshold) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
            } else {
              const silenceDurationMs = Date.now() - silenceStartRef.current;
              if (silenceDurationMs >= silenceDuration) {
                console.log('Auto-stopping due to silence');
                stopRecording();
                return;
              }
            }
          } else {
            silenceStartRef.current = null;
          }
        }

        animationFrameRef.current = requestAnimationFrame(monitorAudio);
      };

      monitorAudio();

    } catch (err) {
      const error = err as Error;
      setError(error);
      setIsRecording(false);
      cleanup();
      
      if (onError) {
        onError(error);
      }
    }
  }, [
    onRecordingComplete,
    onError,
    maxDuration,
    silenceThreshold,
    silenceDuration,
    autoStopOnSilence,
    cleanup,
  ]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [cleanup, isRecording]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    isPaused,
    recordingTime,
    audioLevel,
    error,
    audioStream,
  };
}

