'use client';

// ============================================================================
// MAIN PAGE - Tech Theater Application
// ============================================================================

import { useEffect, useState } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { VoiceControls } from './components/VoiceControls';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { AudioPermissionGate } from './components/AudioPermissionGate';
import { useAppStore } from '@/lib/store';
import { getDefaultCharacter } from '@/lib/characters';

export default function Home() {
  const setCurrentCharacter = useAppStore((s) => s.setCurrentCharacter);
  const currentCharacter = useAppStore((s) => s.currentCharacter);
  const messages = useAppStore((s) => s.messages);
  const [showTranscription, setShowTranscription] = useState(true);

  // Ustaw domyślną postać przy starcie
  useEffect(() => {
    if (!currentCharacter) {
      setCurrentCharacter(getDefaultCharacter());
    }
  }, [currentCharacter, setCurrentCharacter]);

  if (!currentCharacter) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Ładowanie...</div>
      </div>
    );
  }

  return (
    <AudioPermissionGate>
      <main className="relative min-h-screen flex flex-col">
      {/* Header - Minimalistyczny */}
      <header className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="max-w-7xl mx-auto flex justify-end items-center">
          {messages.length > 0 && (
            <button
              onClick={() => setShowTranscription(!showTranscription)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors opacity-40 hover:opacity-100"
            >
              {showTranscription ? 'Ukryj napisy' : 'Pokaż napisy'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Video Player */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full h-full max-w-6xl max-h-[70vh]">
          <VideoPlayer
            waitingVideo={currentCharacter.videoSet.waiting}
            listeningVideo={currentCharacter.videoSet.listening}
            respondingVideo={currentCharacter.videoSet.responding}
            className="rounded-lg shadow-2xl"
            onVideoChange={(state) => {
              console.log('Video changed to state:', state);
            }}
            enableCrossfade={true}
          />
        </div>
      </div>

      {/* Transcription Display (opcional) */}
      {showTranscription && messages.length > 0 && (
        <div className="absolute bottom-32 left-0 right-0 z-10 px-6">
          <TranscriptionDisplay />
        </div>
      )}

      {/* Controls - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent">
        <VoiceControls />
      </div>
      </main>
    </AudioPermissionGate>
  );
}
