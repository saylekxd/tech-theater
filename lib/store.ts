// ============================================================================
// ZUSTAND STORE - Global State Management
// ============================================================================

import { create } from 'zustand';
import { AppStore, AppState, ProcessingSubState, Message, Character } from './types';

/**
 * Główny store aplikacji używający Zustand
 */
export const useAppStore = create<AppStore>((set) => ({
  // Stan początkowy
  state: 'waiting',
  processingSubState: null,
  messages: [],
  currentCharacter: null,
  isRecording: false,
  isPlaying: false,

  // Actions
  setState: (state: AppState) => set({ state }),
  
  setProcessingSubState: (subState: ProcessingSubState | null) => 
    set({ processingSubState: subState }),
  
  addMessage: (message: Message) => 
    set((state) => ({ 
      messages: [...state.messages, message] 
    })),
  
  setCurrentCharacter: (character: Character) => 
    set({ currentCharacter: character }),
  
  setIsRecording: (isRecording: boolean) => 
    set({ isRecording }),
  
  setIsPlaying: (isPlaying: boolean) => 
    set({ isPlaying }),
  
  resetConversation: () => 
    set({ 
      messages: [],
      state: 'waiting',
      processingSubState: null,
      isRecording: false,
      isPlaying: false,
    }),
}));

