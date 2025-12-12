'use client';

// ============================================================================
// AUDIO PLAYBACK HOOK
// ============================================================================
// Hook do odtwarzania audio z ElevenLabs z synchronizacją stanu

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioPlaybackOptions {
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: Error) => void;
}

interface UseAudioPlaybackReturn {
  playAudio: (audioData: Blob | ArrayBuffer) => Promise<void>;
  stopAudio: () => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  setVolume: (volume: number) => void;
  error: Error | null;
}

export function useAudioPlayback({
  onPlayStart,
  onPlayEnd,
  onError,
}: UseAudioPlaybackOptions = {}): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1.0);
  const [error, setError] = useState<Error | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      
      // Remove from DOM if attached
      if (audioRef.current.parentNode) {
        audioRef.current.parentNode.removeChild(audioRef.current);
      }
      
      audioRef.current = null;
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // Play audio from Blob or ArrayBuffer
  const playAudio = useCallback(async (audioData: Blob | ArrayBuffer) => {
    try {
      setError(null);
      
      // Stop any existing audio
      cleanup();

      // Convert ArrayBuffer to Blob if needed
      const audioBlob = audioData instanceof Blob 
        ? audioData 
        : new Blob([audioData], { type: 'audio/mpeg' });

      console.log('Preparing audio playback:', {
        blobSize: audioBlob.size,
        blobType: audioBlob.type,
        isBlob: audioData instanceof Blob,
      });

      // Validate blob size
      if (audioBlob.size === 0) {
        throw new Error('Audio blob is empty');
      }

      // Create audio element and attach to DOM
      const audio = new Audio();
      audio.style.display = 'none';
      audio.preload = 'auto';
      document.body.appendChild(audio); // ← Add to DOM to prevent removal
      audioRef.current = audio;

      // Create object URL
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('Audio URL created:', audioUrl.substring(0, 50) + '...');
      
      audio.src = audioUrl;
      audio.volume = volume;

      // Setup event listeners
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
        console.log('Audio metadata loaded, duration:', audio.duration);
      };

      audio.oncanplay = () => {
        console.log('Audio can play - ready for playback');
      };

      // Update current time
      const updateTime = () => {
        if (audio && !audio.paused && !audio.ended) {
          setCurrentTime(audio.currentTime);
          animationFrameRef.current = requestAnimationFrame(updateTime);
        }
      };

      audio.onplay = () => {
        console.log('Audio play event fired');
        setIsPlaying(true);
        updateTime();
        if (onPlayStart) {
          onPlayStart();
        }
      };

      audio.onended = () => {
        console.log('Audio ended event fired');
        setIsPlaying(false);
        setCurrentTime(0);
        
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (urlError) {
          console.warn('Failed to revoke URL:', urlError);
        }
        
        if (onPlayEnd) {
          onPlayEnd();
        }
      };

      audio.onerror = (e: any) => {
        console.error('Audio element error event:', {
          error: e,
          errorCode: audio.error?.code,
          errorMessage: audio.error?.message,
          networkState: audio.networkState,
          readyState: audio.readyState,
        });
        
        const err = new Error(
          audio.error?.message || 
          `Audio playback error (code: ${audio.error?.code || 'unknown'})`
        );
        
        setError(err);
        setIsPlaying(false);
        
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (urlError) {
          console.warn('Failed to revoke URL:', urlError);
        }
        
        if (onError) {
          onError(err);
        }
      };

      // Wait for audio to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio load timeout'));
        }, 5000);

        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
          clearTimeout(timeout);
          resolve();
        } else {
          audio.oncanplaythrough = () => {
            clearTimeout(timeout);
            resolve();
          };
          audio.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Audio failed to load'));
          };
        }
      });

      console.log('Audio ready to play, attempting playback...');

      // Start playing with better error handling
      try {
        await audio.play();
        console.log('Audio play() successful');
      } catch (playError: any) {
        console.error('Play error:', playError);
        
        // Handle autoplay blocking
        if (playError.name === 'NotAllowedError') {
          console.warn('Autoplay blocked - showing user prompt');
          
          // Inform user to click
          alert('Kliknij OK aby usłyszeć odpowiedź');
          
          // Try to play immediately after
          try {
            await audio.play();
            console.log('Audio play() successful after user interaction');
          } catch (retryError) {
            console.error('Retry play failed:', retryError);
            throw retryError;
          }
        } else if (playError.name === 'AbortError') {
          console.warn('Play aborted - retrying...');
          // Wait a bit and retry
          await new Promise(resolve => setTimeout(resolve, 100));
          await audio.play();
        } else {
          throw playError;
        }
      }

    } catch (err) {
      const error = err as Error;
      console.error('Failed to play audio:', err);
      
      setError(error);
      setIsPlaying(false);
      cleanup();
      
      if (onError) {
        onError(error);
      }
    }
  }, [volume, cleanup, onPlayStart, onPlayEnd, onError]);

  // Stop audio
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    cleanup();
    
    if (onPlayEnd) {
      onPlayEnd();
    }
  }, [cleanup, onPlayEnd]);

  // Set volume
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    playAudio,
    stopAudio,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    error,
  };
}

