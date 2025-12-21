// ============================================================================
// TYPES - Tech Theater Application
// ============================================================================

/**
 * Stan aplikacji - reprezentuje aktualny stan interakcji
 */
export type AppState = 'waiting' | 'listening' | 'processing' | 'responding';

/**
 * Substany podczas przetwarzania
 */
export type ProcessingSubState = 'transcribing' | 'thinking' | 'synthesizing';

/**
 * Tryb komunikacji głosowej
 */
export type VoiceMode = 'elevenlabs' | 'realtime';

/**
 * Wiadomość w konwersacji
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;           // Tekst (transkrypcja lub odpowiedź)
  audioUrl?: string;         // Opcjonalne audio (dla asystenta)
  timestamp: number;
}

/**
 * Konfiguracja postaci
 */
export interface Character {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;      // Instrukcje jak ma rozmawiać
  voiceId: string;            // ID głosu z ElevenLabs
  videoSet: {
    waiting: string;          // Ścieżka do waiting.mp4
    listening: string;        // Ścieżka do listening.mp4
    responding: string;       // Ścieżka do responding.mp4
  };
  llmConfig: {
    temperature: number;      // 0.7-1.0 dla kreatywności
    maxTokens: number;        // Max długość odpowiedzi
    model: string;            // gpt-4o, gpt-4-turbo, claude-3-opus, etc.
  };
}

/**
 * Ustawienia głosu ElevenLabs
 */
export interface ElevenLabsVoiceSettings {
  stability: number;          // 0.0-1.0
  similarity_boost: number;   // 0.0-1.0
  style?: number;            // 0.0-1.0 (opcjonalne)
  use_speaker_boost?: boolean;
}

/**
 * Request do API transkrypcji
 */
export interface TranscriptionRequest {
  audio: Blob;
}

/**
 * Response z API transkrypcji
 */
export interface TranscriptionResponse {
  text: string;
  language?: string;
}

/**
 * Request do API LLM
 */
export interface LLMChatRequest {
  messages: Message[];
  characterId: string;
}

/**
 * Response z API LLM
 */
export interface LLMChatResponse {
  text: string;
  characterId: string;
}

/**
 * Request do API TTS
 */
export interface TTSRequest {
  text: string;
  voiceId: string;
  voiceSettings?: ElevenLabsVoiceSettings;
}

/**
 * Response z API TTS
 */
export interface TTSResponse {
  audioUrl: string;
}

/**
 * Stan Zustand store
 */
export interface AppStore {
  // Stan aplikacji
  state: AppState;
  processingSubState: ProcessingSubState | null;
  
  // Dane konwersacji
  messages: Message[];
  currentCharacter: Character | null;
  
  // Audio state
  isRecording: boolean;
  isPlaying: boolean;
  
  // Voice mode (ElevenLabs vs OpenAI Realtime)
  voiceMode: VoiceMode;
  
  // Actions
  setState: (state: AppState) => void;
  setProcessingSubState: (subState: ProcessingSubState | null) => void;
  addMessage: (message: Message) => void;
  setCurrentCharacter: (character: Character) => void;
  setIsRecording: (isRecording: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVoiceMode: (mode: VoiceMode) => void;
  resetConversation: () => void;
}

