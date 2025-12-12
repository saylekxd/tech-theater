'use client';

// ============================================================================
// TRANSCRIPTION DISPLAY COMPONENT
// ============================================================================
// Wyświetla transkrypcję rozmowy (opcjonalne)

import { useAppStore } from '@/lib/store';

interface TranscriptionDisplayProps {
  className?: string;
}

export function TranscriptionDisplay({ className = '' }: TranscriptionDisplayProps) {
  const messages = useAppStore((s) => s.messages);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      <div className="bg-gray-900/80 backdrop-blur-md rounded-xl p-4 max-h-60 overflow-y-auto shadow-2xl border border-gray-800">
        <div className="space-y-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] rounded-lg px-3 py-2
                  ${message.role === 'user'
                    ? 'bg-blue-600/90 text-white'
                    : 'bg-gray-700/90 text-gray-100'
                  }
                `}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

