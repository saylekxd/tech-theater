'use client';

// ============================================================================
// AUDIO PERMISSION GATE
// ============================================================================
// Komponent wymuszający user interaction dla odblokowania autoplay

import { useState, useEffect } from 'react';

interface AudioPermissionGateProps {
  children: React.ReactNode;
}

export function AudioPermissionGate({ children }: AudioPermissionGateProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    // Check if already unlocked in session
    const unlocked = sessionStorage.getItem('audioUnlocked');
    if (unlocked === 'true') {
      setIsUnlocked(true);
    }
  }, []);

  const handleUnlock = async () => {
    try {
      // Create a silent audio to unlock autoplay
      const audio = new Audio();
      audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDP//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T=';
      await audio.play();
      audio.pause();
      
      // Mark as unlocked
      sessionStorage.setItem('audioUnlocked', 'true');
      setIsUnlocked(true);
      setHasInteracted(true);
      
      console.log('Audio unlocked successfully');
    } catch (error) {
      console.error('Failed to unlock audio:', error);
      setIsUnlocked(true); // Continue anyway
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/95 backdrop-blur-sm">
      <div className="max-w-md p-8 bg-gray-900 rounded-xl shadow-2xl text-center">
        <div className="text-6xl mb-8">🎭</div>
        <ol className="text-left text-gray-300 text-sm space-y-3 mb-8 list-decimal list-inside">
          <li>Naciśnij na zielony przycisk, kiedy chcesz wejść w interakcję z modelem.</li>
          <li>Kiedy jesteś w konwersacji, nie naciskaj wyłączenia mikrofonu.</li>
          <li>
            Kiedy kończysz konwersację i już nie będziesz rozmawiać z modelem, naciśnij z powrotem przycisk
            mikrofonu.
          </li>
        </ol>
        <button
          onClick={handleUnlock}
          className="
            px-8 py-4 
            bg-blue-600 hover:bg-blue-700 
            text-white text-lg font-semibold 
            rounded-lg 
            transition-all duration-200
            shadow-lg hover:shadow-xl
            focus:outline-none focus:ring-4 focus:ring-blue-300
          "
        >
          Naciśnij żeby rozpocząć
        </button>
      </div>
    </div>
  );
}

